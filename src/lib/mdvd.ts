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
const BOOL_FIELDS = new Set(["senzey_exists", "site_exists", "verified"]);

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

export type QtyDiscount = { min: number; mult: number };

export type Family = {
  family: string;
  items_count: number | null;
  rate_m2: number | null;
  base_price: number | null;
  min_charge: number | null;
  qty_discounts: QtyDiscount[] | null;
  notes: string | null;
};

export const STATUSES = [
  "exists",
  "added",
  "deleted",
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
  increased: "bg-[oklch(0.94_0.08_50)] text-[oklch(0.45_0.15_45)] border-[oklch(0.86_0.1_50)]",
  decreased: "bg-[oklch(0.93_0.06_200)] text-[oklch(0.42_0.12_215)] border-[oklch(0.85_0.08_205)]",
  to_review: "bg-[oklch(0.94_0.09_95)] text-[oklch(0.42_0.09_75)] border-[oklch(0.86_0.11_92)]",
  to_add: "bg-[oklch(0.93_0.05_250)] text-[oklch(0.42_0.11_255)] border-[oklch(0.85_0.07_252)]",
  in_progress: "bg-[oklch(0.93_0.08_60)] text-[oklch(0.47_0.14_50)] border-[oklch(0.85_0.11_58)]",
  done: "bg-[oklch(0.93_0.07_155)] text-[oklch(0.42_0.1_155)] border-[oklch(0.84_0.09_155)]",
  not_relevant: "bg-[oklch(0.95_0_0)] text-[oklch(0.6_0_0)] border-[oklch(0.9_0_0)]",
};

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

export type Anchor = {
  area: number;
  price: number;
  w: number;
  h: number;
  fromFinal: boolean;
  name?: string;
};


export type AnchorPricing = {
  unit: number;
  total: number;
  basis: "catalog" | "line" | "rate";
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

/**
 * Build price anchors from qty=1 products of a family, dropping anomalies whose
 * price-per-m² deviates more than ×2.5 from the family median.
 */
export function buildAnchors(
  products: Product[],
  family: string,
): { anchors: Anchor[]; skipped: number } {
  const byArea = new Map<string, Anchor>();
  for (const p of products) {
    if (p.family !== family) continue;
    if ((p.qty ?? 1) !== 1) continue;
    const w = Number(p.width_cm);
    const h = Number(p.height_cm);
    if (!w || !h) continue;
    const fromFinal = p.final_price !== null && p.final_price !== undefined;
    const price = Number(fromFinal ? p.final_price : p.senzey_price);
    if (!price || Number.isNaN(price) || price <= 0) continue;
    const area = (w * h) / 10000;
    const cand: Anchor = { area, price, w, h, fromFinal };
    const key = area.toFixed(4);
    const prev = byArea.get(key);
    if (
      !prev ||
      (cand.fromFinal && !prev.fromFinal) ||
      (cand.fromFinal === prev.fromFinal && cand.price < prev.price)
    ) {
      byArea.set(key, cand);
    }
  }
  const all = [...byArea.values()].sort((a, b) => a.area - b.area);
  if (all.length < 3) return { anchors: all, skipped: 0 };

  const med = median(all.map((a) => a.price / a.area));
  const anchors = all.filter((a) => {
    const ppm = a.price / a.area;
    return ppm <= med * 2.5 && ppm >= med / 2.5;
  });
  return { anchors, skipped: all.length - anchors.length };
}

export type FamilyFit = {
  base: number;
  rate: number;
  /** average absolute % deviation of anchors from the fitted line */
  deviation: number;
  count: number;
};

/** Least-squares fit of price = base + rate × area, with base clamped to >= 0. */
export function fitFamilyLine(anchors: Anchor[]): FamilyFit | null {
  const n = anchors.length;
  if (n === 0) return null;
  let base = 0;
  let rate = 0;
  if (n === 1) {
    rate = anchors[0]!.price / anchors[0]!.area;
  } else {
    const mx = anchors.reduce((s, a) => s + a.area, 0) / n;
    const my = anchors.reduce((s, a) => s + a.price, 0) / n;
    let num = 0;
    let den = 0;
    for (const a of anchors) {
      num += (a.area - mx) * (a.price - my);
      den += (a.area - mx) ** 2;
    }
    rate = den === 0 ? my / (mx || 1) : num / den;
    base = my - rate * mx;
    if (base < 0 || rate <= 0) {
      // refit through the origin
      base = 0;
      const sxx = anchors.reduce((s, a) => s + a.area * a.area, 0);
      const sxy = anchors.reduce((s, a) => s + a.area * a.price, 0);
      rate = sxx === 0 ? 0 : sxy / sxx;
    }
  }
  const deviation =
    anchors.reduce((s, a) => {
      const fit = base + rate * a.area;
      return s + Math.abs(fit - a.price) / a.price;
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

/** Price a requested size from a line fitted live from the family's items. */
export function priceFromLine(
  anchors: Anchor[],
  skipped: number,
  family: Family | undefined,
  fit: FamilyFit | null,
  w: number,
  h: number,
  qty: number,
): AnchorPricing {
  const area = (w * h) / 10000;
  const tiers = (family?.qty_discounts ?? [])
    .filter((t) => qty >= t.min)
    .sort((a, b) => b.min - a.min);
  const tier = tiers[0] ?? null;
  const mult = tier?.mult ?? 1;
  const min = family?.min_charge ?? 0;
  const base = fit ? fit.base : 0;
  const rate = fit ? fit.rate : (family?.rate_m2 ?? 0);

  const match = anchors.find((a) => Math.abs(a.area - area) <= a.area * 0.02);
  if (match && area) {
    const minApplied = match.price < min;
    const floored = Math.max(match.price, min);
    const unit = minApplied || mult !== 1 ? round5(floored * mult) : floored;
    return {
      unit,
      total: unit * qty,
      basis: "catalog",
      label: "מחיר קטלוג",
      detail: `נמצאה מידה זהה במחירון: ${sizeLabel(match)} = ${shekel(match.price)}`,
      anchors: [match],
      skipped,
      mult,
      tier,
      minApplied,
      floorApplied: false,
      base: match.price,
    };
  }

  const raw = base + rate * area;
  const cheapest = anchors.length
    ? anchors.reduce((m, a) => Math.min(m, a.price), Infinity)
    : 0;
  const floorApplied = cheapest > 0 && raw < cheapest;
  const afterFloor = Math.max(raw, cheapest);
  const minApplied = afterFloor < min;
  const beforeDiscount = Math.max(afterFloor, min);
  const unit = round5(beforeDiscount * mult);

  return {
    unit,
    total: unit * qty,
    basis: fit ? "line" : "rate",
    label: fit ? "מחיר מחושב" : "חישוב לפי תעריף לסמ״ר",
    detail: `מחיר בסיס ${shekel(base)} + ${(rate / 10000).toFixed(4)}₪ לסמ״ר × ${Math.round(area * 10000).toLocaleString()} סמ״ר = ${shekel(Math.round(raw))}`,
    anchors: [],
    skipped,
    mult,
    tier,
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
