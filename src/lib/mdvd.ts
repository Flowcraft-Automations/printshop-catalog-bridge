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
  min_charge: number | null;
  qty_discounts: QtyDiscount[] | null;
  notes: string | null;
};

export const STATUSES = [
  "exists",
  "to_review",
  "to_add",
  "in_progress",
  "done",
  "not_relevant",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  exists: "קיים",
  to_review: "לבחינה",
  to_add: "להוספה",
  in_progress: "בתהליך",
  done: "בוצע",
  not_relevant: "לא רלוונטי",
};

export const STATUS_CLASS: Record<string, string> = {
  exists: "bg-[oklch(0.93_0.005_250)] text-[oklch(0.42_0.01_250)] border-[oklch(0.86_0.008_250)]",
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
};

export type AnchorPricing = {
  unit: number;
  total: number;
  basis: "catalog" | "min-size" | "interpolated" | "extrapolated" | "rate";
  label: string;
  detail: string | null;
  anchors: Anchor[];
  skipped: number;
  mult: number;
  tier: QtyDiscount | null;
  minApplied: boolean;
  base: number;
};

const sizeLabel = (a: Anchor) => `${a.w}×${a.h}`;

/** Build monotonic price anchors from qty=1 products of a family. */
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
  const sorted = [...byArea.values()].sort((a, b) => a.area - b.area);
  const anchors: Anchor[] = [];
  let skipped = 0;
  for (const a of sorted) {
    const last = anchors[anchors.length - 1];
    if (last && a.price < last.price) {
      skipped++;
      continue;
    }
    anchors.push(a);
  }
  return { anchors, skipped };
}

const round5 = (n: number) => Math.round(n / 5) * 5;

export function priceFromAnchors(
  anchors: Anchor[],
  skipped: number,
  family: Family | undefined,
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

  const finish = (
    base: number,
    basis: AnchorPricing["basis"],
    label: string,
    detail: string | null,
    used: Anchor[],
    exact = false,
  ): AnchorPricing => {
    const minApplied = base < min;
    const floored = Math.max(base, min);
    const withDiscount = floored * mult;
    const unit = exact && !minApplied && mult === 1 ? floored : round5(withDiscount);
    return {
      unit,
      total: unit * qty,
      basis,
      label,
      detail,
      anchors: used,
      skipped,
      mult,
      tier,
      minApplied,
      base,
    };
  };

  if (anchors.length === 0 || !area) {
    const rate = family?.rate_m2 ?? 0;
    return finish(
      rate * area,
      "rate",
      "חישוב לפי תעריף למ״ר",
      `אין מחירי עוגן במשפחה — חושב לפי ${rate}₪ למ״ר × ${area.toFixed(3)} מ״ר`,
      [],
    );
  }

  const match = anchors.find((a) => Math.abs(a.area - area) <= a.area * 0.02);
  if (match) {
    return finish(
      match.price,
      "catalog",
      "מחיר קטלוג",
      `נמצאה מידה זהה במחירון: ${sizeLabel(match)} = ${shekel(match.price)}`,
      [match],
      true,
    );
  }

  const first = anchors[0]!;
  const last = anchors[anchors.length - 1]!;

  if (area < first.area) {
    return finish(
      first.price,
      "min-size",
      "מחיר מינימלי — המידה הקטנה במחירון",
      `המידה קטנה מהמידה הקטנה ביותר במחירון (${sizeLabel(first)} = ${shekel(first.price)})`,
      [first],
    );
  }

  if (area > last.area) {
    const prev = anchors[anchors.length - 2] ?? last;
    const slope =
      last.area === prev.area ? 0 : (last.price - prev.price) / (last.area - prev.area);
    return finish(
      last.price + slope * (area - last.area),
      "extrapolated",
      "מעבר למידה הגדולה במחירון — לבדיקה ידנית",
      `הורחב מהמדרגה האחרונה: ${sizeLabel(prev)} = ${shekel(prev.price)} עד ${sizeLabel(last)} = ${shekel(last.price)}`,
      [prev, last],
    );
  }

  let lo = first;
  let hi = last;
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]!;
    const b = anchors[i + 1]!;
    if (area >= a.area && area <= b.area) {
      lo = a;
      hi = b;
      break;
    }
  }
  const t = hi.area === lo.area ? 0 : (area - lo.area) / (hi.area - lo.area);
  return finish(
    lo.price + t * (hi.price - lo.price),
    "interpolated",
    "מחיר מחושב",
    `מחושב בין ${sizeLabel(lo)} = ${shekel(lo.price)} לבין ${sizeLabel(hi)} = ${shekel(hi.price)}`,
    [lo, hi],
  );
}

export type ProductNote = {
  id: string;
  product_id: string;
  body: string;
  author: string | null;
  created_at: string;
  updated_at: string;
};
