import { shekel, type BindingRule } from "../mdvd";
import type { ModifierSpec } from "./plan";

/* ------------------------------------------------------------------ *
 *  Modifiers — each adjusts an already-computed base price.
 *
 *  One small pure function per rule, dispatched from a registry. Adding
 *  a capability means adding an entry here plus its params on
 *  ModifierSpec; priceJob does not change, and no other family is
 *  affected because a family only carries the modifiers it declares.
 * ------------------------------------------------------------------ */

export type ModifierContext = {
  units: number;
  /** the job's long and short side in cm, after any panel split upstream */
  widthCm: number;
  heightCm: number;
  paperWeight?: string | undefined;
  dualSided: boolean;
};

export type ModifierOutcome = {
  price: number;
  /** set when this rule is what ultimately decided the price */
  bindingRule?: BindingRule;
  detail?: string;
  noRound?: boolean;
  /** surfaced on JobPrice for the dual-sided breakdown */
  dualPct?: number;
  dualValue?: number;
  panels?: number;
};

type ModifierFn = (
  spec: ModifierSpec,
  price: number,
  ctx: ModifierContext,
) => ModifierOutcome | null;

const paperWeight: ModifierFn = (spec, price, ctx) => {
  if (spec.kind !== "paper_weight" || !ctx.paperWeight) return null;
  const pct = spec.pct[ctx.paperWeight];
  if (!pct || pct <= 0) return null;
  return {
    price: price * (1 + pct),
    noRound: false,
    detail: `נייר ${ctx.paperWeight} גר׳ +${Math.round(pct * 100)}%`,
  };
};

const dualSided: ModifierFn = (spec, price, ctx) => {
  if (spec.kind !== "dual_sided" || !ctx.dualSided || !spec.tiers.length) return null;
  const tiers = [...spec.tiers].sort((a, b) => (a.maxQty ?? Infinity) - (b.maxQty ?? Infinity));
  const t = tiers.find((x) => x.maxQty === null || ctx.units <= x.maxQty);
  if (!t || t.pct <= 0) return null;
  const dualValue = price * t.pct;
  return {
    price: price + dualValue,
    bindingRule: "dual_surcharge",
    noRound: false,
    dualPct: t.pct,
    dualValue,
    detail: `תוספת דו-צדדי +${Math.round(t.pct * 100)}% (${shekel(dualValue)})`,
  };
};

/**
 * Oversize handled in-house: the job is produced as N panels and joined.
 * The material area is unchanged, so the price is unchanged — which is why
 * priceJob resolves the panel count next to the machine check instead of
 * here: the override and large-format paths return before the modifier
 * stage, and a delivery fact has to be reported on every path.
 * Declared as a modifier so a family still opts in through its plan.
 */
const panelSplit: ModifierFn = () => null;

const minOrderValue: ModifierFn = (spec, price) => {
  if (spec.kind !== "min_order_value" || !(spec.value > 0)) return null;
  if (!(price > 0) || price >= spec.value) return null;
  return {
    price: spec.value,
    bindingRule: "min_order_value",
    noRound: true,
    detail: `מינימום הזמנה ${shekel(spec.value)}`,
  };
};

/* Floors are resolved inside priceJob's finish(), because they must bind on
   EVERY path — including the approved-price and large-format paths that
   return before the modifier stage. Declared here so a family opts in. */
const sizeFloor: ModifierFn = () => null;
const costFloor: ModifierFn = () => null;

const REGISTRY: Record<ModifierSpec["kind"], ModifierFn> = {
  paper_weight: paperWeight,
  dual_sided: dualSided,
  panel_split: panelSplit,
  size_floor: sizeFloor,
  cost_floor: costFloor,
  min_order_value: minOrderValue,
};

/** Applies a family's modifiers in order, collecting what each one did. */
export function applyModifiers(
  specs: readonly ModifierSpec[],
  price: number,
  ctx: ModifierContext,
): {
  price: number;
  bindingRule: BindingRule | null;
  applied: BindingRule[];
  details: string[];
  noRound: boolean | null;
  dualPct: number;
  dualValue: number;
  panels: number;
} {
  let current = price;
  let bindingRule: BindingRule | null = null;
  let noRound: boolean | null = null;
  const applied: BindingRule[] = [];
  const details: string[] = [];
  let dualPct = 0;
  let dualValue = 0;
  let panels = 1;

  for (const spec of specs) {
    const out = REGISTRY[spec.kind](spec, current, ctx);
    if (!out) continue;
    current = out.price;
    if (out.detail) details.push(out.detail);
    if (out.noRound !== undefined) noRound = out.noRound;
    if (out.bindingRule) {
      bindingRule = out.bindingRule;
      applied.push(out.bindingRule);
    }
    if (out.dualPct !== undefined) dualPct = out.dualPct;
    if (out.dualValue !== undefined) dualValue = out.dualValue;
    if (out.panels !== undefined) panels = out.panels;
  }
  return { price: current, bindingRule, applied, details, noRound, dualPct, dualValue, panels };
}
