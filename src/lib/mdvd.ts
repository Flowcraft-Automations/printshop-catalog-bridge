export type Product = {
  id: string;
  row_key: string;
  name: string;
  family: string | null;
  width_cm: number | null;
  height_cm: number | null;
  qty: number | null;
  senzey_exists: boolean | null;
  senzey_ids: string | null;
  senzey_price: number | null;
  senzey_dup_count: number | null;
  site_exists: boolean | null;
  site_url: string | null;
  site_price: number | null;
  final_price: number | null;
  senzey_status: string;
  site_status: string;
  anomaly: string | null;
  notes: string | null;
  source: string | null;
  senzey_group?: string | null;
  site_category?: string | null;
  competitor_price?: number | null;
  competitor_ref?: string | null;
  proposed_price?: number | null;
  verified?: boolean;
  verified_at?: string | null;
  is_anchor?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ProductHistory = {
  id: string;
  product_id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  batch_id: string;
  source: string;
  changed_at: string;
};

export const FIELD_LABEL: Record<string, string> = {
  name: "שם",
  family: "משפחה",
  width_cm: "רוחב",
  height_cm: "גובה",
  qty: "כמות",
  senzey_exists: "קיים בסנזיי",
  senzey_ids: "מזהי סנזיי",
  senzey_price: "מחיר סנזיי",
  senzey_dup_count: "כפילויות סנזיי",
  site_exists: "קיים באתר",
  site_url: "קישור",
  site_price: "מחיר אתר",
  final_price: "מחיר סופי",
  senzey_status: "סטטוס סנזיי",
  site_status: "סטטוס אתר",
  anomaly: "חריגה",
  notes: "הערות",
  verified: "אומת",
  is_anchor: "עוגן עקומה",
  senzey_group: "קבוצה בסנזיי",
  site_category: "קטגוריה באתר",
  competitor_price: "מחיר מתחרה",
  competitor_ref: "מקור מחיר מתחרה",
  proposed_price: "מחיר מוצע",
};

const NUMERIC_FIELDS = new Set([
  "width_cm",
  "height_cm",
  "qty",
  "senzey_price",
  "senzey_dup_count",
  "site_price",
  "final_price",
  "competitor_price",
  "proposed_price",
]);
const BOOL_FIELDS = new Set(["senzey_exists", "site_exists", "verified", "is_anchor"]);

/** Convert a stored history text value back to its column type. */
export function parseFieldValue(field: string, value: string | null): unknown {
  if (value === null) return null;
  if (NUMERIC_FIELDS.has(field)) return Number(value);
  if (BOOL_FIELDS.has(field)) return value === "true";
  return value;
}

export function displayFieldValue(field: string, value: string | null): string {
  if (value === null || value === "") return "—";
  if (BOOL_FIELDS.has(field)) return value === "true" ? "כן" : "לא";
  if (field === "senzey_status" || field === "site_status")
    return STATUS_LABEL[value] ?? value;
  return value;
}

/** Stable, visually distinct color for a family name. */
const FAMILY_PALETTE = [
  "oklch(0.62 0.16 25)",   // red
  "oklch(0.62 0.16 55)",   // orange
  "oklch(0.62 0.16 95)",   // yellow-green
  "oklch(0.62 0.16 145)",  // green
  "oklch(0.62 0.16 190)",  // teal
  "oklch(0.62 0.16 250)",  // blue
  "oklch(0.62 0.16 290)",  // indigo
  "oklch(0.62 0.16 330)",  // pink
];
export function familyColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FAMILY_PALETTE[Math.abs(hash) % FAMILY_PALETTE.length] as string;
}


export type QtyDiscount = { min: number; mult: number };

export type Family = {
  family: string;
  items_count: number | null;
  rate_m2: number | null;
  base_price: number | null;
  min_charge: number | null;
  qty_discounts: QtyDiscount[] | null;
  qty_exponent?: number | null;
  cost_per_m2?: number | null;
  outsource_width_cm?: number | null;
  outsource_height_cm?: number | null;
  outsource_cost_per_m2?: number | null;
  notes: string | null;
  pricing_config?: unknown;
};

/* ------------------------------------------------------------------ *
 * Customer pricing per family (stored in families.pricing_config.customer)
 * ------------------------------------------------------------------ */

export type PriceSide = { base: number; rate_m2: number; min: number };

export type SheetConfig = {
  setup: number;
  price_per_sheet: number;
  cost_per_sheet: number;
  units_per_sheet: number;
  overrides: { size: string; units: number }[];
};

export type PricingMode = "cost" | "customer";

export type CustomerPricing = {
  mode: PricingMode;
  margin_pct: number;
  min_charge: number;
  below: PriceSide;
  above: PriceSide;
  min_per_linear_m: number;
  sheet_mode: boolean;
  sheet: SheetConfig;
  rounding: { step: number; direction: "nearest" | "up" | "down" };
};

export const EMPTY_SIDE: PriceSide = { base: 0, rate_m2: 0, min: 0 };

export const EMPTY_CUSTOMER_PRICING: CustomerPricing = {
  mode: "customer",
  margin_pct: 0,
  min_charge: 0,
  below: { ...EMPTY_SIDE },
  above: { ...EMPTY_SIDE },
  min_per_linear_m: 0,
  sheet_mode: false,
  sheet: {
    setup: 0,
    price_per_sheet: 0,
    cost_per_sheet: 0,
    units_per_sheet: 0,
    overrides: [],
  },
  rounding: { step: 5, direction: "nearest" },
};


const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Read the customer-price block out of families.pricing_config, filling defaults. */
export function readCustomerPricing(family: Family | undefined): CustomerPricing {
  const raw = (family?.pricing_config ?? null) as Record<string, unknown> | null;
  const c = (raw?.["customer"] ?? null) as Record<string, unknown> | null;
  if (!c)
    return {
      ...EMPTY_CUSTOMER_PRICING,
      // nothing configured yet → the cost table is the simplest way to price
      mode: "cost",
      below: { ...EMPTY_SIDE },
      above: { ...EMPTY_SIDE },
    };
  const side = (v: unknown): PriceSide => {
    const o = (v ?? {}) as Record<string, unknown>;
    return { base: num(o["base"]), rate_m2: num(o["rate_m2"]), min: num(o["min"]) };
  };
  const s = (c["sheet"] ?? {}) as Record<string, unknown>;
  const r = (c["rounding"] ?? {}) as Record<string, unknown>;
  return {
    mode: c["mode"] === "cost" ? "cost" : "customer",
    margin_pct: num(c["margin_pct"]),
    min_charge: num(c["min_charge"]),
    below: side(c["below"]),
    above: side(c["above"]),
    min_per_linear_m: num(c["min_per_linear_m"]),
    sheet_mode: c["sheet_mode"] === true,
    sheet: {
      setup: num(s["setup"]),
      price_per_sheet: num(s["price_per_sheet"]),
      cost_per_sheet: num(s["cost_per_sheet"]),
      units_per_sheet: num(s["units_per_sheet"]),
      overrides: Array.isArray(s["overrides"])
        ? (s["overrides"] as unknown[]).map((o) => {
            const x = (o ?? {}) as Record<string, unknown>;
            return { size: String(x["size"] ?? ""), units: num(x["units"]) };
          })
        : [],
    },
    rounding: {
      step: num(r["step"]) > 0 ? num(r["step"]) : 5,
      direction:
        r["direction"] === "up" || r["direction"] === "down"
          ? (r["direction"] as "up" | "down")
          : "nearest",
    },
  };
}

/** true when the family has a usable price configuration (either mode). */
export function hasCustomerPricing(cfg: CustomerPricing): boolean {
  if (cfg.mode === "cost") return true;
  return (
    cfg.below.base > 0 ||
    cfg.below.rate_m2 > 0 ||
    cfg.below.min > 0 ||
    cfg.above.base > 0 ||
    cfg.above.rate_m2 > 0 ||
    cfg.above.min > 0 ||
    (cfg.sheet_mode && cfg.sheet.price_per_sheet > 0)
  );
}


/**
 * "Fits in the box": the item's longer side is within סף רוחב and its shorter
 * side within סף גובה. No thresholds configured → always inside.
 */
export function fitsInBox(w: number, h: number, family: Family | undefined): boolean {
  const bw = Number(family?.outsource_width_cm ?? 0) || 0;
  const bh = Number(family?.outsource_height_cm ?? 0) || 0;
  if (bw <= 0 || bh <= 0) return true;
  const long = Math.max(w, h);
  const short = Math.min(w, h);
  return long <= bw && short <= bh;
}

export function applyRounding(
  value: number,
  rounding: { step: number; direction: "nearest" | "up" | "down" },
) {
  const step = rounding.step > 0 ? rounding.step : 1;
  if (rounding.direction === "up") return Math.ceil(value / step) * step;
  if (rounding.direction === "down") return Math.floor(value / step) * step;
  return Math.round(value / step) * step;
}

export type ConfigPricing = {
  total: number;
  unit: number;
  side: "below" | "above";
  minApplied: boolean;
  linearApplied: boolean;
  sheets: number | null;
  detail: string;
};

/**
 * Customer price from the family's configured numbers:
 * total = דמי בסיס + ₪ למ״ר × שטח × כמות, never below the minimum
 * (nor below מינימום למטר אורך × meters × כמות when set).
 * Sheet mode (below-threshold only): setup + sheets × price per sheet.
 */
export function priceFromConfig(
  family: Family | undefined,
  cfg: CustomerPricing,
  w: number,
  h: number,
  qty: number,
): ConfigPricing {
  const units = Math.max(1, qty || 1);
  const area = (w * h) / 10000;
  const inside = fitsInBox(w, h, family);
  const side = inside ? "below" : "above";
  const s = inside ? cfg.below : cfg.above;

  if (inside && cfg.sheet_mode && cfg.sheet.price_per_sheet > 0) {
    const key = `${w}x${h}`;
    const ov = cfg.sheet.overrides.find(
      (o) => o.size.replace(/[×*]/g, "x").replace(/\s/g, "") === key,
    );
    const perSheet = ov && ov.units > 0 ? ov.units : cfg.sheet.units_per_sheet;
    const sheets = perSheet > 0 ? Math.ceil(units / perSheet) : 1;
    const raw = cfg.sheet.setup + sheets * cfg.sheet.price_per_sheet;
    const minApplied = raw < s.min;
    const total = applyRounding(Math.max(raw, s.min), cfg.rounding);
    return {
      total,
      unit: total / units,
      side,
      minApplied,
      linearApplied: false,
      sheets,
      detail: `מצב גיליון · ${sheets} גיליונות × ${shekel(cfg.sheet.price_per_sheet)} + דמי הכנה ${shekel(cfg.sheet.setup)}`,
    };
  }

  const raw = s.base + s.rate_m2 * area * units;
  const meters = (Math.max(w, h) / 100) * units;
  const linearMin = cfg.min_per_linear_m > 0 ? cfg.min_per_linear_m * meters : 0;
  const floorValue = Math.max(s.min, linearMin);
  const minApplied = raw < s.min && s.min >= linearMin;
  const linearApplied = raw < linearMin && linearMin > s.min;
  const total = applyRounding(Math.max(raw, floorValue), cfg.rounding);
  return {
    total,
    unit: total / units,
    side,
    minApplied,
    linearApplied,
    sheets: null,
    detail: `${inside ? "בתוך הסף" : "מעל הסף"} · דמי בסיס ${shekel(s.base)} + ${shekel(s.rate_m2)} למ״ר × ${area.toFixed(3)} מ״ר${units > 1 ? ` × ${units.toLocaleString()} יח׳` : ""} = ${shekel(Math.round(raw))}${
      linearApplied
        ? ` → מינימום למטר אורך ${shekel(cfg.min_per_linear_m)} × ${meters.toFixed(2)} מ׳`
        : minApplied
          ? ` → מחיר מינימום ${shekel(s.min)}`
          : ""
    }`,
  };
}

export type BusinessConfig = {
  id: number;
  monthly_cost: number;
  monthly_revenue: number;
  overhead_factor: number;
};

export const DEFAULT_OVERHEAD_FACTOR = 2;

export type JobCost = {
  area: number;
  ratePerM2: number;
  directCost: number;
  outsourced: boolean;
  thresholdW: number | null;
  thresholdH: number | null;
  hasCost: boolean;
};

/** Direct material + print cost of a job, switching to the outsourcing rate when both dimensions pass the family threshold. */
export function jobCost(
  family: Family | undefined,
  w: number,
  h: number,
  qty: number,
): JobCost {
  const base = Number(family?.cost_per_m2 ?? 0) || 0;
  const thresholdW =
    family?.outsource_width_cm != null && Number(family.outsource_width_cm) > 0
      ? Number(family.outsource_width_cm)
      : null;
  const thresholdH =
    family?.outsource_height_cm != null && Number(family.outsource_height_cm) > 0
      ? Number(family.outsource_height_cm)
      : null;
  const outRate = Number(family?.outsource_cost_per_m2 ?? 0) || 0;
  const area = (w * h) / 10000;
  // "fits in the box" — longer side within the width threshold and shorter side
  // within the height threshold. Anything that does not fit goes to outsourcing.
  const outsourced =
    thresholdW != null && thresholdH != null && outRate > 0 && !fitsInBox(w, h, family);
  const ratePerM2 = outsourced ? outRate : base;
  const units = qty > 0 ? qty : 1;
  return {
    area,
    ratePerM2,
    directCost: area * ratePerM2 * units,
    outsourced,
    thresholdW,
    thresholdH,
    hasCost: ratePerM2 > 0 && area > 0,
  };
}

/** Minimum sale price that covers direct cost plus labor/overhead. */
export function costFloor(directCost: number, overheadFactor: number) {
  const f = overheadFactor > 0 ? overheadFactor : DEFAULT_OVERHEAD_FACTOR;
  return directCost * f;
}


export const STATUSES = [
  "exists",
  "added",
  "deleted",
  "dup_deleted",
  "increased",
  "decreased",
  "to_review",
  "to_add",
  "in_progress",
  "done",
  "not_relevant",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  exists: "ללא שינוי",
  added: "נוסף",
  deleted: "נמחק",
  dup_deleted: "כפילות נמחקה",
  increased: "עלה",
  decreased: "ירד",
  to_review: "לבחינה",
  to_add: "להוספה",
  in_progress: "בתהליך",
  done: "בוצע",
  not_relevant: "לא רלוונטי",
};

export const STATUS_CLASS: Record<string, string> = {
  exists: "bg-[oklch(0.93_0.005_250)] text-[oklch(0.42_0.01_250)] border-[oklch(0.86_0.008_250)]",
  added: "bg-[oklch(0.93_0.07_155)] text-[oklch(0.4_0.1_155)] border-[oklch(0.84_0.09_155)]",
  deleted: "bg-[oklch(0.93_0.06_25)] text-[oklch(0.45_0.16_25)] border-[oklch(0.85_0.09_25)]",
  dup_deleted: "bg-[oklch(0.92_0.05_320)] text-[oklch(0.44_0.14_325)] border-[oklch(0.84_0.08_322)]",
  increased: "bg-[oklch(0.94_0.08_50)] text-[oklch(0.45_0.15_45)] border-[oklch(0.86_0.1_50)]",
  decreased: "bg-[oklch(0.93_0.06_200)] text-[oklch(0.42_0.12_215)] border-[oklch(0.85_0.08_205)]",
  to_review: "bg-[oklch(0.94_0.09_95)] text-[oklch(0.42_0.09_75)] border-[oklch(0.86_0.11_92)]",
  to_add: "bg-[oklch(0.93_0.05_250)] text-[oklch(0.42_0.11_255)] border-[oklch(0.85_0.07_252)]",
  in_progress: "bg-[oklch(0.93_0.08_60)] text-[oklch(0.47_0.14_50)] border-[oklch(0.85_0.11_58)]",
  done: "bg-[oklch(0.93_0.07_155)] text-[oklch(0.42_0.1_155)] border-[oklch(0.84_0.09_155)]",
  not_relevant: "bg-[oklch(0.95_0_0)] text-[oklch(0.6_0_0)] border-[oklch(0.9_0_0)]",
};

export const CLOSED_STATUSES = new Set(["deleted", "dup_deleted", "not_relevant"]);

/** Both platforms are closed out (deleted / not relevant) — nothing left to price or flag. */
export function isClosedOut(p: Product): boolean {
  return (
    CLOSED_STATUSES.has(p.senzey_status ?? "") &&
    CLOSED_STATUSES.has(p.site_status ?? "")
  );
}

/** Site price minus Senzey price; null when either side is missing. */
export function priceGap(p: Product): number | null {
  if (p.site_price === null || p.site_price === undefined) return null;
  if (p.senzey_price === null || p.senzey_price === undefined) return null;
  return Number(p.site_price) - Number(p.senzey_price);
}

/**
 * Each system's status follows its own price column: when מחיר סנזיי changes the
 * Senzey status becomes עלה / ירד / ללא שינוי, and likewise for מחיר אתר.
 * Systems that are closed out (נמחק / לא רלוונטי / כפילות נמחקה) are left alone.
 */
export function autoStatusFromPrice(
  prev: Product,
  patchIn: Partial<Product>,
): { senzey_status?: string; site_status?: string } {
  const patch: { senzey_status?: string; site_status?: string } = {};

  const decide = (oldV: unknown, newV: unknown): string | null => {
    if (newV === null || newV === undefined || newV === "") return null;
    const n = Number(newV);
    if (!Number.isFinite(n)) return null;
    if (oldV === null || oldV === undefined || oldV === "") return "exists";
    const o = Number(oldV);
    if (!Number.isFinite(o)) return "exists";
    const d = n - o;
    if (Math.abs(d) < 0.01) return "exists";
    return d > 0 ? "increased" : "decreased";
  };

  const has = (k: string) => Object.prototype.hasOwnProperty.call(patchIn, k);

  if (has("senzey_price") && !CLOSED_STATUSES.has(prev.senzey_status ?? "")) {
    const s = decide(prev.senzey_price, patchIn.senzey_price);
    if (s && s !== prev.senzey_status) patch.senzey_status = s;
  }
  if (has("site_price") && !CLOSED_STATUSES.has(prev.site_status ?? "")) {
    const s = decide(prev.site_price, patchIn.site_price);
    if (s && s !== prev.site_status) patch.site_status = s;
  }
  return patch;
}


export function shekel(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return "₪" + Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 });
}



export function slugify(s: string) {
  return s.trim().replace(/\s+/g, "-").slice(0, 60);
}

export function computePrice(
  family: Family | undefined,
  w: number,
  h: number,
  qty: number,
) {
  const rate = family?.rate_m2 ?? 0;
  const min = family?.min_charge ?? 0;
  const area = (w * h) / 10000;
  const raw = rate * area;
  const beforeDiscount = Math.max(raw, min);
  const tiers = (family?.qty_discounts ?? [])
    .filter((t) => qty >= t.min)
    .sort((a, b) => b.min - a.min);
  const mult = tiers[0]?.mult ?? 1;
  const unit = Math.round(beforeDiscount * mult);
  return {
    area,
    raw,
    min,
    beforeDiscount,
    mult,
    unit,
    total: unit * qty,
    tier: tiers[0] ?? null,
  };
}

/** Reference bundle size all anchor prices are normalised to. */
export const QTY_REF = 1000;

export const DEFAULT_QTY_EXPONENT = 0.85;

export type Anchor = {
  area: number;
  /** the real catalog price, for the bundle quantity below */
  price: number;
  /** bundle quantity this price is for */
  qty: number;
  /** price normalised to QTY_REF units */
  refPrice: number;
  w: number;
  h: number;
  fromFinal: boolean;
  name?: string;
  /** true when the user explicitly pinned this item as the family's עוגן */
  pinned?: boolean;
  id?: string;
};

/** Where the family curve came from. */
export type FitSource = "anchors" | "single-anchor" | "all-items";

export const FIT_SOURCE_LABEL: Record<FitSource, string> = {
  anchors: "עקומה מעוגנים שסימנת",
  "single-anchor": "עקומה מעוגן יחיד (מחיר יחסי לשטח)",
  "all-items": "עקומה מכל פריטי המשפחה",
};


export type AnchorPricing = {
  unit: number;
  total: number;
  basis: "catalog" | "catalog-scaled" | "line" | "rate";
  label: string;
  detail: string | null;
  anchors: Anchor[];
  skipped: number;
  mult: number;
  tier: QtyDiscount | null;
  minApplied: boolean;
  floorApplied: boolean;
  base: number;
};

const sizeLabel = (a: Anchor) => `${a.w}×${a.h}`;

const median = (nums: number[]) => {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
};

/** quantity scaling factor relative to the 1000-unit reference */
export const qtyFactor = (qty: number, c: number) =>
  Math.pow(Math.max(1, qty) / QTY_REF, c);

export type QtyExponentFit = {
  c: number;
  /** number of same-size groups that contributed a slope */
  groups: number;
};

/**
 * Fit the family's volume-discount exponent: log(price) vs log(qty) inside
 * groups of identical size, median of the per-group slopes, clamped to 0.3–1.
 */
export function fitQtyExponent(products: Product[], family: string): QtyExponentFit {
  const groups = new Map<string, { qty: number; price: number }[]>();
  for (const p of products) {
    if (p.family !== family || isClosedOut(p)) continue;
    const w = Number(p.width_cm);
    const h = Number(p.height_cm);
    const qty = Number(p.qty);
    const price = Number(p.final_price ?? p.senzey_price);
    if (!w || !h || !qty || qty < 1 || !price || price <= 0) continue;
    const key = `${w}x${h}`;
    const arr = groups.get(key) ?? [];
    arr.push({ qty, price });
    groups.set(key, arr);
  }
  const slopes: number[] = [];
  for (const arr of groups.values()) {
    const uniq = new Map<number, number>();
    for (const it of arr) {
      const prev = uniq.get(it.qty);
      if (prev === undefined || it.price < prev) uniq.set(it.qty, it.price);
    }
    const pts = [...uniq.entries()].map(([qty, price]) => ({
      x: Math.log(qty),
      y: Math.log(price),
    }));
    if (pts.length < 2) continue;
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p.x, 0) / n;
    const my = pts.reduce((s, p) => s + p.y, 0) / n;
    let num = 0;
    let den = 0;
    for (const p of pts) {
      num += (p.x - mx) * (p.y - my);
      den += (p.x - mx) ** 2;
    }
    if (den === 0) continue;
    const slope = num / den;
    if (!Number.isFinite(slope)) continue;
    slopes.push(slope);
  }
  if (slopes.length === 0) return { c: DEFAULT_QTY_EXPONENT, groups: 0 };
  const c = Math.min(1, Math.max(0.3, median(slopes)));
  return { c: Math.round(c * 100) / 100, groups: slopes.length };
}

/**
 * Build price anchors for a family, normalised to QTY_REF units.
 * When the user pinned items as עוגן, ONLY those define the curve (verbatim).
 * Otherwise falls back to all sized+priced items, dropping anomalies whose
 * normalised price-per-m² deviates more than ×2.5 from the family median.
 */
export function buildAnchors(
  products: Product[],
  family: string,
  c: number = DEFAULT_QTY_EXPONENT,
): { anchors: Anchor[]; skipped: number; dropped: Anchor[]; source: FitSource } {
  const toAnchor = (p: Product): Anchor | null => {
    const w = Number(p.width_cm);
    const h = Number(p.height_cm);
    if (!w || !h) return null;
    const qty = Math.max(1, Number(p.qty) || 0);
    if (!Number(p.qty)) return null;
    const fromFinal = p.final_price !== null && p.final_price !== undefined;
    const price = Number(fromFinal ? p.final_price : p.senzey_price);
    if (!price || Number.isNaN(price) || price <= 0) return null;
    return {
      area: (w * h) / 10000,
      price,
      qty,
      refPrice: price / qtyFactor(qty, c),
      w,
      h,
      fromFinal,
      name: p.name,
      id: p.id,
      pinned: !!p.is_anchor,
    };
  };

  const fam = products.filter((p) => p.family === family && !isClosedOut(p));

  // 1. Pinned anchors win outright.
  const pinned = fam
    .filter((p) => p.is_anchor)
    .map(toAnchor)
    .filter((a): a is Anchor => a !== null)
    .sort((a, b) => a.area - b.area);
  if (pinned.length > 0) {
    return {
      anchors: pinned,
      skipped: 0,
      dropped: [],
      source: pinned.length === 1 ? "single-anchor" : "anchors",
    };
  }

  // 2. Fallback: derive from the whole family (any bundle quantity).
  const byKey = new Map<string, Anchor>();
  for (const p of fam) {
    const cand = toAnchor(p);
    if (!cand) continue;
    const key = `${cand.area.toFixed(4)}|${cand.qty}`;
    const prev = byKey.get(key);
    if (
      !prev ||
      (cand.fromFinal && !prev.fromFinal) ||
      (cand.fromFinal === prev.fromFinal && cand.price < prev.price)
    ) {
      byKey.set(key, cand);
    }
  }
  const all = [...byKey.values()].sort((a, b) => a.area - b.area);
  if (all.length < 3) return { anchors: all, skipped: 0, dropped: [], source: "all-items" };

  const med = median(all.map((a) => a.refPrice / a.area));
  const keep = (a: Anchor) => {
    const ppm = a.refPrice / a.area;
    return ppm <= med * 2.5 && ppm >= med / 2.5;
  };
  const anchors = all.filter(keep);
  const dropped = all.filter((a) => !keep(a));
  return { anchors, skipped: dropped.length, dropped, source: "all-items" };
}


export type FamilyFit = {
  base: number;
  rate: number;
  /** average absolute % deviation of anchors from the fitted line */
  deviation: number;
  count: number;
};

/**
 * Least-squares fit of refPrice (price at QTY_REF units) = base + rate × area,
 * with base clamped to >= 0.
 */
export function fitFamilyLine(anchors: Anchor[]): FamilyFit | null {
  const n = anchors.length;
  if (n === 0) return null;
  let base = 0;
  let rate = 0;
  if (n === 1) {
    rate = anchors[0]!.refPrice / anchors[0]!.area;
  } else {
    const mx = anchors.reduce((s, a) => s + a.area, 0) / n;
    const my = anchors.reduce((s, a) => s + a.refPrice, 0) / n;
    let num = 0;
    let den = 0;
    for (const a of anchors) {
      num += (a.area - mx) * (a.refPrice - my);
      den += (a.area - mx) ** 2;
    }
    rate = den === 0 ? my / (mx || 1) : num / den;
    base = my - rate * mx;
    if (base < 0 || rate <= 0) {
      // refit through the origin
      base = 0;
      const sxx = anchors.reduce((s, a) => s + a.area * a.area, 0);
      const sxy = anchors.reduce((s, a) => s + a.area * a.refPrice, 0);
      rate = sxx === 0 ? 0 : sxy / sxx;
    }
  }
  const deviation =
    anchors.reduce((s, a) => {
      const fit = base + rate * a.area;
      return s + Math.abs(fit - a.refPrice) / a.refPrice;
    }, 0) /
    n *
    100;
  return {
    base: Math.round(base * 100) / 100,
    rate: Math.round(rate * 100) / 100,
    deviation,
    count: n,
  };
}

const round5 = (n: number) => Math.round(n / 5) * 5;

/**
 * Price a requested size + bundle quantity from the fitted family curve:
 * price = (base + rate × area) × (qty / 1000)^c
 */
export function priceFromLine(
  anchors: Anchor[],
  skipped: number,
  family: Family | undefined,
  fit: FamilyFit | null,
  w: number,
  h: number,
  qty: number,
  c: number = DEFAULT_QTY_EXPONENT,
): AnchorPricing {
  const area = (w * h) / 10000;
  const min = family?.min_charge ?? 0;
  const base = fit ? fit.base : 0;
  const rate = fit ? fit.rate : (family?.rate_m2 ?? 0);
  const f = qtyFactor(qty, c);
  const sameSize = anchors.filter((a) => Math.abs(a.area - area) <= a.area * 0.02);

  // exact catalog hit: same size AND same quantity
  const exact = sameSize.find((a) => a.qty === qty);
  if (exact && area) {
    const minApplied = exact.price < min;
    const unit = minApplied ? round5(Math.max(exact.price, min)) : exact.price;
    return {
      unit,
      total: unit,
      basis: "catalog",
      label: "מחיר קטלוג",
      detail: `נמצאה מידה וכמות זהות במחירון: ${sizeLabel(exact)} · ${exact.qty.toLocaleString()} יח׳ = ${shekel(exact.price)}`,
      anchors: [exact],
      skipped,
      mult: 1,
      tier: null,
      minApplied,
      floorApplied: false,
      base: exact.price,
    };
  }

  // same size, different quantity: scale the catalog price by the volume curve
  const near = sameSize.sort(
    (a, b) => Math.abs(Math.log(a.qty / qty)) - Math.abs(Math.log(b.qty / qty)),
  )[0];
  if (near && area) {
    const scaled = near.price * (qtyFactor(qty, c) / qtyFactor(near.qty, c));
    const minApplied = scaled < min;
    const unit = round5(Math.max(scaled, min));
    return {
      unit,
      total: unit,
      basis: "catalog-scaled",
      label: "מחיר קטלוג מותאם לכמות",
      detail: `${sizeLabel(near)} · ${near.qty.toLocaleString()} יח׳ = ${shekel(near.price)} → מותאם ל־${qty.toLocaleString()} יח׳ (מקדם כמות ${c})`,
      anchors: [near],
      skipped,
      mult: 1,
      tier: null,
      minApplied,
      floorApplied: false,
      base: scaled,
    };
  }

  const refPrice = base + rate * area;
  const raw = refPrice * f;
  const cheapest = anchors.length
    ? anchors.reduce((m, a) => Math.min(m, a.refPrice), Infinity) * f
    : 0;
  const floorApplied = cheapest > 0 && raw < cheapest;
  const afterFloor = Math.max(raw, cheapest);
  const minApplied = afterFloor < min;
  const beforeMin = Math.max(afterFloor, min);
  const unit = round5(beforeMin);

  return {
    unit,
    total: unit,
    basis: fit ? "line" : "rate",
    label: fit ? "מחיר מחושב" : "חישוב לפי תעריף לסמ״ר",
    detail: `מחיר ל־${QTY_REF.toLocaleString()} יח׳: בסיס ${shekel(base)} + ${(rate / 10000).toFixed(4)}₪ לסמ״ר × ${Math.round(area * 10000).toLocaleString()} סמ״ר = ${shekel(Math.round(refPrice))} → מותאם ל־${qty.toLocaleString()} יח׳ (מקדם ${c}) = ${shekel(Math.round(raw))}`,
    anchors: [],
    skipped,
    mult: 1,
    tier: null,
    minApplied,
    floorApplied,
    base: raw,
  };
}

/* ------------------------------------------------------------------ *
 * Power curve: price = a × area^b  (b < 1 → sub-linear, print-typical)
 * ------------------------------------------------------------------ */

export const DEFAULT_CURVE_EXPONENT = 0.6;

export type FamilyCurve = {
  /** price at 1 m² for QTY_REF units */
  a: number;
  /** area exponent */
  b: number;
  /** average absolute % deviation of anchors from the curve */
  deviation: number;
  count: number;
};

/** Least-squares fit of log(refPrice) = log a + b·log(area), b clamped to 0.3–1. */
export function fitPowerCurve(anchors: Anchor[]): FamilyCurve | null {
  const pts = anchors.filter((x) => x.area > 0 && x.refPrice > 0);
  const n = pts.length;
  if (n === 0) return null;
  let b = DEFAULT_CURVE_EXPONENT;
  let a: number;
  if (n === 1) {
    a = pts[0]!.refPrice / Math.pow(pts[0]!.area, b);
  } else {
    const xs = pts.map((p) => Math.log(p.area));
    const ys = pts.map((p) => Math.log(p.refPrice));
    const mx = xs.reduce((s, v) => s + v, 0) / n;
    const my = ys.reduce((s, v) => s + v, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (xs[i]! - mx) * (ys[i]! - my);
      den += (xs[i]! - mx) ** 2;
    }
    const slope = den === 0 ? DEFAULT_CURVE_EXPONENT : num / den;
    b = Math.min(1, Math.max(0.3, Number.isFinite(slope) ? slope : DEFAULT_CURVE_EXPONENT));
    a = Math.exp(my - b * mx);
  }
  const deviation =
    (pts.reduce((s, p) => {
      const fitv = a * Math.pow(p.area, b);
      return s + Math.abs(fitv - p.refPrice) / p.refPrice;
    }, 0) /
      n) *
    100;
  return { a: Math.round(a * 100) / 100, b: Math.round(b * 1000) / 1000, deviation, count: n };
}

/** Evaluate the piecewise curve (exact through anchors) at a given area. */
export function curveRefPrice(
  anchors: Anchor[],
  curve: FamilyCurve | null,
  area: number,
): { ref: number; lo: Anchor | null; hi: Anchor | null; b: number } {
  const fallbackB = curve?.b ?? DEFAULT_CURVE_EXPONENT;
  if (area <= 0) return { ref: 0, lo: null, hi: null, b: fallbackB };
  const pts = anchors
    .filter((x) => x.area > 0 && x.refPrice > 0)
    .sort((x, y) => x.area - y.area);
  if (pts.length === 0) {
    return { ref: curve ? curve.a * Math.pow(area, curve.b) : 0, lo: null, hi: null, b: fallbackB };
  }
  if (pts.length === 1) {
    const p = pts[0]!;
    return {
      ref: p.refPrice * Math.pow(area / p.area, fallbackB),
      lo: p,
      hi: null,
      b: fallbackB,
    };
  }
  const seg = (lo: Anchor, hi: Anchor) => {
    const b =
      lo.area === hi.area
        ? fallbackB
        : Math.log(hi.refPrice / lo.refPrice) / Math.log(hi.area / lo.area);
    const bb = Number.isFinite(b) ? b : fallbackB;
    return { ref: lo.refPrice * Math.pow(area / lo.area, bb), lo, hi, b: bb };
  };
  if (area <= pts[0]!.area) return seg(pts[0]!, pts[1]!);
  if (area >= pts[pts.length - 1]!.area) return seg(pts[pts.length - 2]!, pts[pts.length - 1]!);
  for (let i = 0; i < pts.length - 1; i++) {
    if (area >= pts[i]!.area && area <= pts[i + 1]!.area) return seg(pts[i]!, pts[i + 1]!);
  }
  return seg(pts[0]!, pts[1]!);
}

/**
 * Price a requested size + bundle quantity from the family's power curve:
 * refPrice interpolated geometrically between neighbouring anchors,
 * then scaled by the volume factor (qty / QTY_REF)^c.
 */
export function priceFromCurve(
  anchors: Anchor[],
  skipped: number,
  family: Family | undefined,
  curve: FamilyCurve | null,
  w: number,
  h: number,
  qty: number,
  c: number = DEFAULT_QTY_EXPONENT,
): AnchorPricing {
  const area = (w * h) / 10000;
  const min = family?.min_charge ?? 0;
  const f = qtyFactor(qty, c);
  const sameSize = anchors.filter((a) => Math.abs(a.area - area) <= a.area * 0.02);

  const exact = sameSize.find((a) => a.qty === qty);
  if (exact && area) {
    const minApplied = exact.price < min;
    const unit = minApplied ? round5(Math.max(exact.price, min)) : exact.price;
    return {
      unit,
      total: unit,
      basis: "catalog",
      label: "מחיר קטלוג",
      detail: `נמצאה מידה וכמות זהות במחירון: ${sizeLabel(exact)} · ${exact.qty.toLocaleString()} יח׳ = ${shekel(exact.price)}`,
      anchors: [exact],
      skipped,
      mult: 1,
      tier: null,
      minApplied,
      floorApplied: false,
      base: exact.price,
    };
  }

  const near = sameSize.sort(
    (a, b) => Math.abs(Math.log(a.qty / qty)) - Math.abs(Math.log(b.qty / qty)),
  )[0];
  if (near && area) {
    const scaled = near.price * (qtyFactor(qty, c) / qtyFactor(near.qty, c));
    const minApplied = scaled < min;
    const unit = round5(Math.max(scaled, min));
    return {
      unit,
      total: unit,
      basis: "catalog-scaled",
      label: "מחיר קטלוג מותאם לכמות",
      detail: `${sizeLabel(near)} · ${near.qty.toLocaleString()} יח׳ = ${shekel(near.price)} → מותאם ל־${qty.toLocaleString()} יח׳ (מקדם כמות ${c})`,
      anchors: [near],
      skipped,
      mult: 1,
      tier: null,
      minApplied,
      floorApplied: false,
      base: scaled,
    };
  }

  if (anchors.length === 0 && !curve) {
    // no curve at all — legacy flat rate per m²
    const rate = family?.rate_m2 ?? 0;
    const raw = rate * area * f;
    const minApplied = raw < min;
    const unit = round5(Math.max(raw, min));
    return {
      unit,
      total: unit,
      basis: "rate",
      label: "חישוב לפי תעריף לסמ״ר",
      detail: `${(rate / 10000).toFixed(4)}₪ לסמ״ר × ${Math.round(area * 10000).toLocaleString()} סמ״ר`,
      anchors: [],
      skipped,
      mult: 1,
      tier: null,
      minApplied,
      floorApplied: false,
      base: raw,
    };
  }

  const { ref, lo, hi, b } = curveRefPrice(anchors, curve, area);
  const raw = ref * f;
  const cheapest = anchors.length
    ? anchors.reduce((m, a) => Math.min(m, a.refPrice), Infinity) * f
    : 0;
  const floorApplied = cheapest > 0 && raw < cheapest;
  const afterFloor = Math.max(raw, cheapest);
  const minApplied = afterFloor < min;
  const unit = round5(Math.max(afterFloor, min));

  const between =
    lo && hi
      ? `בין ${sizeLabel(lo)} (${shekel(Math.round(lo.refPrice * f))}) לבין ${sizeLabel(hi)} (${shekel(Math.round(hi.refPrice * f))})`
      : lo
        ? `מעוגן ${sizeLabel(lo)} (${shekel(Math.round(lo.refPrice * f))})`
        : `עקומה כללית`;

  return {
    unit,
    total: unit,
    basis: "line",
    label: "מחיר לפי עקומת חזקה",
    detail: `${between} · מעריך שטח ${b.toFixed(2)} · שטח מבוקש ${area.toFixed(3)} מ״ר${qty !== QTY_REF ? ` · מותאם ל־${qty.toLocaleString()} יח׳ (מקדם ${c})` : ""} = ${shekel(Math.round(raw))}`,
    anchors: [lo, hi].filter((x): x is Anchor => !!x),
    skipped,
    mult: 1,
    tier: null,
    minApplied,
    floorApplied,
    base: raw,
  };
}


export type ProductNote = {
  id: string;
  product_id: string;
  body: string;
  author: string | null;
  created_at: string;
  updated_at: string;
};
