import { parseNumber } from "./parse";

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
  if (field === "senzey_status" || field === "site_status") return STATUS_LABEL[value] ?? value;
  return value;
}

/** Stable, visually distinct color for a family name. */
const FAMILY_PALETTE = [
  "oklch(0.62 0.16 25)", // red
  "oklch(0.62 0.16 55)", // orange
  "oklch(0.62 0.16 95)", // yellow-green
  "oklch(0.62 0.16 145)", // green
  "oklch(0.62 0.16 190)", // teal
  "oklch(0.62 0.16 250)", // blue
  "oklch(0.62 0.16 290)", // indigo
  "oklch(0.62 0.16 330)", // pink
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

const num = (v: unknown) => parseNumber(v) ?? 0;

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
  dup_deleted:
    "bg-[oklch(0.92_0.05_320)] text-[oklch(0.44_0.14_325)] border-[oklch(0.84_0.08_322)]",
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
  return CLOSED_STATUSES.has(p.senzey_status ?? "") && CLOSED_STATUSES.has(p.site_status ?? "");
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
  /** מ״ר מינימלי לחיוב לכל יחידה (מעל הסף) */
  minUnitArea: number;
  /** ריצה קצרה: אחוז ממחיר החבילה הקטנה ביותר עבור יחידה בודדת (שיטת גיליון) */
  shortRunPct: number;
  /** מקדם כמות: העלות מוכפלת ב-units^qtyExponent (1 = ליניארי, <1 = הנחת כמות) */
  qtyExponent: number;
  /** true when the user pinned מקדם כמות instead of letting it be fitted */
  qtyExponentPinned: boolean;
  /** מדרגות כמות: מחיר קבוע ליחידה מכמות מסוימת ומעלה — גובר על מקדם כמות */
  qtyTiersEnabled: boolean;
  qtyTiers: QtyTier[];
  /** manual יחידות בגיליון per size key */
  sheetUnits: Record<string, number>;
  /** גיליון הדפסה — מידות, שוליים לא מודפסים ומרווח בין יחידות (ס"מ) */
  sheetW: number;
  sheetH: number;
  sheetMargin: number;
  sheetGap: number;
  /** מינימום הזמנה ביחידות (0 = ללא מינימום) */
  minOrderQty: number;
  /** מגבלות מכונה — גבול הדפסה: רוחב / אורך בס"מ (0 = ללא הגבלה) */
  maxPrintW: number;
  maxPrintL: number;
  /** ההתנהגות מעל גבול ההדפסה */
  overLimit: OverLimit;
  /** עלות הדבקה ₪ למ״ר / ₪ ליחידה (רלוונטי ל"הדבקת ויניל על הלוח") */
  mountCostM2: number;
  mountCostUnit: number;
  /** גבול ייצור מוחלט (ס"מ) — מעליו לא ניתן לייצר בכלל (0 = ללא) */
  capW: number;
  capL: number;
  /** חיוב חומר לפי לוח שלם (למשל קאפה — השארית נזרקת) */
  wholeBoard: boolean;
  boardW: number;
  boardH: number;

  /* --- v3.1: five-engine architecture --- */
  /** מנוע התמחור של המשפחה */
  engine: EngineKind;
  /** true כשהתצורה נשמרה לפני שדה המנוע (משפחה לא ממוגרת) */
  legacy: boolean;
  /** כמות הייחוס של רמפת הריצה הקצרה — קבועה (מדבקות 100, פליירים 10) */
  shortRunRefQty: number;
  /** מינימום הזמנה בשקלים כולל מע״מ (0 = ללא) */
  minOrderValue: number;
  /** תוספת דו-צדדי לפי כמות (maxQty=null = המדרגה העליונה) */
  dualSurcharge: DualTier[];
  /** מקדם רצפת מיקור חוץ (מחיר = תעריף חוץ × שטח × מקדם) */
  outsourcedMarginFactor: number;
  /** האם תעריף מיקור החוץ כולל מע״מ; null = לא ידוע (TODO ללקוח) */
  outsourcedVatIncluded: boolean | null;
  /** תוספת לפי משקל נייר, למשל {"170": 0.08} */
  paperWeightPct: Record<string, number>;
  /** דליי גודל למנוע עקומת עוגנים */
  sizeBuckets: SizeBucket[];
  /** מקדמי כמות על בסיס 100 (מדבקות) */
  qtyMultipliers: QtyMult[];
  /** נקודות עקומה מפורשות; size = מזהה דלי */
  curveAnchors: { size: string; qty: number; price: number }[];
  /** ₪ ליחידה מעל הכמות הגדולה בעקומה (פליירים 0.05, מוכפל במקדם הדלי) */
  tailPerUnit: number | null;
  /** מדרגות ₪/מ״ר לפי שטח (שמשונית) */
  perM2Tiers: PerM2Tier[];
  /** מחיר מינימלי לעבודה עד minUnitArea מ״ר (שמשונית ₪65) */
  minJobPrice: number;
  /** סולם מידות (PVC / פוליגל / קנבס / זכוכית) */
  sizeLadder: { w: number; h: number; price: number }[];
  /** תוספת פנורמית: יחס ≥ panoramicAspect → +panoramicPct (קנבס 2.4 / 10%) */
  panoramicAspect: number;
  panoramicPct: number;
  /** טבלת תפוקה לקאפה — ריק = TODO, נופל לעלות×מקדם */
  yieldTable: YieldRow[];
  /** עלות ויניל ₪ לגיליון (קאפה 6) */
  vinylCostPerSheet: number;
  /** מחירי מבנה קבועים (חשבוניות/פנקסים) */
  formatPrices: FormatPrice[];
  /** נוסחת דיגיטל להצעה חלופית (פליירים: 72 + 0.32 ליחידה עד 1000) */
  digitalSetup: number;
  digitalPerUnit: number;
  digitalMaxQty: number;
  /** הערות TODO מהתצורה — מוצגות בממשק */
  todos: string[];
};

/** מה קורה מעל גבול ההדפסה */
export type OverLimit = "weld" | "mount" | "block";

/** מדרגת כמות — מכמות minQty ומעלה, מחיר קבוע ליחידה. size ריק = כל המידות. */
export type QtyTier = {
  minQty: number;
  unitPrice: number;
  /** normalized "WxH" size key, or "" for every size in the family */
  size: string;
};

export const DEFAULT_MARGIN = 1.3;
export const DEFAULT_ROUNDING = 1;

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
      ? (v?.["packages"] as unknown[])
          .map(num)
          .filter((n) => n > 0)
          .sort((a, b) => a - b)
      : [],
    minUnitArea: num(v?.["min_unit_area"]) > 0 ? num(v?.["min_unit_area"]) : 1,
    shortRunPct:
      num(v?.["short_run_pct"]) > 0 && num(v?.["short_run_pct"]) <= 1
        ? num(v?.["short_run_pct"])
        : 0.7,
    qtyExponent: num(v?.["qty_exponent"]) > 0 ? num(v?.["qty_exponent"]) : 1,
    qtyExponentPinned: num(v?.["qty_exponent"]) > 0,
    qtyTiersEnabled: v?.["qty_tiers_enabled"] === true,
    qtyTiers: Array.isArray(v?.["qty_tiers"])
      ? (v?.["qty_tiers"] as unknown[])
          .map((t) => {
            const o = (t ?? {}) as Record<string, unknown>;
            const sizeRaw = String(o["size"] ?? "").trim();
            return {
              minQty: Math.max(1, Math.floor(num(o["min_qty"]))),
              unitPrice: num(o["unit_price"]),
              size: sizeRaw ? normalizeSizeText(sizeRaw) : "",
            };
          })
          .filter((t) => t.minQty > 0 && t.unitPrice > 0)
          .sort((a, b) => a.minQty - b.minQty)
      : [],
    sheetUnits: su,
    sheetW: num(v?.["sheet_w"]) > 0 ? num(v?.["sheet_w"]) : SHEET_W_CM,
    sheetH: num(v?.["sheet_h"]) > 0 ? num(v?.["sheet_h"]) : SHEET_H_CM,
    sheetMargin: num(v?.["sheet_margin"]) >= 0 ? num(v?.["sheet_margin"]) : 0,
    sheetGap:
      num(v?.["sheet_gap"]) >= 0 && v?.["sheet_gap"] != null ? num(v?.["sheet_gap"]) : SHEET_GAP_CM,
    minOrderQty: Math.max(0, Math.floor(num(v?.["min_order_qty"]))),
    ...(() => {
      /* legacy keys: weldable + separate mount_w/mount_h boundary */
      const legacyMountW = Math.max(0, num(v?.["mount_w"]));
      const legacyMountH = Math.max(0, num(v?.["mount_h"]));
      const raw = String(v?.["over_limit"] ?? "");
      const overLimit: OverLimit =
        raw === "weld" || raw === "mount" || raw === "block"
          ? raw
          : legacyMountW > 0 && legacyMountH > 0
            ? "mount"
            : v?.["weldable"] === false
              ? "block"
              : "weld";
      const useLegacyBoundary = !raw && overLimit === "mount";
      return {
        maxPrintW: useLegacyBoundary
          ? Math.min(legacyMountW, legacyMountH)
          : Math.max(0, num(v?.["max_print_w"])),
        maxPrintL: useLegacyBoundary
          ? Math.max(legacyMountW, legacyMountH)
          : Math.max(0, num(v?.["max_print_l"])),
        overLimit,
      };
    })(),
    mountCostM2: Math.max(0, num(v?.["mount_cost_m2"])),
    mountCostUnit: Math.max(0, num(v?.["mount_cost_unit"])),
    capW: Math.max(0, num(v?.["cap_w"])),
    capL: Math.max(0, num(v?.["cap_l"])),
    wholeBoard: v?.["whole_board"] === true,
    boardW: Math.max(0, num(v?.["board_w"])),
    boardH: Math.max(0, num(v?.["board_h"])),

    /* --- v3.1 --- */
    ...(() => {
      const rawEngine = v?.["engine"];
      const engine: EngineKind = isEngineKind(rawEngine)
        ? rawEngine
        : v?.["method"] === "sheet"
          ? "anchor_curve"
          : "per_m2";
      return { engine, legacy: !isEngineKind(rawEngine) };
    })(),
    shortRunRefQty:
      num(v?.["short_run_ref_qty"]) > 0 ? Math.floor(num(v?.["short_run_ref_qty"])) : 100,
    minOrderValue: Math.max(0, num(v?.["min_order_value"])),
    dualSurcharge: Array.isArray(v?.["dual_surcharge"])
      ? (v?.["dual_surcharge"] as unknown[])
          .map((t) => {
            const o = (t ?? {}) as Record<string, unknown>;
            return {
              maxQty: o["max_qty"] == null ? null : Math.max(1, Math.floor(num(o["max_qty"]))),
              pct: num(o["pct"]),
            };
          })
          .filter((t) => t.pct > 0)
      : [],
    outsourcedMarginFactor:
      num(v?.["outsourced_margin_factor"]) > 0 ? num(v?.["outsourced_margin_factor"]) : 1.5,
    outsourcedVatIncluded:
      v?.["outsourced_vat_incl"] === true
        ? true
        : v?.["outsourced_vat_incl"] === false
          ? false
          : null,
    paperWeightPct: (() => {
      const out: Record<string, number> = {};
      const raw2 = (v?.["paper_weight_pct"] ?? null) as Record<string, unknown> | null;
      if (raw2 && typeof raw2 === "object")
        for (const [k, val] of Object.entries(raw2)) {
          const n = num(val);
          if (n > 0) out[String(k).trim()] = n;
        }
      return out;
    })(),
    sizeBuckets: Array.isArray(v?.["size_buckets"])
      ? (v?.["size_buckets"] as unknown[])
          .map((b) => {
            const o = (b ?? {}) as Record<string, unknown>;
            const maxW = Math.max(0, num(o["max_w"]));
            const maxH = Math.max(0, num(o["max_h"]));
            const factor = o["factor"] == null ? null : num(o["factor"]);
            const base100 = o["base100"] == null ? null : num(o["base100"]);
            return {
              id: String(o["id"] ?? "").trim() || sizeKey(maxW || 1, maxH || 1),
              maxW,
              maxH,
              factor: factor !== null && factor > 0 ? factor : null,
              base100: base100 !== null && base100 > 0 ? base100 : null,
              quoteOnly: o["quote_only"] === true,
              includes: Array.isArray(o["includes"])
                ? (o["includes"] as unknown[]).map((s) => normalizeSizeText(String(s)))
                : [],
            };
          })
          .filter((b) => b.factor !== null || b.base100 !== null)
      : [],
    qtyMultipliers: Array.isArray(v?.["qty_multipliers"])
      ? (v?.["qty_multipliers"] as unknown[])
          .map((m) => {
            const o = (m ?? {}) as Record<string, unknown>;
            return { qty: Math.floor(num(o["qty"])), mult: num(o["mult"]) };
          })
          .filter((m) => m.qty > 0 && m.mult > 0)
          .sort((a, b) => a.qty - b.qty)
      : [],
    curveAnchors: Array.isArray(v?.["curve_anchors"])
      ? (v?.["curve_anchors"] as unknown[])
          .map((c) => {
            const o = (c ?? {}) as Record<string, unknown>;
            return {
              size: String(o["size"] ?? "").trim(),
              qty: Math.floor(num(o["qty"])),
              price: num(o["price"]),
            };
          })
          .filter((c) => c.size && c.qty > 0 && c.price > 0)
      : [],
    tailPerUnit:
      v?.["tail_per_unit"] != null && num(v?.["tail_per_unit"]) > 0
        ? num(v?.["tail_per_unit"])
        : null,
    perM2Tiers: Array.isArray(v?.["per_m2_tiers"])
      ? (v?.["per_m2_tiers"] as unknown[])
          .map((t) => {
            const o = (t ?? {}) as Record<string, unknown>;
            return { minM2: num(o["min_m2"]), rate: num(o["rate"]) };
          })
          .filter((t) => t.minM2 >= 0 && t.rate > 0)
          .sort((a, b) => a.minM2 - b.minM2)
      : [],
    minJobPrice: Math.max(0, num(v?.["min_job_price"])),
    sizeLadder: Array.isArray(v?.["size_ladder"])
      ? (v?.["size_ladder"] as unknown[])
          .map((p) => {
            const o = (p ?? {}) as Record<string, unknown>;
            return { w: num(o["w"]), h: num(o["h"]), price: num(o["price"]) };
          })
          .filter((p) => p.w > 0 && p.h > 0 && p.price > 0)
      : [],
    panoramicAspect: Math.max(0, num(v?.["panoramic_aspect"])),
    panoramicPct: Math.max(0, num(v?.["panoramic_pct"])),
    yieldTable: Array.isArray(v?.["yield_table"])
      ? (v?.["yield_table"] as unknown[])
          .map((r) => {
            const o = (r ?? {}) as Record<string, unknown>;
            return {
              piecesPerSheet: Math.floor(num(o["pieces_per_sheet"])),
              price: num(o["price"]),
            };
          })
          .filter((r) => r.piecesPerSheet > 0 && r.price > 0)
      : [],
    vinylCostPerSheet: Math.max(0, num(v?.["vinyl_cost_sheet"])),
    formatPrices: Array.isArray(v?.["format_prices"])
      ? (v?.["format_prices"] as unknown[])
          .map((f) => {
            const o = (f ?? {}) as Record<string, unknown>;
            return {
              label: String(o["label"] ?? "").trim(),
              w: o["w"] == null ? null : num(o["w"]),
              h: o["h"] == null ? null : num(o["h"]),
              qty: Math.max(1, Math.floor(num(o["qty"]))),
              price: num(o["price"]),
            };
          })
          .filter((f) => f.price > 0)
      : [],
    digitalSetup: Math.max(0, num(v?.["digital_setup"])),
    digitalPerUnit: Math.max(0, num(v?.["digital_per_unit"])),
    digitalMaxQty: Math.max(0, Math.floor(num(v?.["digital_max_qty"]))),
    todos: Array.isArray(v?.["todos"])
      ? (v?.["todos"] as unknown[]).map((t) => String(t).trim()).filter(Boolean)
      : [],
  };
}

/**
 * The pricing_config JSON to persist for a family.
 * `prev` = the previously stored pricing_config; its unknown top-level keys
 * (e.g. the legacy `customer` block) are preserved instead of clobbered.
 */
export function writeFamilyPricing(cfg: FamilyPricing, prev?: unknown) {
  const carried = prev && typeof prev === "object" ? { ...(prev as Record<string, unknown>) } : {};
  delete carried["v3"];
  return {
    ...carried,
    v3: {
      engine: cfg.engine,
      /* legacy hint so a pre-v3.1 build reading this config degrades sanely */
      method: cfg.engine === "anchor_curve" ? "sheet" : "area",
      margin: cfg.margin,
      rounding: cfg.rounding,
      packages: cfg.packages,
      min_unit_area: cfg.minUnitArea,
      short_run_pct: cfg.shortRunPct,
      qty_exponent: cfg.qtyExponentPinned ? cfg.qtyExponent : null,
      qty_tiers_enabled: cfg.qtyTiersEnabled,
      qty_tiers: cfg.qtyTiers.map((t) => ({
        min_qty: t.minQty,
        unit_price: t.unitPrice,
        size: t.size || null,
      })),
      sheet_units: cfg.sheetUnits,
      sheet_w: cfg.sheetW,
      sheet_h: cfg.sheetH,
      sheet_margin: cfg.sheetMargin,
      sheet_gap: cfg.sheetGap,
      min_order_qty: cfg.minOrderQty,
      max_print_w: cfg.maxPrintW,
      max_print_l: cfg.maxPrintL,
      over_limit: cfg.overLimit,
      mount_cost_m2: cfg.mountCostM2,
      mount_cost_unit: cfg.mountCostUnit,
      cap_w: cfg.capW,
      cap_l: cfg.capL,
      whole_board: cfg.wholeBoard,
      board_w: cfg.boardW,
      board_h: cfg.boardH,

      /* --- v3.1 --- */
      short_run_ref_qty: cfg.shortRunRefQty,
      min_order_value: cfg.minOrderValue,
      dual_surcharge: cfg.dualSurcharge.map((t) => ({ max_qty: t.maxQty, pct: t.pct })),
      outsourced_margin_factor: cfg.outsourcedMarginFactor,
      outsourced_vat_incl: cfg.outsourcedVatIncluded,
      paper_weight_pct: cfg.paperWeightPct,
      size_buckets: cfg.sizeBuckets.map((b) => ({
        id: b.id,
        max_w: b.maxW,
        max_h: b.maxH,
        factor: b.factor,
        base100: b.base100,
        quote_only: b.quoteOnly,
        includes: b.includes,
      })),
      qty_multipliers: cfg.qtyMultipliers.map((m) => ({ qty: m.qty, mult: m.mult })),
      curve_anchors: cfg.curveAnchors.map((c) => ({ size: c.size, qty: c.qty, price: c.price })),
      tail_per_unit: cfg.tailPerUnit,
      per_m2_tiers: cfg.perM2Tiers.map((t) => ({ min_m2: t.minM2, rate: t.rate })),
      min_job_price: cfg.minJobPrice,
      size_ladder: cfg.sizeLadder.map((p) => ({ w: p.w, h: p.h, price: p.price })),
      panoramic_aspect: cfg.panoramicAspect,
      panoramic_pct: cfg.panoramicPct,
      yield_table: cfg.yieldTable.map((r) => ({
        pieces_per_sheet: r.piecesPerSheet,
        price: r.price,
      })),
      vinyl_cost_sheet: cfg.vinylCostPerSheet,
      format_prices: cfg.formatPrices.map((f) => ({
        label: f.label,
        w: f.w,
        h: f.h,
        qty: f.qty,
        price: f.price,
      })),
      digital_setup: cfg.digitalSetup,
      digital_per_unit: cfg.digitalPerUnit,
      digital_max_qty: cfg.digitalMaxQty,
      todos: cfg.todos,
    },
  };
}

/** The qty tier that applies to this job, if tiers are enabled. */
export function matchQtyTier(
  cfg: FamilyPricing,
  w: number,
  h: number,
  units: number,
): QtyTier | null {
  if (!cfg.qtyTiersEnabled || !cfg.qtyTiers.length) return null;
  const key = sizeKey(w, h);
  const pick = (list: QtyTier[]) =>
    list.filter((t) => units >= t.minQty).sort((a, b) => b.minQty - a.minQty)[0] ?? null;
  return (
    pick(cfg.qtyTiers.filter((t) => t.size && t.size === key)) ??
    pick(cfg.qtyTiers.filter((t) => !t.size))
  );
}

export type MachineCheck = {
  /** number of welded panels (1 = single print) */
  panels: number;
  /** cannot be produced at all (over the length cap, or too wide and not weldable) */
  blocked: boolean;
  /** printed vinyl mounted on board instead of direct print */
  mounted: boolean;
  note: string;
};

/** Machine limits for a job: printable width, length cap and the mounting boundary. */
export function machineCheck(cfg: FamilyPricing, w: number, h: number): MachineCheck {
  const short = Math.min(w, h);
  const long = Math.max(w, h);
  let panels = 1;
  let blocked = false;
  let mounted = false;
  const notes: string[] = [];

  const overW = cfg.maxPrintW > 0 && short > cfg.maxPrintW + 0.01;
  const overL = cfg.maxPrintL > 0 && long > cfg.maxPrintL + 0.01;
  const limitText = `${cfg.maxPrintW || "∞"}×${cfg.maxPrintL || "∞"} ס״מ`;

  /* משפחות גיליון אינן ניתנות לריתוך — מעל גבול ההדפסה הן פשוט מיוצרות במיקור חוץ */
  const weldable = cfg.method !== "sheet";

  if ((overW || overL) && !(cfg.overLimit === "weld" && !weldable)) {
    if (cfg.overLimit === "weld") {
      if (overL) {
        blocked = true;
        notes.push(`מעל האורך המרבי ${cfg.maxPrintL} ס״מ — לא ניתן לייצור`);
      } else {
        panels = Math.ceil(short / cfg.maxPrintW);
        notes.push(`ריתוך פאנלים — ${panels} פאנלים (רוחב הדפסה ${cfg.maxPrintW} ס״מ)`);
      }
    } else if (cfg.overLimit === "mount") {
      mounted = true;
      notes.push(`הדבקת ויניל על הלוח (מעל ${limitText})`);
    } else {
      blocked = true;
      notes.push(`מעל גבול ההדפסה ${limitText} — לא ניתן לייצור`);
    }
  }

  /* absolute production cap — nothing can be made above it */
  const capShort = Math.min(cfg.capW || Infinity, cfg.capL || Infinity);
  const capLong = Math.max(cfg.capW || Infinity, cfg.capL || Infinity);
  if (short > capShort + 0.01 || long > capLong + 0.01) {
    blocked = true;
    panels = 1;
    mounted = false;
    notes.length = 0;
    notes.push(`מעל גבול הייצור המוחלט ${cfg.capW || "∞"}×${cfg.capL || "∞"} ס״מ — לא ניתן לייצור`);
  }

  return { panels, blocked, mounted, note: notes.join(" · ") };
}

/** The usable (printable) sheet area for a family, in cm. */
export function printableSheet(cfg?: Partial<FamilyPricing>) {
  const sw = cfg?.sheetW && cfg.sheetW > 0 ? cfg.sheetW : SHEET_W_CM;
  const sh = cfg?.sheetH && cfg.sheetH > 0 ? cfg.sheetH : SHEET_H_CM;
  const m = cfg?.sheetMargin && cfg.sheetMargin > 0 ? cfg.sheetMargin : 0;
  const gap = cfg?.sheetGap != null && cfg.sheetGap >= 0 ? cfg.sheetGap : SHEET_GAP_CM;
  return {
    w: Math.max(0, sw - 2 * m),
    h: Math.max(0, sh - 2 * m),
    gap,
    sheetW: sw,
    sheetH: sh,
    margin: m,
  };
}

/** Auto (geometric) יחידות בגיליון, ignoring manual overrides. */
export function autoUnitsPerSheet(w: number, h: number, cfg?: Partial<FamilyPricing>): number {
  if (w <= 0 || h <= 0) return 0;
  const s = printableSheet(cfg);
  const g = s.gap;
  const fit = (iw: number, ih: number) =>
    Math.floor((s.w + g) / (iw + g)) * Math.floor((s.h + g) / (ih + g));
  return Math.max(0, Math.max(fit(w, h), fit(h, w)));
}

export function sheetUnitsFor(cfg: FamilyPricing, w: number, h: number) {
  const key = sizeKey(w, h);
  const manual = cfg.sheetUnits[key];
  if (manual && manual > 0) return { units: manual, manual: true };
  return { units: autoUnitsPerSheet(w, h, cfg), manual: false };
}

export type JobAnchor = {
  id: string;
  name: string;
  w: number;
  h: number;
  area: number;
  qty: number;
  price: number;
  /** the row is a manually approved anchor (is_anchor) */
  anchor?: boolean;
};

export function anchorPrice(p: Product): number | null {
  const v = p.final_price ?? p.senzey_price ?? p.site_price ?? null;
  return v !== null && Number(v) > 0 ? Number(v) : null;
}

/** Validated (אומת) catalog prices for a family — exact size+qty lookups. */
export function familyValidated(products: Product[], family: string): JobAnchor[] {
  const out: JobAnchor[] = [];
  for (const p of products) {
    if (!p.verified) continue;
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
      anchor: p.is_anchor === true,
    });
  }
  return out.sort((a, b) => a.area - b.area || a.qty - b.qty);
}

/** Catalog anchors for a family, sorted by area then quantity. */

export function familyAnchors(products: Product[], family: string): JobAnchor[] {
  const out: JobAnchor[] = [];
  for (const p of products) {
    if (!p.is_anchor) continue;
    // Unverified items never feed the pricing engine.
    if (!p.verified) continue;
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

/** Two anchors of the same quantity whose areas are within ±2%. */
export type AnchorConflict = { members: JobAnchor[]; price: number };

/**
 * Merge anchors that describe practically the same job (same quantity, area
 * within ±2%) into a single curve point at their average price, and report the
 * groups whose prices disagree.
 */
export function mergeCloseAnchors(anchors: JobAnchor[]): {
  points: JobAnchor[];
  conflicts: AnchorConflict[];
} {
  const sorted = [...anchors].sort((a, b) => a.qty - b.qty || a.area - b.area);
  const groups: JobAnchor[][] = [];
  for (const a of sorted) {
    const g = groups[groups.length - 1];
    const last = g?.[g.length - 1];
    if (g && last && last.qty === a.qty && Math.abs(a.area - last.area) <= last.area * 0.02)
      g.push(a);
    else groups.push([a]);
  }
  const points: JobAnchor[] = [];
  const conflicts: AnchorConflict[] = [];
  for (const g of groups) {
    const first = g[0]!;
    if (g.length === 1) {
      points.push(first);
      continue;
    }
    const price = g.reduce((s, x) => s + x.price, 0) / g.length;
    points.push({ ...first, price, name: g.map((x) => x.name).join(" / ") });
    if (g.some((x) => Math.abs(x.price - price) > 0.01)) conflicts.push({ members: g, price });
  }
  return {
    points: points.sort((a, b) => a.area - b.area || a.qty - b.qty),
    conflicts,
  };
}

/* ================================================================== *
 *  Five-engine pricing (v3.1)
 *
 *  engine: anchor_curve | per_m2 | size_ladder | sheet_yield | unit_floor
 *  Master curves/ladders live in pricing_config.v3; verified catalog
 *  anchors overlay them as point overrides. Monotonicity is enforced on
 *  the data at load time (prepareFamily); the runtime check is only an
 *  assertion.
 * ================================================================== */

export type EngineKind = "anchor_curve" | "per_m2" | "size_ladder" | "sheet_yield" | "unit_floor";

export const ENGINE_LABEL: Record<EngineKind, string> = {
  anchor_curve: "עקומת עוגנים",
  per_m2: "לפי מ״ר",
  size_ladder: "סולם מידות",
  sheet_yield: "תפוקת גיליון",
  unit_floor: "מחיר רצפה",
};

export function isEngineKind(v: unknown): v is EngineKind {
  return (
    v === "anchor_curve" ||
    v === "per_m2" ||
    v === "size_ladder" ||
    v === "sheet_yield" ||
    v === "unit_floor"
  );
}

/** הכלל שקבע את המחיר הסופי — כל פירוט חייב לנקוב בו. */
export type BindingRule =
  | "validated"
  | "anchor"
  | "curve"
  | "package_min"
  | "short_run"
  | "outsourced"
  | "large_format"
  | "dual_surcharge"
  | "min_order_value"
  | "min_order_qty"
  | "machine_blocked"
  | "tier"
  | "cost";

export const BINDING_LABEL: Record<BindingRule, string> = {
  validated: "מחיר מאומת מהקטלוג",
  anchor: "מחיר עוגן",
  curve: "עקומת המשפחה",
  package_min: "מינימום חבילה",
  short_run: "ריצה קצרה",
  outsourced: "ייצור חוץ",
  large_format: "פורמט גדול — לפי מ״ר",
  dual_surcharge: "תוספת דו-צדדי",
  min_order_value: "מינימום הזמנה",
  min_order_qty: "מינימום הזמנה",
  machine_blocked: "מעל מגבלות המכונה",
  tier: "מדרגת כמות",
  cost: "לפי עלות",
};

/** נקודת עקומה: כמות → מחיר כולל. exact = נקודה מפורשת (לא נגזרת) שאינה מעוגלת. */
export type CurvePoint = { qty: number; price: number; exact?: boolean };

/**
 * דלי גודל למנוע עקומת עוגנים. מידה מותאמת לדלי הקטן ביותר שמכיל אותה
 * (עיגול כלפי מעלה). maxW=maxH=0 → דלי סל (כל מידה). includes = מפתחות
 * מידה מפורשים שמשתייכים לדלי גם כשאינם נכנסים גאומטרית (למשל 5×8 בדלי ≤5).
 */
export type SizeBucket = {
  id: string;
  maxW: number;
  maxH: number;
  /** מכפיל על עקומת המאסטר (פליירים: A5=1, A4=1.8) */
  factor: number | null;
  /** מחיר מוחלט ל-100 יחידות (מדבקות) */
  base100: number | null;
  /** מידה שאינה קטלוגית — מתומחרת אך מסומנת "לפי בקשה" (A3) */
  quoteOnly: boolean;
  includes: string[];
};

export type QtyMult = { qty: number; mult: number };
/** תוספת דו-צדדי: עד maxQty (null = המדרגה העליונה) → תוספת pct. */
export type DualTier = { maxQty: number | null; pct: number };
/** משטח שטח ≥ minM2 → תעריף rate ₪/מ״ר. */
export type PerM2Tier = { minM2: number; rate: number };
export type LadderPoint = { w: number; h: number; area: number; price: number };
export type YieldRow = { piecesPerSheet: number; price: number };
export type FormatPrice = {
  label: string;
  w: number | null;
  h: number | null;
  qty: number;
  price: number;
};

export type CurveAdjustment = {
  bucket: string;
  qty: number;
  from: number;
  to: number;
  reason: "qty_cummax" | "size_floor" | "catalog_override";
};

export type PreparedFamily = {
  engine: EngineKind;
  buckets: SizeBucket[];
  byBucket: Map<string, CurvePoint[]>;
  ladder: LadderPoint[];
  hasCurve: boolean;
  adjustments: CurveAdjustment[];
  configErrors: string[];
  todos: string[];
};

export type JobOptions = {
  /** הדפסה דו-צדדית (משפחות עם dualSurcharge) */
  dualSided?: boolean;
  /** משקל נייר, למשל "170" (פליירים) */
  paperWeight?: string;
  /** שמשונית מעל גבול הרוחב: עם תפר = ריתוך פאנלים בבית במקום מיקור חוץ */
  withSeam?: boolean;
  /** prepareFamily ממוזכר — חיסכון בלולאות קטלוג */
  prepared?: PreparedFamily;
  /** פנימי — מדלג על בדיקת המונוטוניות כדי למנוע רקורסיה */
  noAssert?: boolean;
};

/** Aspect ratio (long/short side), clamped so extreme banners don't explode. */
export function aspectOf(w: number, h: number): number {
  const lo = Math.min(w, h);
  const hi = Math.max(w, h);
  if (!(lo > 0) || !(hi > 0)) return 1;
  return Math.min(6, Math.max(1, hi / lo));
}

/**
 * עיגול מדורג: עד ₪20 → 0.5 · עד ₪100 → ₪1 · מעל → ₪5.
 * מחירי ריצה קצרה מעוגלים תמיד לשקל שלם (ערכי ביניים של רמפה).
 */
export function roundPrice(v: number, rule?: BindingRule): number {
  if (!(v > 0)) return 0;
  if (rule === "short_run") return Math.round(v);
  if (v < 20) return Math.round(v * 2) / 2;
  if (v < 100) return Math.round(v);
  return Math.round(v / 5) * 5;
}

const DIM_TOL = 0.51;
const sameSize = (aw: number, ah: number, bw: number, bh: number) =>
  Math.abs(Math.max(aw, ah) - Math.max(bw, bh)) <= DIM_TOL &&
  Math.abs(Math.min(aw, ah) - Math.min(bw, bh)) <= DIM_TOL;

function bucketRank(b: SizeBucket) {
  if (b.maxW <= 0 && b.maxH <= 0) return Infinity; // catch-all last
  const w = b.maxW > 0 ? b.maxW : b.maxH;
  const h = b.maxH > 0 ? b.maxH : b.maxW;
  return w * h;
}

/** הדלי הקטן ביותר שמכיל את המידה (או includes מפורש); null = אין התאמה. */
export function resolveBucket(buckets: SizeBucket[], w: number, h: number): SizeBucket | null {
  if (!buckets.length) return null;
  const sorted = [...buckets].sort((a, b) => bucketRank(a) - bucketRank(b));
  const key = sizeKey(w, h);
  for (const b of sorted) if (b.includes.includes(key)) return b;
  for (const b of sorted) {
    /* maxW=maxH=0 בלי includes = דלי סל; עם includes = רשימת חריגים בלבד */
    if (b.maxW <= 0 && b.maxH <= 0) {
      if (!b.includes.length) return b;
      continue;
    }
    const bMax = Math.max(b.maxW, b.maxH);
    const bMin = Math.min(b.maxW > 0 ? b.maxW : b.maxH, b.maxH > 0 ? b.maxH : b.maxW);
    if (Math.max(w, h) <= bMax + DIM_TOL && Math.min(w, h) <= bMin + DIM_TOL) return b;
  }
  return null;
}

/** דלי חריגים בלבד (includes) — לא משתתף ברצפת הגודל בין דליים. */
const isExceptionBucket = (b: SizeBucket) => b.maxW <= 0 && b.maxH <= 0 && b.includes.length > 0;
const isCatchAll = (b: SizeBucket) => b.maxW <= 0 && b.maxH <= 0 && !b.includes.length;

/** דלי a נשלט ע״י דלי b (שני הממדים קטנים/שווים) — רצפת גודל חלה רק אז. */
function bucketDominatedBy(a: SizeBucket, b: SizeBucket): boolean {
  if (isExceptionBucket(a) || isExceptionBucket(b)) return false;
  if (isCatchAll(b)) return !isCatchAll(a);
  if (isCatchAll(a)) return false;
  return (
    Math.max(a.maxW, a.maxH) <= Math.max(b.maxW, b.maxH) + 1e-9 &&
    Math.min(a.maxW, a.maxH) <= Math.min(b.maxW, b.maxH) + 1e-9
  );
}

export const QTY_EXPONENT_MIN = 0.2;
export const QTY_EXPONENT_MAX = 1;

/** מקדם כמות מקובע — נחסם לטווח שפוי כדי ששגיאת הקלדה לא תנפח הצעת מחיר. */
export function clampQtyExponent(e: number): number {
  if (!Number.isFinite(e) || !(e > 0)) return 1;
  return Math.min(QTY_EXPONENT_MAX, Math.max(QTY_EXPONENT_MIN, e));
}

/** תצורת המשפחה חוקית? כרגע: אסור per_m2 כשקיימים עוגני כמות מעל 500. */
export function validateFamilyPricing(cfg: FamilyPricing, anchors: JobAnchor[]): string[] {
  const errors: string[] = [];
  if (cfg.engine === "per_m2") {
    const highQty =
      anchors.some((a) => a.qty > 500) ||
      cfg.curveAnchors.some((c) => c.qty > 500) ||
      cfg.qtyMultipliers.some((m) => m.qty > 500);
    if (highQty)
      errors.push("תצורה שגויה: מנוע לפי מ״ר עם עוגני כמות מעל 500 — נדרש מנוע עקומת עוגנים");
  }
  /* דלי סל חסום-גודל לצד דליים ממודדים = מחיר שמפסיק להגיב לגודל. זו בדיוק
     התקלה של מדבקות ‎10+‎ (₪187 לכל מידה מ-10 ס״מ ועד גבול הייצור). */
  if (cfg.engine === "anchor_curve") {
    const sized = cfg.sizeBuckets.filter((b) => b.maxW > 0 || b.maxH > 0);
    const catchAll = cfg.sizeBuckets.find((b) => b.maxW <= 0 && b.maxH <= 0 && !b.includes.length);
    if (catchAll && sized.length)
      errors.push(
        `תצורה שגויה: דלי הסל "${catchAll.id}" חל על כל מידה שמעל הדליים הממודדים — המחיר מפסיק להגיב לגודל. הגדירו דלי עם מידה מרבית.`,
      );
  }
  /* מקדם כמות מחוץ לטווח = טעות הקלדה (9 במקום 0.9). המנוע חוסם, אבל בלי
     ההודעה הזו החסימה הייתה מסתירה את השגיאה במקום להציג אותה. */
  if (
    cfg.qtyExponentPinned &&
    (cfg.qtyExponent < QTY_EXPONENT_MIN || cfg.qtyExponent > QTY_EXPONENT_MAX)
  )
    errors.push(
      `תצורה שגויה: מקדם כמות ${cfg.qtyExponent} מחוץ לטווח ${QTY_EXPONENT_MIN}–${QTY_EXPONENT_MAX}`,
    );
  return errors;
}

/**
 * Load-time normalizer: materializes the config curves, overlays verified
 * catalog anchors, then enforces monotonicity ON THE DATA —
 * size-floor first (nested buckets), quantity-cummax last.
 */
export function prepareFamily(cfg: FamilyPricing, anchors: JobAnchor[]): PreparedFamily {
  const adjustments: CurveAdjustment[] = [];
  const configErrors = validateFamilyPricing(cfg, anchors);
  const todos = [...cfg.todos];
  const buckets = [...cfg.sizeBuckets].sort((a, b) => bucketRank(a) - bucketRank(b));
  const byBucket = new Map<string, CurvePoint[]>();
  let ladder: LadderPoint[] = [];

  if (cfg.legacy) {
    configErrors.push("תצורת משפחה ישנה — נדרשת מיגרציית תצורה v3 (המחיר מחושב מעלות בלבד)");
  }

  if (cfg.engine === "anchor_curve" && buckets.length) {
    const master = buckets.find((b) => b.factor !== null && Math.abs((b.factor ?? 0) - 1) < 1e-9);
    const masterPts = master
      ? cfg.curveAnchors
          .filter((c) => c.size === master.id)
          .map((c) => ({ qty: c.qty, price: c.price, exact: true }))
      : [];

    for (const b of buckets) {
      let pts: CurvePoint[] = [];
      if (b.base100 !== null && b.base100 > 0 && cfg.qtyMultipliers.length) {
        /* מקדם 1 = מחיר הבסיס המאושר עצמו — לא מעוגל */
        pts = cfg.qtyMultipliers.map((m) => ({
          qty: m.qty,
          price: b.base100! * m.mult,
          exact: Math.abs(m.mult - 1) < 1e-9,
        }));
      } else if (b.factor !== null && masterPts.length) {
        pts =
          master && b.id === master.id
            ? masterPts.map((p) => ({ ...p }))
            : masterPts.map((p) => ({ qty: p.qty, price: p.price * (b.factor as number) }));
      }
      /* explicit per-bucket points replace derived points at the same qty */
      for (const c of cfg.curveAnchors) {
        if (c.size !== b.id) continue;
        const i = pts.findIndex((p) => p.qty === c.qty);
        if (i >= 0) pts[i] = { qty: c.qty, price: c.price, exact: true };
        else pts.push({ qty: c.qty, price: c.price, exact: true });
      }
      pts.sort((a, b2) => a.qty - b2.qty);
      if (pts.length) byBucket.set(b.id, pts);
    }

    /* overlay verified catalog anchors — replace same-(bucket, qty) points */
    for (const a of anchors) {
      const b = resolveBucket(buckets, a.w, a.h);
      if (!b) continue;
      const pts = byBucket.get(b.id) ?? [];
      const i = pts.findIndex((p) => p.qty === a.qty);
      if (i >= 0) {
        if (Math.abs(pts[i]!.price - a.price) > 0.005)
          adjustments.push({
            bucket: b.id,
            qty: a.qty,
            from: pts[i]!.price,
            to: a.price,
            reason: "catalog_override",
          });
        pts[i] = { qty: a.qty, price: a.price, exact: true };
      } else {
        pts.push({ qty: a.qty, price: a.price, exact: true });
        pts.sort((x, y) => x.qty - y.qty);
      }
      byBucket.set(b.id, pts);
    }

    /* size-floor FIRST: a bucket that DOMINATES another (both max dims ≥) may
       never be cheaper at the same quantity. Buckets are only partially
       ordered (5×9 is not comparable to a 6 cm circle), so the floor applies
       strictly on dominance; exception (includes-only) buckets are exempt. */
    for (const b of buckets) {
      const pts = byBucket.get(b.id);
      if (!pts) continue;
      for (const p of pts) {
        let floor = 0;
        for (const other of buckets) {
          if (other.id === b.id || !bucketDominatedBy(other, b)) continue;
          const oPts = byBucket.get(other.id);
          const oAt = oPts?.find((x) => x.qty === p.qty);
          if (oAt && oAt.price > floor) floor = oAt.price;
        }
        if (p.price < floor - 1e-9) {
          adjustments.push({
            bucket: b.id,
            qty: p.qty,
            from: p.price,
            to: floor,
            reason: "size_floor",
          });
          p.price = floor;
          p.exact = false;
        }
      }
    }

    /* quantity-cummax LAST: within a bucket, more units never cost less */
    for (const [id, pts] of byBucket) {
      let run = 0;
      for (const p of pts) {
        if (p.price < run - 1e-9) {
          adjustments.push({
            bucket: id,
            qty: p.qty,
            from: p.price,
            to: run,
            reason: "qty_cummax",
          });
          p.price = run;
          p.exact = false;
        }
        run = Math.max(run, p.price);
      }
    }
  }

  if (cfg.engine === "size_ladder") {
    ladder = cfg.sizeLadder.map((p) => ({
      w: p.w,
      h: p.h,
      area: (p.w * p.h) / 10000,
      price: p.price,
    }));
    /* qty-1 catalog anchors override/extend ladder points */
    for (const a of anchors) {
      if (a.qty !== 1) continue;
      const i = ladder.findIndex((p) => sameSize(p.w, p.h, a.w, a.h));
      if (i >= 0) {
        if (Math.abs(ladder[i]!.price - a.price) > 0.005)
          adjustments.push({
            bucket: sizeKey(a.w, a.h),
            qty: 1,
            from: ladder[i]!.price,
            to: a.price,
            reason: "catalog_override",
          });
        ladder[i] = { ...ladder[i]!, price: a.price };
      } else {
        ladder.push({ w: a.w, h: a.h, area: a.area, price: a.price });
      }
    }
    ladder.sort((x, y) => x.area - y.area);
    /* NOTE: sizes are only partially ordered (100×70 is not "smaller" than
       90×90) — the dominance floor is applied at price time, not by
       destructively rewriting the ladder. */
  }

  if (cfg.engine === "sheet_yield" && !cfg.yieldTable.length) {
    todos.push("טבלת תפוקה חסרה — המחיר מחושב מעלות חומר × מקדם בלבד (TODO)");
  }
  if (cfg.engine === "per_m2" && cfg.outsourceCost > 0 && cfg.outsourcedVatIncluded === null) {
    todos.push("תעריף מיקור חוץ — לא הוגדר אם כולל מע״מ (TODO)");
  }

  const hasCurve =
    [...byBucket.values()].some((p) => p.length > 0) ||
    ladder.length > 0 ||
    cfg.perM2Tiers.length > 0 ||
    cfg.yieldTable.length > 0 ||
    cfg.formatPrices.length > 0;

  return {
    engine: cfg.engine,
    buckets,
    byBucket,
    ladder,
    hasCurve,
    adjustments,
    configErrors,
    todos: [...new Set(todos)],
  };
}

/* ------------------------------------------------------------------ *
 *  Per-engine pricing functions (pure; totals before modifiers)
 * ------------------------------------------------------------------ */

type EngineResult = {
  raw: number;
  bindingRule: BindingRule;
  detail: string;
  noRound: boolean;
  quoteOnly?: boolean;
  noQuote?: boolean;
  error?: string | null;
};

/** מחיר על עקומת כמות: נקודה מדויקת / שטוח מתחת לראשונה / אינטרפולציה / המשך שיפוע. */
function curvePriceAt(
  pts: CurvePoint[],
  q: number,
): { price: number; detail: string; exact: boolean } {
  const hit = pts.find((p) => p.qty === q);
  if (hit)
    return {
      price: hit.price,
      detail: `עוגן ${q.toLocaleString()} יח׳`,
      exact: hit.exact === true,
    };
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (q < first.qty)
    return {
      price: first.price,
      detail: `מתחת לעוגן הקטן (${first.qty.toLocaleString()} יח׳)`,
      exact: false,
    };
  if (q > last.qty) {
    const prev = pts.length >= 2 ? pts[pts.length - 2]! : null;
    const slope = prev ? Math.max(0, (last.price - prev.price) / (last.qty - prev.qty)) : 0;
    return {
      price: last.price + slope * (q - last.qty),
      detail: `מעל העוגן הגדול (${last.qty.toLocaleString()} יח׳) — המשך השיפוע`,
      exact: false,
    };
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    if (q >= a.qty && q <= b.qty) {
      const t = (q - a.qty) / (b.qty - a.qty);
      return {
        price: a.price + (b.price - a.price) * t,
        detail: `בין ${a.qty.toLocaleString()} ל-${b.qty.toLocaleString()} יח׳`,
        exact: false,
      };
    }
  }
  return { price: last.price, detail: "", exact: false };
}

function priceAnchorCurve(
  p: PreparedFamily,
  cfg: FamilyPricing,
  w: number,
  h: number,
  units: number,
): EngineResult {
  const bucket = resolveBucket(p.buckets, w, h);
  if (!bucket)
    return {
      raw: 0,
      bindingRule: "cost",
      detail: "",
      noRound: false,
      noQuote: true,
      error: "אין דלי גודל מתאים למידה זו בתצורת המשפחה",
    };
  const pts = p.byBucket.get(bucket.id) ?? [];
  if (!pts.length)
    return {
      raw: 0,
      bindingRule: "cost",
      detail: "",
      noRound: false,
      noQuote: true,
      error: `אין עקומת מחירים לדלי ${bucket.id}`,
    };

  const refQty = Math.max(1, Math.floor(cfg.shortRunRefQty || 100));
  const last = pts[pts.length - 1]!;
  const note = `דלי ${bucket.id}`;
  const quoteOnly = bucket.quoteOnly;

  /* ריצה קצרה — מתחת לכמות הייחוס הקבועה (bug #4: לעולם לפי refQty, לא לפי
     העוגן הקטן במקרה; המחיר נפתר דרך עקומת הדלי בכמות הייחוס) */
  if (units < refQty) {
    const base = curvePriceAt(pts, refQty);
    const pct = cfg.shortRunPct > 0 && cfg.shortRunPct <= 1 ? cfg.shortRunPct : 1;
    if (pct >= 1 - 1e-9 || refQty <= 1) {
      return {
        raw: base.price,
        bindingRule: "package_min",
        noRound: base.exact,
        quoteOnly,
        detail: `${note} · מינימום חבילה ${refQty.toLocaleString()} יח׳ = ${shekel(base.price)}`,
      };
    }
    const ratio = pct + (1 - pct) * ((units - 1) / (refQty - 1));
    const y = base.price * ratio;
    return {
      raw: y,
      bindingRule: "short_run",
      noRound: false,
      quoteOnly,
      detail: `${note} · בסיס ${shekel(base.price)} (${refQty.toLocaleString()} יח׳) × ${Math.round(ratio * 100)}%`,
    };
  }

  /* מעל העקומה: זנב ₪/יחידה (פליירים) או המשך השיפוע האחרון */
  if (units > last.qty && cfg.tailPerUnit !== null && cfg.tailPerUnit > 0) {
    const f = bucket.factor ?? 1;
    const y = last.price + cfg.tailPerUnit * f * (units - last.qty);
    return {
      raw: y,
      bindingRule: "curve",
      noRound: false,
      quoteOnly,
      detail: `${note} · ${shekel(last.price)} (${last.qty.toLocaleString()} יח׳) + ${shekel(cfg.tailPerUnit * f)} לכל יחידה נוספת`,
    };
  }

  const at = curvePriceAt(pts, units);
  const hitPoint = pts.some((pt) => pt.qty === units);
  if (hitPoint) {
    return {
      raw: at.price,
      bindingRule: "anchor",
      noRound: at.exact,
      quoteOnly,
      detail: `${note} · ${at.detail}`,
    };
  }

  /* בין נקודות: המחיר המעוגל נכלא בין המחירים הסופיים של השכנות, כדי
     שהעיגול לעולם לא יחצה נקודת עקומה (299 ← 300) וישבור מונוטוניות */
  const finalOf = (p: CurvePoint) => (p.exact ? p.price : roundPrice(p.price, "curve"));
  const firstPt = pts[0]!;
  if (units < firstPt.qty) {
    return {
      raw: finalOf(firstPt),
      bindingRule: "curve",
      noRound: true,
      quoteOnly,
      detail: `${note} · ${at.detail}`,
    };
  }
  if (units > last.qty) {
    const y = Math.max(roundPrice(at.price, "curve"), finalOf(last));
    return {
      raw: y,
      bindingRule: "curve",
      noRound: true,
      quoteOnly,
      detail: `${note} · ${at.detail}`,
    };
  }
  let lo = firstPt;
  let hi = last;
  for (let i = 0; i < pts.length - 1; i++) {
    if (units >= pts[i]!.qty && units <= pts[i + 1]!.qty) {
      lo = pts[i]!;
      hi = pts[i + 1]!;
      break;
    }
  }
  const fLo = finalOf(lo);
  const fHi = finalOf(hi);
  const y = Math.min(
    Math.max(roundPrice(at.price, "curve"), Math.min(fLo, fHi)),
    Math.max(fLo, fHi),
  );
  return {
    raw: y,
    bindingRule: "curve",
    noRound: true,
    quoteOnly,
    detail: `${note} · ${at.detail}`,
  };
}

function pricePerM2(
  cfg: FamilyPricing,
  w: number,
  h: number,
  units: number,
  opts: JobOptions,
): EngineResult {
  const area = (w * h) / 10000;
  const short = Math.min(w, h);
  const overWidth = cfg.maxPrintW > 0 && short > cfg.maxPrintW + 0.01;

  /* מיקור חוץ: הצד הצר גדול מרוחב ההדפסה — אלא אם נבחר "עם תפר" (ריתוך בבית) */
  if (overWidth && !opts.withSeam) {
    const rate = cfg.outsourceCost;
    if (!(rate > 0))
      return {
        raw: 0,
        bindingRule: "outsourced",
        detail: "",
        noRound: false,
        noQuote: true,
        error: "לא הוגדרה עלות מיקור חוץ למשפחה",
      };
    const factor = cfg.outsourcedMarginFactor > 0 ? cfg.outsourcedMarginFactor : 1.5;
    const y = rate * area * factor * units;
    return {
      raw: y,
      bindingRule: "outsourced",
      noRound: false,
      detail: `הצד הצר ${short} ס״מ מעל גבול ההדפסה ${cfg.maxPrintW} ס״מ · ${shekel(rate)} למ״ר × ${area.toFixed(2)} מ״ר × ${factor} × ${units.toLocaleString()} יח׳`,
    };
  }

  if (!cfg.perM2Tiers.length) {
    /* תצורה ישנה — אין מדרגות: עלות × מקדם */
    const margin = cfg.margin > 0 ? cfg.margin : DEFAULT_MARGIN;
    const y = cfg.cost * area * units * margin;
    return {
      raw: y,
      bindingRule: "cost",
      noRound: false,
      detail: `אין מדרגות מ״ר — עלות ${shekel(cfg.cost)} למ״ר × ${area.toFixed(2)} מ״ר × ${units.toLocaleString()} יח׳ × מקדם ${margin}`,
    };
  }

  let rate = cfg.perM2Tiers[0]!.rate;
  let tierFrom = cfg.perM2Tiers[0]!.minM2;
  for (const t of cfg.perM2Tiers) {
    if (area >= t.minM2) {
      rate = t.rate;
      tierFrom = t.minM2;
    }
  }
  const flatArea = cfg.minUnitArea > 0 ? cfg.minUnitArea : 1;
  const minP = cfg.minJobPrice > 0 ? cfg.minJobPrice : 0;
  const perUnit = Math.max(minP, rate * area);
  const bound = perUnit > rate * area + 1e-9;
  const seamNote = overWidth && opts.withSeam ? " · עם תפר — ריתוך פאנלים בבית" : "";
  return {
    raw: perUnit * units,
    bindingRule: bound ? "package_min" : "curve",
    noRound: false,
    detail: bound
      ? `מינימום ${shekel(minP)} לעבודה עד ${flatArea} מ״ר (${shekel(rate)} למ״ר × ${area.toFixed(2)} = ${shekel(rate * area)})${seamNote}`
      : `${shekel(rate)} למ״ר (מ-${tierFrom} מ״ר) × ${area.toFixed(2)} מ״ר × ${units.toLocaleString()} יח׳${seamNote}`,
  };
}

function priceSizeLadder(
  p: PreparedFamily,
  cfg: FamilyPricing,
  w: number,
  h: number,
  units: number,
): EngineResult {
  const ladder = p.ladder;
  if (!ladder.length)
    return {
      raw: 0,
      bindingRule: "cost",
      detail: "",
      noRound: false,
      noQuote: true,
      error: "לא הוגדר סולם מידות למשפחה",
    };
  const area = (w * h) / 10000;
  const first = ladder[0]!;
  const last = ladder[ladder.length - 1]!;

  const exact = ladder.find((pt) => sameSize(pt.w, pt.h, w, h));
  let perUnit: number;
  let detail: string;
  let bindingRule: BindingRule;
  let noRound = false;
  let interpolated = false;

  if (exact) {
    perUnit = exact.price;
    bindingRule = "anchor";
    noRound = true;
    detail = `מידה בסולם ${exact.w}×${exact.h} = ${shekel(exact.price)}`;
  } else if (area < first.area) {
    perUnit = first.price;
    bindingRule = "package_min";
    detail = `מתחת למידה הקטנה בסולם (${first.w}×${first.h}) — ${shekel(first.price)}`;
  } else if (area > last.area) {
    const prev = ladder.length >= 2 ? ladder[ladder.length - 2]! : null;
    const slope = prev ? Math.max(0, (last.price - prev.price) / (last.area - prev.area)) : 0;
    perUnit = last.price + slope * (area - last.area);
    bindingRule = "curve";
    interpolated = true;
    detail = `מעל המידה הגדולה (${last.w}×${last.h} = ${shekel(last.price)}) — המשך השיפוע`;
  } else {
    perUnit = last.price;
    detail = "";
    for (let i = 0; i < ladder.length - 1; i++) {
      const a = ladder[i]!;
      const b = ladder[i + 1]!;
      if (area >= a.area && area <= b.area) {
        const t = b.area > a.area ? (area - a.area) / (b.area - a.area) : 0;
        perUnit = a.price + (b.price - a.price) * t;
        detail = `בין ${a.w}×${a.h} (${shekel(a.price)}) ל-${b.w}×${b.h} (${shekel(b.price)})`;
        break;
      }
    }
    bindingRule = "curve";
    interpolated = true;
  }

  /* רצפת שליטה (dominance): מידה ששני ממדיה קטנים-או-שווים לעולם אינה יקרה
     יותר. המידות סדורות רק חלקית (100×70 אינה "קטנה" מ-90×90) ולכן הרצפה
     נבדקת מול נקודות נשלטות בלבד. */
  if (!exact) {
    const qMax = Math.max(w, h) + DIM_TOL;
    const qMin = Math.min(w, h) + DIM_TOL;
    let floor = 0;
    let floorPt: LadderPoint | null = null;
    for (const pt of ladder) {
      if (Math.max(pt.w, pt.h) <= qMax && Math.min(pt.w, pt.h) <= qMin && pt.price > floor) {
        floor = pt.price;
        floorPt = pt;
      }
    }
    if (floor > perUnit + 0.001 && floorPt) {
      perUnit = floor;
      bindingRule = "anchor";
      detail += ` · רצפת מידה נשלטת ${floorPt.w}×${floorPt.h} = ${shekel(floor)}`;
    }
  }

  if (
    interpolated &&
    cfg.panoramicAspect > 0 &&
    cfg.panoramicPct > 0 &&
    aspectOf(w, h) >= cfg.panoramicAspect
  ) {
    perUnit *= 1 + cfg.panoramicPct;
    noRound = false;
    detail += ` · תוספת פנורמית +${Math.round(cfg.panoramicPct * 100)}%`;
  }

  return { raw: perUnit * units, bindingRule, noRound, detail };
}

function priceSheetYield(
  cfg: FamilyPricing,
  w: number,
  h: number,
  units: number,
  machine: MachineCheck,
): EngineResult {
  const per = sheetUnitsFor(cfg, w, h);
  if (!(per.units > 0))
    return {
      raw: 0,
      bindingRule: "cost",
      detail: "",
      noRound: false,
      noQuote: true,
      error: "המידה גדולה מגיליון ההדפסה",
    };
  const sheetsUsed = Math.ceil(units / per.units);
  const sheetCost = cfg.cost + cfg.vinylCostPerSheet;
  const area = (w * h) / 10000;
  const mountCost = machine.mounted ? (cfg.mountCostM2 * area + cfg.mountCostUnit) * units : 0;
  const mountNote = mountCost > 0 ? ` · הדבקה ${shekel(mountCost)}` : "";

  const row = cfg.yieldTable.find((r) => r.piecesPerSheet === per.units);
  if (row) {
    return {
      raw: row.price * sheetsUsed + mountCost,
      bindingRule: "curve",
      noRound: false,
      detail: `${per.units} יח׳ בגיליון · ${sheetsUsed} גיליונות × ${shekel(row.price)}${mountNote}`,
    };
  }
  const margin = cfg.margin > 0 ? cfg.margin : DEFAULT_MARGIN;
  return {
    raw: sheetsUsed * sheetCost * margin + mountCost,
    bindingRule: "cost",
    noRound: false,
    detail: `טבלת תפוקה חסרה (TODO) · ${per.units} יח׳ בגיליון · ${sheetsUsed} גיליונות × ${shekel(sheetCost)} × מקדם ${margin}${mountNote}`,
  };
}

function priceUnitFloor(cfg: FamilyPricing, w: number, h: number, units: number): EngineResult {
  if (cfg.formatPrices.length) {
    const match = cfg.formatPrices.find(
      (f) => f.w !== null && f.h !== null && sameSize(f.w, f.h, w, h) && f.qty === units,
    );
    if (match)
      return {
        raw: match.price,
        bindingRule: "anchor",
        noRound: true,
        detail: `מבנה ${match.label} · ${units.toLocaleString()} יח׳ = ${shekel(match.price)}`,
      };
    return {
      raw: 0,
      bindingRule: "cost",
      detail: "",
      noRound: false,
      noQuote: true,
      error: "אין מחיר מוגדר למבנה/כמות זו — מחירי החבילות אינם ליניאריים",
    };
  }
  if (cfg.minOrderValue > 0)
    return {
      raw: cfg.minOrderValue,
      bindingRule: "min_order_value",
      noRound: true,
      detail: `מינימום הזמנה ${shekel(cfg.minOrderValue)} (כולל מע״מ)`,
    };
  return {
    raw: 0,
    bindingRule: "cost",
    detail: "",
    noRound: false,
    noQuote: true,
    error: "לא הוגדרו מחירי מבנה או מינימום הזמנה למשפחה",
  };
}

/* ------------------------------------------------------------------ *
 *  JobPrice + priceJob — the one pricing entry point
 * ------------------------------------------------------------------ */

export type JobPrice = {
  total: number;
  unit: number;
  above: boolean;
  /** direct production cost of the whole job (reporting) */
  cost: number;
  /** the below-cost line: cost × מקדם */
  costFloorValue: number;
  belowCost: boolean;
  label: string;
  detail: string;
  sheets: number | null;
  unitsPerSheet: number | null;
  inconsistent: JobAnchor[];
  /** anchor groups describing the same job at different prices */
  conflicts: AnchorConflict[];
  hasAnchors: boolean;
  /** where the number came from (legacy field, derived from bindingRule) */
  source: "validated" | "anchor" | "cost" | "tier";
  qtyFactor: number;
  noOutsourceCost: boolean;
  belowMinOrder: boolean;
  minOrderQty: number;
  panels: number;
  overMachine: boolean;
  mounted: boolean;
  machineNote: string;
  mountCost: number;
  /* --- v3.1 --- */
  engine: EngineKind;
  /** הכלל שקבע את המחיר הסופי */
  bindingRule: BindingRule;
  /** כל הכללים שעיצבו את המחיר, לפי סדר */
  appliedRules: BindingRule[];
  /** אסרטה: המחיר נמוך ממחיר לכמות/מידה קטנה יותר (לעולם לא אמור לקרות) */
  monotoneViolation: boolean;
  configError: string | null;
  /** הצעה חלופית לא מחייבת (פליירים — נוסחת דיגיטל) */
  altQuote: { label: string; total: number } | null;
  todos: string[];
  /** אין מחיר לעבודה זו (מבנה לא מוגדר וכד׳) */
  noQuote: boolean;
  /** תוספת דו-צדדי שהוחלה בפועל */
  dualPct: number;
  dualValue: number;
  /** תיקוני מונוטוניות שבוצעו על העקומה בטעינה */
  curveAdjustments: CurveAdjustment[];
  /** שורות מאומתות סותרות לאותה מידה+כמות (אם יש יותר ממחיר אחד) */
  validatedConflicts: JobAnchor[];
  /** מחיר מאומת קטן ממחיר מאומת של מידה קטנה יותר באותה כמות */
  smallerViolation: { anchor: JobAnchor; price: number } | null;
};

const SOURCE_FOR: Partial<Record<BindingRule, JobPrice["source"]>> = {
  validated: "validated",
  tier: "tier",
  cost: "cost",
  outsourced: "cost",
  large_format: "cost",
  machine_blocked: "cost",
  min_order_qty: "cost",
};

/** The one pricing entry point. */
export function priceJob(
  cfg: FamilyPricing,
  anchors: JobAnchor[],
  w: number,
  h: number,
  qty: number,
  validated: JobAnchor[] = [],
  opts: JobOptions = {},
): JobPrice | null {
  if (!(w > 0) || !(h > 0)) return null;
  const units = Math.max(1, Math.round(qty) || 1);
  const area = (w * h) / 10000;
  const margin = cfg.margin > 0 ? cfg.margin : DEFAULT_MARGIN;
  const machine = machineCheck(cfg, w, h);
  const prepared = opts.prepared ?? prepareFamily(cfg, anchors);

  const outsourcedJob =
    cfg.engine === "per_m2" &&
    cfg.maxPrintW > 0 &&
    Math.min(w, h) > cfg.maxPrintW + 0.01 &&
    !opts.withSeam;

  const per =
    cfg.engine === "sheet_yield" || cfg.engine === "anchor_curve" || cfg.method === "sheet"
      ? sheetUnitsFor(cfg, w, h)
      : null;
  const sheets = per && per.units > 0 ? units / per.units : 0;
  const mountCost = machine.mounted ? (cfg.mountCostM2 * area + cfg.mountCostUnit) * units : 0;

  /* פורמט גדול: היחידה אינה נכנסת כלל לגיליון ההדפסה. עקומת הדליים מכוילת
     לעבודות גיליון, ולכן היא אינה תקפה כאן — התמחור עובר לתעריף המ״ר. */
  const largeFormat =
    cfg.engine === "anchor_curve" && per !== null && per.units === 0 && cfg.outsourceCost > 0;

  /* rough production cost — feeds the "מתחת לעלות" banner only.
     בעבודת גיליון שאינה נכנסת לגיליון אין "מספר גיליונות", ולכן העלות
     מחושבת לפי שטח — אחרת היא 0 והרצפה לעולם אינה נבדקת. */
  const cost =
    (cfg.engine === "sheet_yield"
      ? Math.ceil(sheets || 0) * (cfg.cost + cfg.vinylCostPerSheet)
      : outsourcedJob || largeFormat
        ? cfg.outsourceCost * area * units
        : per && per.units > 0
          ? Math.ceil(sheets) * cfg.cost
          : cfg.cost * area * units) + mountCost;

  const conflicts = mergeCloseAnchors(
    anchors.filter((a) => a.area > 0 && a.price > 0 && a.qty > 0),
  ).conflicts;

  const finish = (
    raw: number,
    bindingRule: BindingRule,
    label: string,
    detail: string,
    extra: Partial<JobPrice> = {},
    noRound = false,
  ): JobPrice => {
    const base = Math.max(raw, 0);
    const total = noRound ? base : roundPrice(base, bindingRule);
    return {
      total,
      unit: units > 0 ? total / units : total,
      above: outsourcedJob,
      cost,
      costFloorValue: cost * margin,
      belowCost: cost > 0 && total > 0 && total < cost * margin - 0.001,
      label,
      detail,
      sheets: per ? sheets : null,
      unitsPerSheet: per ? per.units : null,
      inconsistent: [],
      conflicts,
      hasAnchors: anchors.length > 0 || prepared.hasCurve,
      source: SOURCE_FOR[bindingRule] ?? "anchor",
      qtyFactor: 1,
      noOutsourceCost: outsourcedJob && !(cfg.outsourceCost > 0),
      belowMinOrder: false,
      minOrderQty: cfg.minOrderQty,
      panels: machine.panels,
      overMachine: false,
      mounted: machine.mounted,
      machineNote: machine.note,
      mountCost,
      engine: cfg.engine,
      bindingRule,
      appliedRules: [bindingRule],
      monotoneViolation: false,
      configError: prepared.configErrors[0] ?? null,
      altQuote: null,
      todos: prepared.todos,
      noQuote: false,
      dualPct: 0,
      dualValue: 0,
      curveAdjustments: prepared.adjustments,
      validatedConflicts: [],
      smallerViolation: null,
      ...extra,
    };
  };

  /* machine limits — impossible to produce, no price */
  if (machine.blocked) {
    return {
      ...finish(0, "machine_blocked", "לא ניתן לייצור — מעל מגבלות המכונה", machine.note),
      total: 0,
      unit: 0,
      belowCost: false,
      overMachine: true,
    };
  }

  /* minimum order quantity — no price below it. מינימום הכמות שייך לעבודת
     גיליון (מדפיסים גיליון שלם ממילא); לפורמט גדול הוא אינו חל. */
  if (cfg.minOrderQty > 1 && units < cfg.minOrderQty && !largeFormat) {
    return {
      ...finish(
        0,
        "min_order_qty",
        `מינימום הזמנה ${cfg.minOrderQty.toLocaleString()} יחידות`,
        `הכמות שהוזנה (${units.toLocaleString()}) נמוכה מהמינימום למשפחה — ${cfg.minOrderQty.toLocaleString()} יחידות`,
      ),
      total: 0,
      unit: 0,
      belowCost: false,
      belowMinOrder: true,
    };
  }

  /* P0 — validated catalog price: exact size + exact quantity, verbatim.
     Several verified rows may describe the same job at different prices — never
     take "the first one". Prefer the manually approved anchor, otherwise the
     highest price, and report the disagreement. */
  const matches = validated.filter((a) => sameSize(a.w, a.h, w, h) && a.qty === units);
  const first = matches[0];
  if (first && !opts.dualSided) {
    const distinct = matches.filter(
      (a, i) => matches.findIndex((b) => Math.abs(b.price - a.price) <= 0.01) === i,
    );
    const anchorHit = matches.find((a) => a.anchor);
    const v =
      anchorHit ?? matches.reduce<JobAnchor>((best, a) => (a.price > best.price ? a : best), first);

    /* smaller verified size at the same quantity must not cost more */
    const bigger = validated
      .filter((a) => a.qty === units && a.area < v.area - 1e-9 && a.price > v.price + 0.01)
      .sort((a, b) => b.price - a.price)[0];

    return finish(
      v.price,
      "validated",
      BINDING_LABEL.validated,
      `${v.w}×${v.h} · ${units.toLocaleString()} יח׳ · ${v.name}`,
      {
        validatedConflicts: distinct.length > 1 ? matches : [],
        smallerViolation: bigger ? { anchor: bigger, price: v.price } : null,
      },
      true,
    );
  }

  /* מדרגת כמות — מחיר קבוע ליחידה, גובר על העקומה */
  const tier = matchQtyTier(cfg, w, h, units);
  if (tier && !opts.dualSided) {
    return finish(
      tier.unitPrice * units,
      "tier",
      BINDING_LABEL.tier,
      `${tier.minQty.toLocaleString()}+ יח׳ · ${shekel(tier.unitPrice)} ליחידה × ${units.toLocaleString()} יח׳${
        tier.size ? ` · מידה ${tier.size.replace("x", "×")}` : " · כל המידות"
      }`,
      {},
      true,
    );
  }

  /* P1 — exact catalog anchor for engines without a merged curve
     (anchor_curve / size_ladder fold anchors into the normalized data instead) */
  if (cfg.engine === "per_m2" || cfg.engine === "sheet_yield" || cfg.engine === "unit_floor") {
    const ex = anchors.find((a) => sameSize(a.w, a.h, w, h) && a.qty === units);
    if (ex && !opts.dualSided) {
      return finish(
        ex.price,
        "anchor",
        BINDING_LABEL.anchor,
        `${ex.w}×${ex.h} · ${units.toLocaleString()} יח׳ · ${ex.name}`,
        {},
        true,
      );
    }
  }

  /* נייר 300 גרם — מוצר של משפחת גלויות, לא מתומחר כאן */
  if (cfg.engine === "anchor_curve" && opts.paperWeight === "300") {
    return {
      ...finish(0, "cost", "אין מחיר — נייר 300 גרם", "נייר 300 גרם מתומחר במשפחת גלויות"),
      total: 0,
      unit: 0,
      belowCost: false,
      noQuote: true,
      configError: "נייר 300 גרם מתומחר במשפחת גלויות",
    };
  }

  /* פורמט גדול — לפי מ״ר, עם רצפת מ״ר ליחידה. רץ אחרי P0 כדי שמחיר מאומת
     מהקטלוג לאותה מידה+כמות ימשיך לגבור על הנוסחה. */
  if (largeFormat) {
    const factor = cfg.outsourcedMarginFactor > 0 ? cfg.outsourcedMarginFactor : 1.5;
    const floorM2 = cfg.minUnitArea > 0 ? cfg.minUnitArea : 0;
    const billable = Math.max(area, floorM2);
    const sheet = printableSheet(cfg);
    const bound = billable > area + 1e-9;
    /* מקדם כמות: units^e. e=1 (לא מקובע) = ליניארי, e<1 = הנחת כמות שמעמיקה
       עם הריצה. 1^e = 1 תמיד, ולכן יחידה בודדת שומרת על המחיר המאומת
       מהקטלוג בכל ערך של המקדם. הענף היחיד שמשתמש בו — במסלול הגיליון
       qtyMultipliers כבר מגלם את הנחת הכמות. */
    const e = cfg.qtyExponentPinned ? clampQtyExponent(cfg.qtyExponent) : 1;
    const qtyFactor = units ** e;
    return finish(
      cfg.outsourceCost * billable * factor * qtyFactor,
      "large_format",
      BINDING_LABEL.large_format,
      `היחידה אינה נכנסת לגיליון ההדפסה ${sheet.w}×${sheet.h} ס״מ · ${shekel(cfg.outsourceCost)} למ״ר × ${billable.toFixed(2)} מ״ר${
        bound ? ` (מינימום ${floorM2} מ״ר ליחידה)` : ""
      } × ${factor} × ${units.toLocaleString()} יח׳${
        e < 1 ? ` ^${e} (מקדם כמות ×${qtyFactor.toFixed(2)})` : ""
      }`,
      { qtyFactor },
    );
  }

  /* engine dispatch */
  let er: EngineResult;
  switch (cfg.engine) {
    case "anchor_curve":
      er = priceAnchorCurve(prepared, cfg, w, h, units);
      break;
    case "per_m2":
      er = pricePerM2(cfg, w, h, units, opts);
      break;
    case "size_ladder":
      er = priceSizeLadder(prepared, cfg, w, h, units);
      break;
    case "sheet_yield":
      er = priceSheetYield(cfg, w, h, units, machine);
      break;
    case "unit_floor":
      er = priceUnitFloor(cfg, w, h, units);
      break;
  }

  if (er.noQuote) {
    return {
      ...finish(0, er.bindingRule, `אין מחיר — ${er.error ?? ""}`, er.error ?? ""),
      total: 0,
      unit: 0,
      belowCost: false,
      noQuote: true,
      configError: er.error ?? prepared.configErrors[0] ?? null,
    };
  }

  let raw = er.raw;
  let bindingRule = er.bindingRule;
  let noRound = er.noRound;
  const applied: BindingRule[] = [er.bindingRule];
  const detailParts: string[] = [er.detail];

  /* משקל נייר (פליירים: 170 גרם +8%) */
  if (opts.paperWeight && cfg.engine === "anchor_curve") {
    const pct = cfg.paperWeightPct[opts.paperWeight];
    if (pct && pct > 0) {
      raw *= 1 + pct;
      noRound = false;
      detailParts.push(`נייר ${opts.paperWeight} גר׳ +${Math.round(pct * 100)}%`);
    }
  }

  /* תוספת דו-צדדי לפי מדרגת כמות */
  let dualPct = 0;
  let dualValue = 0;
  if (opts.dualSided && cfg.dualSurcharge.length) {
    const tiers = [...cfg.dualSurcharge].sort(
      (a, b) => (a.maxQty ?? Infinity) - (b.maxQty ?? Infinity),
    );
    const t = tiers.find((x) => x.maxQty === null || units <= x.maxQty);
    if (t && t.pct > 0) {
      dualPct = t.pct;
      dualValue = raw * t.pct;
      raw *= 1 + t.pct;
      noRound = false;
      bindingRule = "dual_surcharge";
      applied.push("dual_surcharge");
      detailParts.push(`תוספת דו-צדדי +${Math.round(t.pct * 100)}% (${shekel(dualValue)})`);
    }
  }

  /* מינימום הזמנה בשקלים */
  if (cfg.minOrderValue > 0 && raw > 0 && raw < cfg.minOrderValue) {
    raw = cfg.minOrderValue;
    bindingRule = "min_order_value";
    applied.push("min_order_value");
    noRound = true;
    detailParts.push(`מינימום הזמנה ${shekel(cfg.minOrderValue)}`);
  }

  if (er.quoteOnly) detailParts.push("מידה זו אינה קטלוגית — הצעת מחיר לפי בקשה");
  if (machine.note) detailParts.push(machine.note);

  /* הצעה חלופית לא מחייבת — נוסחת דיגיטל (פליירים, עד digitalMaxQty) */
  const altQuote =
    cfg.engine === "anchor_curve" &&
    cfg.digitalPerUnit > 0 &&
    units <= (cfg.digitalMaxQty || Infinity)
      ? {
          label: `דיגיטל: ${shekel(cfg.digitalSetup)} + ${shekel(cfg.digitalPerUnit)} ליחידה`,
          total: roundPrice(cfg.digitalSetup + cfg.digitalPerUnit * units),
        }
      : null;

  const job = finish(
    raw,
    bindingRule,
    BINDING_LABEL[bindingRule],
    detailParts.filter(Boolean).join(" · "),
    { appliedRules: applied, altQuote, dualPct, dualValue },
    noRound,
  );

  /* אסרטת מונוטוניות — הנתונים כבר מנורמלים, לכן זו בדיקת הגנה בלבד.
     בדו-צדדי מדרגות התוספת יורדות בכוונה (20% → 10% ב-1000) — לא נבדק. */
  if (!opts.noAssert && !opts.dualSided && job.total > 0 && units > 1) {
    const probe = priceJob(cfg, anchors, w, h, units - 1, validated, {
      ...opts,
      prepared,
      noAssert: true,
    });
    if (probe && probe.total > 0 && !probe.noQuote && probe.total > job.total + 0.001) {
      job.monotoneViolation = true;
      job.detail += ` · ⚠ הפרת מונוטוניות: ${(units - 1).toLocaleString()} יח׳ = ${shekel(probe.total)}`;
    }
  }

  return job;
}

/* ------------------------------------------------------------------ *
 *  אמץ — בדיקת שפיות להצעת מחיר לפני אימוץ (bug #7)
 * ------------------------------------------------------------------ */

export type SuggestionCheck = { ok: boolean; reason?: string };

export function validateSuggestion(args: {
  w: number;
  h: number;
  qty: number;
  suggested: number;
  job?: JobPrice | null;
  cfg: FamilyPricing;
  anchors: JobAnchor[];
  validated?: JobAnchor[];
}): SuggestionCheck {
  const { w, h, qty, suggested, job, cfg, anchors } = args;
  const validated = args.validated ?? [];

  if (!Number.isFinite(suggested) || suggested <= 0)
    return { ok: false, reason: "הצעה לא תקינה — מחיר לא חיובי" };
  if (job && (job.overMachine || job.belowMinOrder || job.noQuote))
    return { ok: false, reason: "המנוע לא מחזיר מחיר לעבודה זו" };
  if (cfg.legacy) return { ok: false, reason: "תצורת משפחה ישנה — הגדירו מנוע תמחור לפני אימוץ" };
  const cfgErrors = validateFamilyPricing(cfg, anchors);
  if (cfgErrors.length) return { ok: false, reason: cfgErrors[0] ?? "תצורה שגויה" };

  const eps = Math.max(0.5, suggested * 0.01);
  const area = (w * h) / 10000;
  const pool = [...anchors, ...validated];
  for (const a of pool) {
    if (sameSize(a.w, a.h, w, h)) {
      if (a.qty < qty && a.price > suggested + eps)
        return {
          ok: false,
          reason: `שובר מונוטוניות כמות: ${a.qty.toLocaleString()} יח׳ = ${shekel(a.price)}`,
        };
      if (a.qty > qty && a.price < suggested - eps)
        return {
          ok: false,
          reason: `שובר מונוטוניות כמות: ${a.qty.toLocaleString()} יח׳ = ${shekel(a.price)}`,
        };
    } else if (a.qty === qty) {
      /* דומיננטיות: שני הממדים קטנים/גדולים — לא השוואת שטח עיוורת */
      const dominatedByJob =
        Math.max(a.w, a.h) <= Math.max(w, h) + DIM_TOL &&
        Math.min(a.w, a.h) <= Math.min(w, h) + DIM_TOL;
      const dominatesJob =
        Math.max(a.w, a.h) + DIM_TOL >= Math.max(w, h) &&
        Math.min(a.w, a.h) + DIM_TOL >= Math.min(w, h) &&
        a.area > area;
      if (dominatedByJob && a.area < area && a.price > suggested + eps)
        return { ok: false, reason: `שובר מונוטוניות גודל: ${a.w}×${a.h} = ${shekel(a.price)}` };
      if (dominatesJob && a.price < suggested - eps)
        return { ok: false, reason: `שובר מונוטוניות גודל: ${a.w}×${a.h} = ${shekel(a.price)}` };
    }
  }
  return { ok: true };
}
