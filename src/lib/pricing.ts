/**
 * Universal, configuration-driven pricing engine.
 *
 * The code knows only *methods*; every shop rule (size bands, rates, minimums,
 * quantity discounts, rounding, cost floors) lives in each family's
 * `pricing_config` JSON. No family-specific logic belongs in this file.
 */

export type TierMatch = {
  min_w?: number;
  max_w?: number;
  min_h?: number;
  max_h?: number;
};

export type PricingMethod =
  | "area_linear"
  | "per_running_meter"
  | "per_sheet"
  | "reference";

export type AreaLinearParams = { base?: number; rate_m2?: number; min?: number };
export type RunningMeterParams = { rate?: number; min?: number };
export type PerSheetParams = {
  sheet_w?: number;
  sheet_h?: number;
  gap_cm?: number;
  setup_fee?: number;
  sheet_rate?: number;
  sheet_cost?: number;
  units_overrides?: Record<string, number>;
  min?: number;
};
export type ReferenceParams = {
  family?: string;
  overrides?: AreaLinearParams & RunningMeterParams & PerSheetParams;
};

export type TierCost = {
  cost_per_m2?: number;
  sheet_cost?: number;
  outsource_per_m2?: number;
};

export type Tier = {
  name: string;
  match?: TierMatch;
  method: PricingMethod;
  params?: Record<string, unknown>;
  cost?: TierCost;
};

export type QtyModel =
  | { type: "tiers"; tiers: { min_qty: number; mult: number }[] }
  | { type: "power"; exponent: number };

export type Rounding = { step?: number; direction?: "up" | "down" | "nearest" };

export type PricingConfig = {
  tiers: Tier[];
  qty_model?: QtyModel;
  rounding?: Rounding;
  cost?: { overhead_mult?: number };
};

export type CatalogPrice = {
  family: string | null;
  width_cm: number | null;
  height_cm: number | null;
  qty: number | null;
  price: number | null;
};

export type PriceResult = {
  ok: boolean;
  /** Hebrew validation message when ok === false. */
  error: string | null;
  price: number | null;
  /** Where the price came from: tier name, or "מחיר קטלוג". */
  label: string;
  tier: Tier | null;
  /** Family chain followed through `reference` tiers. */
  tierPath: string[];
  /** Plain-language lines generated from the config, never hardcoded. */
  breakdown: string[];
  unitsPerSheet: number | null;
  sheets: number | null;
  directCost: number;
  costFloor: number;
  margin: number | null;
  qtyMult: number;
  fromCatalog: boolean;
};

export const DEFAULT_OVERHEAD_MULT = 1.3;

const n = (v: unknown, fallback = 0): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : fallback;
};

const round1 = (x: number) => Math.round(x * 100) / 100;

/** Longer side first — every match rule and formula uses this orientation. */
export function normalizeSides(w: number, h: number): { w: number; h: number } {
  const a = Math.max(w, h);
  const b = Math.min(w, h);
  return { w: a, h: b };
}

export function tierMatches(tier: Tier, w: number, h: number): boolean {
  const m = tier.match ?? {};
  if (m.min_w != null && w < m.min_w) return false;
  if (m.max_w != null && w > m.max_w) return false;
  if (m.min_h != null && h < m.min_h) return false;
  if (m.max_h != null && h > m.max_h) return false;
  return true;
}

/** First tier whose conditions all pass; an empty match acts as catch-all. */
export function pickTier(config: PricingConfig | null | undefined, w: number, h: number): Tier | null {
  if (!config?.tiers?.length) return null;
  const s = normalizeSides(w, h);
  return config.tiers.find((t) => tierMatches(t, s.w, s.h)) ?? null;
}

export function qtyMultiplier(model: QtyModel | undefined, qty: number): number {
  const q = Math.max(1, qty || 1);
  if (!model) return 1;
  if (model.type === "power") {
    const e = n(model.exponent, 0.85);
    return q > 0 ? Math.pow(q, e) / q : 1;
  }
  const sorted = [...(model.tiers ?? [])].sort((a, b) => a.min_qty - b.min_qty);
  let mult = 1;
  for (const t of sorted) if (q >= n(t.min_qty)) mult = n(t.mult, 1);
  return mult;
}

export function applyRounding(price: number, r: Rounding | undefined): number {
  const step = n(r?.step, 1);
  if (step <= 0) return round1(price);
  const dir = r?.direction ?? "nearest";
  if (dir === "up") return Math.ceil(price / step) * step;
  if (dir === "down") return Math.floor(price / step) * step;
  return Math.round(price / step) * step;
}

export function unitsPerSheet(p: PerSheetParams, w: number, h: number): number {
  const key = `${w}x${h}`;
  const altKey = `${h}x${w}`;
  const ov = p.units_overrides ?? {};
  if (ov[key] != null) return Math.max(1, Math.floor(n(ov[key], 1)));
  if (ov[altKey] != null) return Math.max(1, Math.floor(n(ov[altKey], 1)));
  const gap = n(p.gap_cm, 0);
  const sw = n(p.sheet_w);
  const sh = n(p.sheet_h);
  if (w <= 0 || h <= 0 || sw <= 0 || sh <= 0) return 0;
  const fit = (sheet: number, item: number) => Math.floor((sheet + gap) / (item + gap));
  const a = fit(sw, w) * fit(sh, h);
  const b = fit(sw, h) * fit(sh, w);
  return Math.max(a, b, 0);
}

type Ctx = {
  configs: Record<string, PricingConfig | null | undefined>;
  qty: number;
  seen: Set<string>;
};

type MethodOutput = {
  price: number;
  breakdown: string[];
  unitsPerSheet: number | null;
  sheets: number | null;
  /** per_sheet already prices the whole run — skip the quantity model. */
  qtyIncluded: boolean;
  /** per_sheet arithmetic is exact — never round it away. */
  skipRounding: boolean;
  directCost: number | null;
  error?: string;
};

function fmt(x: number): string {
  return Number.isInteger(x) ? String(x) : String(round1(x));
}

function computeTier(
  tier: Tier,
  familyName: string,
  w: number,
  h: number,
  ctx: Ctx,
  overrides: Record<string, unknown> = {},
): MethodOutput & { tier: Tier; tierPath: string[]; config: PricingConfig | null } {
  const params = { ...(tier.params ?? {}), ...overrides } as Record<string, unknown>;
  const area = (w * h) / 10000;
  const qty = Math.max(1, ctx.qty || 1);
  const base: Omit<MethodOutput, "price"> = {
    breakdown: [],
    unitsPerSheet: null,
    sheets: null,
    qtyIncluded: false,
    skipRounding: false,
    directCost: null,
  };
  const self = { tier, tierPath: [familyName], config: ctx.configs[familyName] ?? null };

  if (tier.method === "area_linear") {
    const p = params as AreaLinearParams;
    if (w <= 0 || h <= 0) {
      return { ...base, ...self, price: 0, error: "הזינו מידות" };
    }
    const raw = n(p.base) + n(p.rate_m2) * area;
    const min = n(p.min);
    const price = Math.max(raw, min);
    const lines = [
      `${fmt(n(p.base))} + ${fmt(n(p.rate_m2))} × ${fmt(round1(area))} מ״ר = ${fmt(round1(raw))} ₪`,
    ];
    if (min > 0 && price === min && raw < min) lines.push(`מחיר מינימום בשכבה: ${fmt(min)} ₪`);
    return { ...base, ...self, price, breakdown: lines };
  }

  if (tier.method === "per_running_meter") {
    const p = params as RunningMeterParams;
    if (w <= 0 || h <= 0) {
      return { ...base, ...self, price: 0, error: "הזינו מידות" };
    }
    const meters = w / 100;
    const raw = n(p.rate) * meters;
    const min = n(p.min);
    const price = Math.max(raw, min);
    const lines = [`${fmt(n(p.rate))} ₪ למטר × ${fmt(round1(meters))} מ׳ = ${fmt(round1(raw))} ₪`];
    if (min > 0 && price === min && raw < min) lines.push(`מחיר מינימום בשכבה: ${fmt(min)} ₪`);
    return { ...base, ...self, price, breakdown: lines };
  }

  if (tier.method === "per_sheet") {
    const p = params as PerSheetParams;
    if (w <= 0 || h <= 0) {
      return { ...base, ...self, price: 0, error: "הזינו מידות" };
    }
    if (!ctx.qty || ctx.qty <= 0) {
      return { ...base, ...self, price: 0, error: "הזינו כמות" };
    }
    const units = unitsPerSheet(p, w, h);
    if (units <= 0) {
      return { ...base, ...self, price: 0, error: "המידה גדולה מהגיליון" };
    }
    const sheets = Math.ceil(qty / units);
    const price = Math.max(n(p.setup_fee) + sheets * n(p.sheet_rate), n(p.min));
    return {
      ...base,
      ...self,
      price,
      unitsPerSheet: units,
      sheets,
      qtyIncluded: true,
      skipRounding: true,
      directCost: sheets * n(p.sheet_cost, n(tier.cost?.sheet_cost)),
      breakdown: [
        `${units} יחידות בגיליון ${fmt(n(p.sheet_w))}×${fmt(n(p.sheet_h))} ס״מ`,
        `${qty} יח׳ → ${sheets} גיליונות`,
        `${fmt(n(p.setup_fee))} + ${sheets} × ${fmt(n(p.sheet_rate))} = ${fmt(price)} ₪`,
      ],
    };
  }

  // reference: delegate to another family's tiers, then apply overrides
  const p = params as ReferenceParams;
  const target = p.family ?? "";
  if (!target || ctx.seen.has(target)) {
    return { ...base, ...self, price: 0, error: "הגדרת הפניה שגויה" };
  }
  ctx.seen.add(target);
  const refConfig = ctx.configs[target];
  const refTier = pickTier(refConfig, w, h);
  if (!refTier) {
    return { ...base, ...self, price: 0, error: `אין תצורת תמחור למשפחה ${target}` };
  }
  const out = computeTier(refTier, target, w, h, ctx, (p.overrides ?? {}) as Record<string, unknown>);
  return {
    ...out,
    tier: refTier,
    tierPath: [familyName, ...out.tierPath],
    config: refConfig ?? null,
    breakdown: [`לפי משפחת ${target} — ${refTier.name}`, ...out.breakdown],
  };
}

function matchCatalog(
  catalog: CatalogPrice[] | undefined,
  family: string,
  w: number,
  h: number,
  qty: number,
): number | null {
  if (!catalog?.length || w <= 0 || h <= 0) return null;
  const area = w * h;
  for (const c of catalog) {
    if (c.family !== family) continue;
    if (!c.width_cm || !c.height_cm || !c.price) continue;
    if (Math.max(1, c.qty ?? 1) !== Math.max(1, qty)) continue;
    const ca = c.width_cm * c.height_cm;
    if (Math.abs(ca - area) / area <= 0.02) return c.price;
  }
  return null;
}

export type PriceJobInput = {
  family: string;
  w: number;
  h: number;
  qty: number;
  configs: Record<string, PricingConfig | null | undefined>;
  /** Catalog rows used for the ±2% "מחיר קטלוג" lookup. */
  catalog?: CatalogPrice[];
};

export function priceJob(input: PriceJobInput): PriceResult {
  const { family, configs, catalog } = input;
  const s = normalizeSides(n(input.w), n(input.h));
  const qty = Math.max(0, Math.floor(n(input.qty)));
  const config = configs[family] ?? null;

  const empty: PriceResult = {
    ok: false,
    error: null,
    price: null,
    label: "",
    tier: null,
    tierPath: [],
    breakdown: [],
    unitsPerSheet: null,
    sheets: null,
    directCost: 0,
    costFloor: 0,
    margin: null,
    qtyMult: 1,
    fromCatalog: false,
  };

  if (!config?.tiers?.length) {
    return { ...empty, error: "לא הוגדרה תצורת תמחור למשפחה" };
  }
  const tier = pickTier(config, s.w, s.h);
  if (!tier) return { ...empty, error: "אין שכבת תמחור מתאימה למידה" };
  if (s.w <= 0 || s.h <= 0) {
    return { ...empty, tier, tierPath: [family], error: "הזינו מידות" };
  }

  const ctx: Ctx = { configs, qty: qty || 1, seen: new Set([family]) };
  const out = computeTier(tier, family, s.w, s.h, ctx);
  if (out.error) {
    return { ...empty, tier: out.tier, tierPath: out.tierPath, error: out.error };
  }

  const qtyMult = out.qtyIncluded ? 1 : qtyMultiplier(config.qty_model, qty || 1) * Math.max(1, qty);
  let price = out.price * (out.qtyIncluded ? 1 : qtyMult);
  const breakdown = [...out.breakdown];
  if (!out.qtyIncluded && (qty || 1) > 1) {
    breakdown.push(`כמות ${qty}: ×${fmt(round1(qtyMult))} → ${fmt(round1(price))} ₪`);
  }
  if (!out.skipRounding) {
    const rounded = applyRounding(price, config.rounding);
    if (rounded !== price) {
      breakdown.push(`עיגול (${fmt(n(config.rounding?.step, 1))} ₪): ${fmt(rounded)} ₪`);
    }
    price = rounded;
  }

  const area = (s.w * s.h) / 10000;
  const overhead = n(config.cost?.overhead_mult, DEFAULT_OVERHEAD_MULT);
  const directCost =
    out.directCost != null
      ? out.directCost
      : n(out.tier.cost?.cost_per_m2) * area * Math.max(1, qty || 1);
  const costFloor = round1(directCost * (overhead > 0 ? overhead : DEFAULT_OVERHEAD_MULT));

  const catalogPrice = matchCatalog(catalog, family, s.w, s.h, qty || 1);
  const finalPrice = catalogPrice ?? price;

  return {
    ok: true,
    error: null,
    price: round1(finalPrice),
    label: catalogPrice != null ? "מחיר קטלוג" : out.tier.name,
    tier: out.tier,
    tierPath: out.tierPath,
    breakdown:
      catalogPrice != null
        ? [`נמצא פריט זהה בקטלוג — ${fmt(catalogPrice)} ₪`, `מחיר לפי נוסחה: ${fmt(round1(price))} ₪`]
        : breakdown,
    unitsPerSheet: out.unitsPerSheet,
    sheets: out.sheets,
    directCost: round1(directCost),
    costFloor,
    margin: finalPrice > 0 ? round1(finalPrice - costFloor) : null,
    qtyMult: round1(out.qtyIncluded ? 1 : qtyMult),
    fromCatalog: catalogPrice != null,
  };
}

/** Map of family name → config, ready to hand to priceJob. */
export function configMap(
  families: { family: string; pricing_config?: unknown }[],
): Record<string, PricingConfig | null> {
  const map: Record<string, PricingConfig | null> = {};
  for (const f of families) {
    map[f.family] = (f.pricing_config as PricingConfig | null) ?? null;
  }
  return map;
}

export const LADDER_QUANTITIES = [100, 150, 200, 250, 500, 1000];
