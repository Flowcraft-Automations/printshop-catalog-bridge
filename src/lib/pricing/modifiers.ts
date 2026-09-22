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
  /** מפתח חומר (מדבקות): "vinyl" | "diecut_vinyl" | "transparent" … */
  material?: string | undefined;
};

/** תוויות החומרים לבורר בממשק ולפירוט המחיר */
export const MATERIAL_LABEL: Record<string, string> = {
  vinyl: "ויניל",
  diecut_vinyl: "ויניל בחיתוך צורני",
  transparent: "שקוף",
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

const materialSurcharge: ModifierFn = (spec, price, ctx) => {
  if (spec.kind !== "material_surcharge" || !ctx.material) return null;
  const pct = spec.pct[ctx.material];
  if (!pct || pct <= 0) return null;
  return {
    price: price * (1 + pct),
    noRound: false,
    detail: `חומר: ${MATERIAL_LABEL[ctx.material] ?? ctx.material} +${Math.round(pct * 100)}%`,
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
  size_floor: sizeFloor,
  cost_floor: costFloor,
  min_order_value: minOrderValue,
  material_surcharge: materialSurcharge,
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
    /* a plan stored in the database can name a modifier this build does not
       know — ignore it instead of crashing the whole calculator */
    const fn = spec && typeof spec.kind === "string" ? REGISTRY[spec.kind] : undefined;
    if (typeof fn !== "function") continue;
    const out = fn(spec, current, ctx);
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
