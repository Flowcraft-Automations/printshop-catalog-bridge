import type { DualTier, EngineKind, FamilyPricing } from "../mdvd";

/* ================================================================== *
 *  Pricing plan — the calculator as a pipeline of small rules.
 *
 *  Every family is priced by the same five stages:
 *
 *      gates → overrides → source → modifiers → finish
 *
 *  The stages were always there, hardcoded as one long if-chain in
 *  priceJob with 52 shared config fields on top. Naming them lets a
 *  family declare ONLY the rules it uses, and lets a new capability be a
 *  new rule (with its own params, its own tests) instead of new fields
 *  on a type every family carries.
 *
 *  A rule's parameters live INSIDE the rule. That is the whole point:
 *  adding דפים must not widen FamilyPricing for the other ten families.
 * ================================================================== */

/** Refuses to quote. Runs first; the first gate that trips wins. */
export type GateSpec =
  | { kind: "machine_limit" }
  | { kind: "min_order_qty"; qty: number; exemptLargeFormat: boolean }
  /** family priced by hand for now — renders "הצעת מחיר", never a number */
  | { kind: "quote_only"; note?: string };

/** Where the base price comes from. Exactly one per family. */
export type SourceSpec =
  | { kind: "catalog_surface" }
  | { kind: "anchor_curve" }
  | { kind: "per_m2" }
  | { kind: "size_ladder" }
  | { kind: "sheet_yield" }
  | { kind: "unit_floor" }
  /** cost tables × markup (דפים): price per page from paper + click cost */
  | {
      kind: "cost_plus";
      /** ₪ per sheet, by size then weight: paper["A4"]["80"] */
      paper: Record<string, Record<string, number>>;
      /** ₪ per impression, by mode: click["color"] */
      click: Record<string, number>;
      markup: number;
    };

/** Adjusts the base price, in order. */
export type ModifierSpec =
  | { kind: "paper_weight"; pct: Record<string, number> }
  | { kind: "dual_sided"; tiers: DualTier[] }
  /** oversize handled in-house by splitting into panels at the same ₪/m² */
  | { kind: "panel_split"; maxWidthCm: number }
  | { kind: "min_order_value"; value: number };

export type PricingPlan = {
  gates: GateSpec[];
  source: SourceSpec;
  modifiers: ModifierSpec[];
};

/**
 * What a family actually writes in its config: only the parts the legacy
 * fields cannot express. Anything omitted is derived, so a family never
 * restates `minOrderQty` (or any other existing field) in two places
 * where the two copies could drift apart.
 */
export type PlanOverride = {
  gates?: GateSpec[];
  source?: SourceSpec;
  modifiers?: ModifierSpec[];
};

/** Derived plan, with the family's explicit overrides layered on top. */
export function resolvePlan(cfg: FamilyPricing, override?: PlanOverride | null): PricingPlan {
  const base = planFromLegacyConfig(cfg);
  if (!override) return base;
  return {
    gates: override.gates ? [...base.gates, ...override.gates] : base.gates,
    source: override.source ?? base.source,
    modifiers: override.modifiers ? [...base.modifiers, ...override.modifiers] : base.modifiers,
  };
}

/**
 * Derives a plan from the config already stored in the database.
 *
 * This is what makes the refactor safe: no migration, no config edit,
 * every existing family keeps behaving exactly as before. New families
 * are authored as plans directly instead of going through here.
 */
export function planFromLegacyConfig(cfg: FamilyPricing): PricingPlan {
  const gates: GateSpec[] = [{ kind: "machine_limit" }];
  if (cfg.minOrderQty > 1)
    gates.push({
      kind: "min_order_qty",
      qty: cfg.minOrderQty,
      /* large format is not sheet work — the sheet minimum does not apply */
      exemptLargeFormat: cfg.engine === "anchor_curve" || cfg.engine === "catalog_surface",
    });

  const modifiers: ModifierSpec[] = [];
  if (Object.keys(cfg.paperWeightPct).length && cfg.engine === "anchor_curve")
    modifiers.push({ kind: "paper_weight", pct: cfg.paperWeightPct });
  if (cfg.dualSurcharge.length) modifiers.push({ kind: "dual_sided", tiers: cfg.dualSurcharge });
  if (cfg.minOrderValue > 0) modifiers.push({ kind: "min_order_value", value: cfg.minOrderValue });

  return { gates, source: { kind: cfg.engine as Exclude<EngineKind, never> }, modifiers };
}

/** Config problems a plan can carry, surfaced in the UI like today's configError. */
export function validatePlan(plan: PricingPlan): string[] {
  const errors: string[] = [];
  const kinds = plan.modifiers.map((m) => m.kind);
  if (new Set(kinds).size !== kinds.length)
    errors.push("תצורה שגויה: מקדם מופיע יותר מפעם אחת בתוכנית התמחור");
  if (plan.source.kind === "cost_plus" && !(plan.source.markup > 0))
    errors.push("תצורה שגויה: מנוע עלות-פלוס ללא מקדם רווח");
  return errors;
}
