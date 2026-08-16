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
  cost_per_m2?: number | null;
  outsource_width_cm?: number | null;
  outsource_height_cm?: number | null;
  outsource_cost_per_m2?: number | null;
  notes: string | null;
  pricing_config?: unknown;
};

const num = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** "5x5" / "5x5" -> normalized key, order-insensitive. */
export function sizeKey(w: number, h: number) {
  const a = Math.max(w, h);
  const b = Math.min(w, h);
  return `${a}x${b}`;
}
function normalizeSizeText(s: string) {
  const parts = String(s)
    .replace(/[\u00d7*]/g, "x")
    .split("x")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n));
  if (parts.length !== 2) return String(s).trim();
  return sizeKey(parts[0] as number, parts[1] as number);
}

/** Printing sheet used for sticker nesting. */
export const SHEET_W_CM = 45;
export const SHEET_H_CM = 32;
export const SHEET_GAP_CM = 0.5;

export type BusinessConfig = {
  id: number;
  monthly_cost: number;
  monthly_revenue: number;
  overhead_factor: number;
};

export const DEFAULT_OVERHEAD_FACTOR = 2;


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


export type ProductNote = {
  id: string;
  product_id: string;
  body: string;
  author: string | null;
  created_at: string;
  updated_at: string;
};

/* ------------------------------------------------------------------ *
 * Anchor-based pricing engine (v3)
 * Per family: one method + threshold + 3–4 numbers + anchor table.
 * Anchors live in the catalog (products.is_anchor + price).
 * ------------------------------------------------------------------ */

export type FamilyMethod = "area" | "sheet";

export type FamilyPricing = {
  method: FamilyMethod;
  thresholdW: number;
  thresholdH: number;
  /** ₪/m² (area) or ₪ per sheet (sheet) — below the threshold */
  cost: number;
  /** ₪/m² (area) or ₪ per unit (sheet) — above the threshold */
  outsourceCost: number;
  margin: number;
  rounding: number;
  packages: number[];
  /** manual יחידות בגיליון per size key */
  sheetUnits: Record<string, number>;
};

export const DEFAULT_MARGIN = 1.3;
export const DEFAULT_ROUNDING = 5;

export function readFamilyPricing(family: Family | undefined): FamilyPricing {
  const raw = (family?.pricing_config ?? null) as Record<string, unknown> | null;
  const v = (raw?.["v3"] ?? null) as Record<string, unknown> | null;
  const su: Record<string, number> = {};
  const rawSu = (v?.["sheet_units"] ?? null) as Record<string, unknown> | null;
  if (rawSu && typeof rawSu === "object") {
    for (const [k, val] of Object.entries(rawSu)) {
      const n = num(val);
      if (n > 0) su[normalizeSizeText(k)] = Math.floor(n);
    }
  }
  return {
    method: v?.["method"] === "sheet" ? "sheet" : "area",
    thresholdW: num(family?.outsource_width_cm),
    thresholdH: num(family?.outsource_height_cm),
    cost: num(family?.cost_per_m2),
    outsourceCost: num(family?.outsource_cost_per_m2),
    margin: num(v?.["margin"]) > 0 ? num(v?.["margin"]) : DEFAULT_MARGIN,
    rounding: num(v?.["rounding"]) > 0 ? num(v?.["rounding"]) : DEFAULT_ROUNDING,
    packages: Array.isArray(v?.["packages"])
      ? (v?.["packages"] as unknown[]).map(num).filter((n) => n > 0).sort((a, b) => a - b)
      : [],
    sheetUnits: su,
  };
}

/** The pricing_config JSON to persist for a family. */
export function writeFamilyPricing(cfg: FamilyPricing) {
  return {
    v3: {
      method: cfg.method,
      margin: cfg.margin,
      rounding: cfg.rounding,
      packages: cfg.packages,
      sheet_units: cfg.sheetUnits,
    },
  };
}

/** Auto (geometric) יחידות בגיליון, ignoring manual overrides. */
export function autoUnitsPerSheet(w: number, h: number): number {
  if (w <= 0 || h <= 0) return 0;
  const g = SHEET_GAP_CM;
  const fit = (iw: number, ih: number) =>
    Math.floor((SHEET_W_CM + g) / (iw + g)) * Math.floor((SHEET_H_CM + g) / (ih + g));
  return Math.max(fit(w, h), fit(h, w));
}

export function sheetUnitsFor(cfg: FamilyPricing, w: number, h: number) {
  const key = sizeKey(w, h);
  const manual = cfg.sheetUnits[key];
  if (manual && manual > 0) return { units: manual, manual: true };
  return { units: autoUnitsPerSheet(w, h), manual: false };
}

export function fitsThreshold(cfg: FamilyPricing, w: number, h: number) {
  if (cfg.thresholdW <= 0 || cfg.thresholdH <= 0) return true;
  return Math.max(w, h) <= cfg.thresholdW && Math.min(w, h) <= cfg.thresholdH;
}

export type JobAnchor = {
  id: string;
  name: string;
  w: number;
  h: number;
  area: number;
  qty: number;
  price: number;
};

export function anchorPrice(p: Product): number | null {
  const v = p.final_price ?? p.senzey_price ?? p.site_price ?? null;
  return v !== null && Number(v) > 0 ? Number(v) : null;
}

/** Catalog anchors for a family, sorted by area then quantity. */
export function familyAnchors(products: Product[], family: string): JobAnchor[] {
  const out: JobAnchor[] = [];
  for (const p of products) {
    if (!p.is_anchor) continue;
    if ((p.family ?? "").trim() !== family.trim()) continue;
    const w = Number(p.width_cm) || 0;
    const h = Number(p.height_cm) || 0;
    const price = anchorPrice(p);
    if (!w || !h || price === null) continue;
    out.push({
      id: p.id,
      name: p.name,
      w,
      h,
      area: (w * h) / 10000,
      qty: Math.max(1, Number(p.qty) || 1),
      price,
    });
  }
  return out.sort((a, b) => a.area - b.area || a.qty - b.qty);
}

/** Drop anchors cheaper than a smaller one (type A). */
export function consistentAreaAnchors(anchors: JobAnchor[]) {
  const kept: JobAnchor[] = [];
  const bad: JobAnchor[] = [];
  for (const a of anchors) {
    const last = kept[kept.length - 1];
    if (last && a.price < last.price) bad.push(a);
    else kept.push(a);
  }
  return { kept, bad };
}

const roundUpTo = (v: number, step: number) =>
  step > 0 ? Math.ceil(v / step) * step : Math.round(v);

function interpolate(
  points: { x: number; y: number }[],
  x: number,
): { y: number; label: string } {
  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (points.length === 1) return { y: first.y, label: "עוגן יחיד" };
  if (x <= first.x) return { y: first.y, label: "מתחת לעוגן הקטן — מחיר העוגן" };
  if (x >= last.x) {
    const prev = points[points.length - 2]!;
    const slope = (last.y - prev.y) / (last.x - prev.x || 1);
    return { y: last.y + slope * (x - last.x), label: "מעל העוגן הגדול — המשך השיפוע" };
  }
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (x <= b.x) {
      const t = (x - a.x) / (b.x - a.x || 1);
      return { y: a.y + t * (b.y - a.y), label: "אינטרפולציה בין עוגנים" };
    }
  }
  return { y: last.y, label: "עוגן" };
}

export type JobPrice = {
  total: number;
  unit: number;
  above: boolean;
  /** direct production cost of the whole job */
  cost: number;
  /** the below-cost line: cost × מקדם */
  costFloorValue: number;
  belowCost: boolean;
  label: string;
  detail: string;
  sheets: number | null;
  unitsPerSheet: number | null;
  inconsistent: JobAnchor[];
  hasAnchors: boolean;
};

/** The one pricing entry point. */
export function priceJob(
  cfg: FamilyPricing,
  anchors: JobAnchor[],
  w: number,
  h: number,
  qty: number,
): JobPrice | null {
  if (!(w > 0) || !(h > 0)) return null;
  const units = Math.max(1, Math.round(qty) || 1);
  const area = (w * h) / 10000;
  const above = !fitsThreshold(cfg, w, h);
  const margin = cfg.margin > 0 ? cfg.margin : DEFAULT_MARGIN;

  const finish = (
    raw: number,
    cost: number,
    label: string,
    detail: string,
    extra: Partial<JobPrice> = {},
  ): JobPrice => {
    const total = roundUpTo(Math.max(raw, 0), cfg.rounding);
    const floorValue = cost * margin;
    return {
      total,
      unit: total / units,
      above,
      cost,
      costFloorValue: floorValue,
      belowCost: cost > 0 && total < floorValue - 0.001,
      label,
      detail,
      sheets: null,
      unitsPerSheet: null,
      inconsistent: [],
      hasAnchors: anchors.length > 0,
      ...extra,
    };
  };

  if (cfg.method === "sheet") {
    if (above) {
      const cost = cfg.outsourceCost * units;
      return finish(
        cost * margin,
        cost,
        "מעל הסף — מיקור חוץ",
        `${shekel(cfg.outsourceCost)} ליחידה × ${units.toLocaleString()} × מקדם ${margin}`,
      );
    }
    const per = sheetUnitsFor(cfg, w, h);
    const sheets = per.units > 0 ? units / per.units : 0;
    const cost = Math.ceil(sheets) * cfg.cost;
    const pts = anchors
      .map((a) => {
        const u = sheetUnitsFor(cfg, a.w, a.h).units;
        return u > 0 ? { x: a.qty / u, y: a.price } : null;
      })
      .filter((p): p is { x: number; y: number } => p !== null)
      .sort((a, b) => a.x - b.x);
    if (pts.length === 0 || sheets <= 0) {
      return finish(
        cost * margin,
        cost,
        "אין עוגנים — לפי עלות",
        `${Math.ceil(sheets)} גיליונות × ${shekel(cfg.cost)} × מקדם ${margin}`,
        { sheets, unitsPerSheet: per.units },
      );
    }
    const r = interpolate(pts, sheets);
    return finish(r.y, cost, r.label, `${sheets.toFixed(2)} גיליונות · ${per.units} יח׳ בגיליון`, {
      sheets,
      unitsPerSheet: per.units,
    });
  }

  // area method
  if (above) {
    const cost = cfg.outsourceCost * area * units;
    return finish(
      cost * margin,
      cost,
      "מעל הסף — מיקור חוץ",
      `${shekel(cfg.outsourceCost)} למ״ר × ${area.toFixed(2)} מ״ר × ${units.toLocaleString()} × מקדם ${margin}`,
    );
  }
  const cost = cfg.cost * area * units;
  const { kept, bad } = consistentAreaAnchors(anchors);
  if (kept.length === 0) {
    return finish(
      cost * margin,
      cost,
      "אין עוגנים — לפי עלות",
      `${shekel(cfg.cost)} למ״ר × ${area.toFixed(2)} מ״ר × מקדם ${margin}`,
      { inconsistent: bad },
    );
  }
  const exact = kept.find((a) => Math.abs(a.area - area) <= area * 0.02);
  if (exact) {
    return finish(exact.price * units, cost, "מחיר עוגן", `${exact.w}×${exact.h} = ${shekel(exact.price)}`, {
      inconsistent: bad,
    });
  }
  const largest = kept[kept.length - 1]!;
  if (area > largest.area) {
    const rate = largest.price / largest.area;
    return finish(
      rate * area * units,
      cost,
      "מעל העוגן הגדול — לפי ₪/מ״ר של העוגן",
      `${shekel(rate)} למ״ר × ${area.toFixed(2)} מ״ר`,
      { inconsistent: bad },
    );
  }
  const r = interpolate(
    kept.map((a) => ({ x: a.area, y: a.price })),
    area,
  );
  return finish(r.y * units, cost, r.label, `${area.toFixed(3)} מ״ר`, { inconsistent: bad });
}
