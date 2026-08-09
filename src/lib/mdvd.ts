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

export type QtyDiscount = { min: number; mult: number };

export type Family = {
  family: string;
  items_count: number | null;
  rate_m2: number | null;
  base_price: number | null;
  min_charge: number | null;
  qty_discounts: QtyDiscount[] | null;
  qty_exponent?: number | null;
  notes: string | null;
};

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
    if (p.family !== family) continue;
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

export type ProductNote = {
  id: string;
  product_id: string;
  body: string;
  author: string | null;
  created_at: string;
  updated_at: string;
};
