/* ------------------------------------------------------------------ *
 *  pricing-defaults — the client-approved ground truth (Aug 2026).
 *
 *  Single source of truth consumed by:
 *    - the unit tests (acceptance + invariants)
 *    - scripts/generate-config-migration.ts (renders the SQL migration)
 *    - scripts/dry-run-report.ts (targets for the audit CSV)
 *
 *  Every number here comes from the approved spec document — do not
 *  edit prices without an explicit client decision.
 * ------------------------------------------------------------------ */
import type { FamilyPricing } from "./mdvd";

/** A complete FamilyPricing with neutral defaults; specs override fields. */
export function baseFamilyPricing(over: Partial<FamilyPricing> = {}): FamilyPricing {
  return {
    method: "area",
    thresholdW: 0,
    thresholdH: 0,
    cost: 0,
    outsourceCost: 0,
    margin: 1.3,
    rounding: 1,
    packages: [],
    minUnitArea: 1,
    shortRunPct: 0.7,
    qtyExponent: 1,
    qtyExponentPinned: false,
    qtyTiersEnabled: false,
    qtyTiers: [],
    sheetUnits: {},
    sheetW: 45,
    sheetH: 32,
    sheetMargin: 0,
    sheetGap: 0.5,
    minOrderQty: 0,
    maxPrintW: 0,
    maxPrintL: 0,
    overLimit: "weld",
    mountCostM2: 0,
    mountCostUnit: 0,
    capW: 0,
    capL: 0,
    wholeBoard: false,
    boardW: 0,
    boardH: 0,
    engine: "per_m2",
    legacy: false,
    shortRunRefQty: 100,
    minOrderValue: 0,
    dualSurcharge: [],
    outsourcedMarginFactor: 1.5,
    outsourcedVatIncluded: null,
    paperWeightPct: {},
    plan: null,
    sizeBuckets: [],
    qtyMultipliers: [],
    curveAnchors: [],
    tailPerUnit: null,
    perM2Tiers: [],
    minJobPrice: 0,
    sizeLadder: [],
    panoramicAspect: 0,
    panoramicPct: 0,
    yieldTable: [],
    vinylCostPerSheet: 0,
    formatPrices: [],
    digitalSetup: 0,
    digitalPerUnit: 0,
    digitalMaxQty: 0,
    todos: [],
    /* --- v3.3 --- */
    catalogBinds: "all",
    sheetPrice: 0,
    rollWidth: 0,
    outsourcedRateM2: 0,
    ...over,
  };
}

/* ------------------------------------------------------------------ *
 *  Family configs (keys = the EXACT family strings in the catalog)
 * ------------------------------------------------------------------ */

const FLYERS = baseFamilyPricing({
  engine: "anchor_curve",
  /* מתחת ל-10 יחידות: מחיר חבילת ה-10 (מינימום חבילה) */
  shortRunPct: 1.0,
  shortRunRefQty: 10,
  packages: [10, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 20000],
  sizeBuckets: [
    {
      id: "10/15",
      maxW: 10,
      maxH: 15,
      factor: 0.835,
      base100: null,
      quoteOnly: false,
      includes: [],
    },
    { id: "A5", maxW: 15, maxH: 21, factor: 1.0, base100: null, quoteOnly: false, includes: [] },
    { id: "A4", maxW: 21, maxH: 30, factor: 1.8, base100: null, quoteOnly: false, includes: [] },
    /* A3 אינו מק״ט — מתומחר לפי בקשה כ-A4 × 1.8 */
    { id: "A3", maxW: 30, maxH: 42, factor: 3.24, base100: null, quoteOnly: true, includes: [] },
  ],
  /* עקומת המאסטר: A5 חד-צדדי, כולל מע״מ (מאושר) */
  curveAnchors: [
    { size: "A5", qty: 10, price: 75 },
    { size: "A5", qty: 50, price: 85 },
    { size: "A5", qty: 100, price: 95 },
    { size: "A5", qty: 250, price: 140 },
    /* 8/23: "500 A5 = ₪232 באתר — לא לשכוח את המוצר הזה" */
    { size: "A5", qty: 500, price: 232 },
    { size: "A5", qty: 1000, price: 395 },
    { size: "A5", qty: 2000, price: 475 },
    { size: "A5", qty: 3000, price: 535 },
    { size: "A5", qty: 5000, price: 600 },
    { size: "A5", qty: 10000, price: 1093 },
    { size: "A5", qty: 12000, price: 1250 },
    { size: "A5", qty: 20000, price: 1600 },
    /* נקודות בסיס מאושרות לדליים האחרים */
    { size: "10/15", qty: 1000, price: 330 },
    { size: "A4", qty: 1000, price: 710 },
  ],
  /* דו-צדדי = חד-צדדי (לקוח 8/24 10:15) — אין תוספת */
  dualSurcharge: [],
  /* מעל 20,000: ‎+₪0.05 ליחידה (A5; מוכפל במקדם הדלי) */
  tailPerUnit: 0.05,
  /* העקומה = נייר 130 גרם; 170 גרם ‎+8%; ‏300 גרם → משפחת גלויות */
  paperWeightPct: { "170": 0.08 },
  /* הצעה חלופית (לא מחייבת): דיגיטל 72 + 0.32 ליחידה עד 1000 */
  digitalSetup: 72,
  digitalPerUnit: 0.32,
  digitalMaxQty: 1000,
});

const STICKERS = baseFamilyPricing({
  /* שתי מכונות (לקוח 2026-09-08/09 + הסרטון של ג׳נה):
     - מדפסת קטנה: גיליון 48.8×33 עם שוליים 1.5 ס״מ → שטח הדפסה 45.8×30.
       מדבקה שנכנסת לגיליון מתומחרת לפי גיליונות — ₪20 לגיליון לפי כמה
       נכנסות בו (1–4 מדבקות = ₪20) — ולעולם לא יותר מחבילת 100 היחידות
       של דלי הגודל (Q1: מתחת ל-100 = min(חבילה, max(גיליונות, חלק יחסי))).
     - חבילות האתר (100/150/200/250/500/1000) נשארות: מכמות 100 המחיר הוא
       עקומת הדליים, ורק שורות הקטלוג מכמות 100 ומעלה קובעות מחיר
       (catalog_binds = packs). הבודדים בקטלוג אינם קובעים עוד — לא אלה
       שנכנסים לדף הקטן ולא אלה שעל הדף הגדול — כי הם סותרים זה את זה
       למ״ר (0.14 מ״ר ב-₪95 מול 1.96 מ״ר ב-₪180).
     - דף גדול: מחייבים את החומר שנצרך מהגליל, לא את שטח המדבקה. הגליל ברוחב
       100 ס״מ נחתך לכל רוחבו (ג׳נה בסרטון), ולכן מדבקה 40×40 צורכת 100×40 =
       0.4 מ״ר ולא 0.16. בלי מרווח בין יחידות: 4 × 50×50 = 2 בשורה × 2 שורות =
       100×100 = מטר רבוע בדיוק = ₪95 (המספר שהלקוח נתן 9/23). מדבקה רחבה
       מ-100 עוברת לגליל הרחב (max_print_w), ורחבה משניהם בצידה הצר מחולקת
       לחלקים שכל אחד מבזבז את רוחב הגליל שלו.
       התעריף: ₪95 למ״ר, מחיר אחד לכל מידה
       (ג׳נה 9/3 "לחשב לפי מ״ר"; הלקוח 9/23 "מטר מרובע לא אמור להשתנות
       במחיר", ו-4 × 50×50 = מטר רבוע = ₪95). השטח הוא של כל היחידות יחד,
       ומינימום העבודה הוא ₪20 — מחיר דף קטן אחד — כדי שמדבקה מעט גדולה
       מהדף הקטן לא תעלה פחות מדף. רוחב הדפסה 120 — מעל זה מחלקים לשני
       חלקים באותו מחיר (9/3); גבול ייצור מוחלט 150.
     - עלות: ג׳נה (9/23) — 1000 × 10/15 עולה לו ₪700, כלומר 250 דפים →
       ₪2.80 לדף קטן הכול כלול (cost). לדף הגדול ₪6 למ״ר חומר (8/23,
       outsourceCost). רצפת עלות (cost_floor) מונעת מחיר מתחת לעלות × 1.3 —
       היום שתי חבילות באתר נמכרות בהפסד (10/15 של 500 ו-1000).
     - אין מינימום הזמנה (9/8, 9/9) ואין מדרגות כמות. */
  engine: "two_machine_sheet",
  catalogBinds: "packs",
  shortRunRefQty: 100,
  packages: [100, 150, 200, 250, 500, 1000],
  /* ₪ לדף קטן, הכול כלול (המנוע מכפיל במספר הדפים) */
  cost: 2.8,
  sheetW: 48.8,
  sheetH: 33,
  sheetMargin: 1.5,
  sheetGap: 0.5,
  sheetPrice: 20,
  /* כוונון ידני מהמסך (הגיליון הישן 42×29 נתן 35 אוטומטית; החדש נותן 40) —
     אינו משפיע על אף מחיר מוסכם, כי מ-16 יח׳ החלק היחסי מהחבילה גובר */
  sheetUnits: { "5x5": 30 },
  minOrderQty: 0,
  /* דף גדול: תעריף אחד לכל מידה, על החומר שנצרך מהגליל */
  perM2Tiers: [{ minM2: 0, rate: 95 }],
  rollWidth: 100,
  /* מינימום עבודה בדף הגדול = מחיר דף קטן אחד */
  minJobPrice: 20,
  maxPrintW: 120,
  overLimit: "weld",
  capW: 150,
  /* לעולם לא מתחת לעלות × מקדם הרווח */
  plan: { modifiers: [{ kind: "cost_floor" }] },
  /* חומרים (ויניל / חיתוך צורני / שקוף): הלקוח ביקש בלי בורר חומר (9/23) —
     המקדם material_surcharge קיים בקוד ואפשר להפעילו דרך plan.modifiers */
  /* ---- חבילות האתר: דלי גודל × מקדם כמות (מהקטלוג, מחירי 100 יח׳) ---- */
  sizeBuckets: [
    { id: "3", maxW: 3, maxH: 3, factor: null, base100: 115, quoteOnly: false, includes: [] },
    { id: "4", maxW: 4, maxH: 4, factor: null, base100: 121, quoteOnly: false, includes: [] },
    /* 8×5 = ₪126 בקטלוג, ולכן חריג מפורש לדלי הזה ולא לדלי 9 */
    { id: "5", maxW: 5, maxH: 5, factor: null, base100: 126, quoteOnly: false, includes: ["8x5"] },
    { id: "6", maxW: 6, maxH: 6, factor: null, base100: 137, quoteOnly: false, includes: [] },
    { id: "8", maxW: 8, maxH: 8, factor: null, base100: 148, quoteOnly: false, includes: [] },
    { id: "9", maxW: 9, maxH: 9, factor: null, base100: 154, quoteOnly: false, includes: [] },
    /* אשכול ה-₪187 בקטלוג (16×6 · 10×10 · 24×6 · 15×10) — קיבוץ לפי שטח */
    { id: "24x12", maxW: 24, maxH: 12, factor: null, base100: 187, quoteOnly: false, includes: [] },
    /* 17×17 ‎× 80 = ₪270 בקטלוג → ₪287 ל-100 יח׳ */
    { id: "42x20", maxW: 42, maxH: 20, factor: null, base100: 287, quoteOnly: false, includes: [] },
  ],
  /* מקדמי הכמות המשותפים, כפי שנמדדו מהקטלוג (ממוצע גאומטרי על כל המידות) */
  qtyMultipliers: [
    { qty: 100, mult: 1.0 },
    { qty: 150, mult: 1.06 },
    { qty: 200, mult: 1.163 },
    { qty: 250, mult: 1.295 },
    { qty: 500, mult: 1.832 },
    { qty: 1000, mult: 3.049 },
  ],
  /* עלות החומר בדף הגדול, ₪ למ״ר (ג׳נה 8/23) — מזינה את רצפת העלות */
  outsourceCost: 6,
  outsourcedMarginFactor: 1.35,
});

const SHIMSHONIT = baseFamilyPricing({
  engine: "per_m2",
  cost: 20,
  /* עלות ייצור החוץ של ג׳נה (8/31: "35 זה העלות שלי") — לשורת העלות בלבד */
  outsourceCost: 35,
  /* עד 1 מ״ר: מינימום ₪70 לעבודה (8/23: "המחיר שהיה פעם זה 70 שח") */
  minUnitArea: 1,
  minJobPrice: 70,
  perM2Tiers: [
    { minM2: 0, rate: 85 },
    { minM2: 2, rate: 75 },
    { minM2: 4, rate: 72 },
  ],
  /* הצד הצר מעל 150 ס״מ → ייצור חוץ, ₪80 למ״ר שטוח ללקוח (8/31 → 9/1 "כן זה
     מה שהוא אמר"); עם תפר = ריתוך פאנלים בבית לפי המדרגות */
  maxPrintW: 150,
  maxPrintL: 0,
  overLimit: "outsource",
  outsourcedRateM2: 80,
  outsourcedMarginFactor: 1.5,
  outsourcedVatIncluded: null,
  /* שורות הקטלוג: רק עוגנים (is_anchor) קובעים מחיר — 120/80 = 90, 120/100 = 105,
     200/100 = 150 וכו׳. המידות הישנות של ייצור החוץ (~₪104 למ״ר, למשל
     200/200 = 416) אינן קובעות עוד. חבילת 120/80×10 = ₪470 שייכת לפוליגל
     (מבצע מרץ) — לא לשמשונית. */
  catalogBinds: "anchors",
});

const PVC = baseFamilyPricing({
  engine: "size_ladder",
  cost: 6,
  /* מחירון הלקוח (8/19): 20×30 = 35 · 30×60 = 60 · 30×80 = 80 · 30×90 = 90 ·
     40×60 = 70 — התאמה מדויקת גוברת על אינטרפולציה לפי שטח */
  sizeLadder: [
    { w: 20, h: 30, price: 35 },
    { w: 30, h: 40, price: 40 },
    { w: 30, h: 60, price: 60 },
    { w: 40, h: 60, price: 70 },
    { w: 50, h: 50, price: 80 },
    { w: 30, h: 80, price: 80 },
    { w: 30, h: 90, price: 90 },
    { w: 50, h: 70, price: 100 },
    { w: 100, h: 40, price: 115 },
    { w: 50, h: 100, price: 145 },
    { w: 60, h: 90, price: 150 },
    { w: 100, h: 70, price: 155 },
    { w: 70, h: 140, price: 200 },
    { w: 120, h: 80, price: 200 },
    { w: 100, h: 150, price: 300 },
    { w: 80, h: 200, price: 350 },
  ],
  /* גבול ייצור (הנחה, Q8 — הלקוח לא מסר): 150×300 */
  capW: 150,
  capL: 300,
  overLimit: "block",
});

const POLYGAL = baseFamilyPricing({
  /* לקוח 8/18: "לבודדים נעשה 90 שח" — גם 60×40 וגם 120×80 (נטלי: החומר נזרק
     ממילא). 10 × 120/80 = ₪470 (מבצע מרץ, כולל טבעות ומשלוח); 40/40 × 10 = ₪295.
     ₪80 למ״ר עם מינימום ₪90 נותן 90 לכל מידה עד ~1.1 מ״ר, ומעלה בהמשכיות
     (150×100 = 120, 200×100 = 160 — הנחה, Q5/Q6). מעל 150 רוחב → ייצור חוץ
     ₪80 למ״ר (Q6). שורות הקטלוג (₪55–70 לבודדים) נדחו — נוסחה בלבד. */
  engine: "per_m2",
  cost: 6,
  outsourceCost: 60,
  minUnitArea: 1,
  minJobPrice: 90,
  perM2Tiers: [{ minM2: 0, rate: 80 }],
  maxPrintW: 150,
  overLimit: "outsource",
  outsourcedRateM2: 80,
  /* חבילות: כל מידה שנכנסת ב-120/80 → ₪47 ליחידה מ-10; עד 40/40 → ₪29.5.
     בין 2 ל-9 יחידות: ליניארי מ-₪90 לבודד עד מחיר החבילה. */
  qtyTiersEnabled: true,
  qtyTiers: [
    { minQty: 10, unitPrice: 47, size: "120x80" },
    { minQty: 10, unitPrice: 29.5, size: "40x40" },
  ],
  catalogBinds: "none",
});

const CANVAS = baseFamilyPricing({
  engine: "size_ladder",
  cost: 15,
  sizeLadder: [
    { w: 20, h: 20, price: 59 },
    { w: 30, h: 30, price: 95 },
    { w: 30, h: 40, price: 105 },
    { w: 30, h: 45, price: 110 },
    { w: 50, h: 30, price: 115 },
    { w: 30, h: 60, price: 120 },
    { w: 50, h: 40, price: 140 },
    { w: 50, h: 75, price: 159 },
    { w: 90, h: 90, price: 230 },
    { w: 100, h: 70, price: 245 },
    { w: 80, h: 120, price: 255 },
    { w: 70, h: 140, price: 281 },
    { w: 90, h: 120, price: 280 },
    { w: 120, h: 100, price: 310 },
    { w: 60, h: 180, price: 365 },
    { w: 150, h: 100, price: 385 },
  ],
  /* פנורמי: יחס ≥ 2.4 → ‎+10% (על מידות מחושבות, לא על נקודות סולם) */
  panoramicAspect: 2.4,
  panoramicPct: 0.1,
  /* תוספת 2026-09-03: רוחב 140 (היה 150). האורך 200 ומדיניות החריגה
     (סירוב מול מיקור חוץ) ממתינים לאישור הלקוח. */
  capW: 140,
  capL: 200,
  overLimit: "block",
  maxPrintW: 140,
  maxPrintL: 200,
});

const GLASS = baseFamilyPricing({
  engine: "size_ladder",
  sizeLadder: [
    { w: 20, h: 30, price: 160 },
    /* יעד מאושר 650–700 — נקבע אמצע הטווח */
    { w: 100, h: 70, price: 675 },
    { w: 120, h: 80, price: 1035 },
  ],
});

const KAPA = baseFamilyPricing({
  engine: "sheet_yield",
  /* גיליון 240×120: חומר ₪40 + ויניל ₪6 — המחיר מדורג לפי יח׳ בגיליון */
  sheetW: 240,
  sheetH: 120,
  sheetMargin: 0,
  sheetGap: 0,
  cost: 40,
  vinylCostPerSheet: 6,
  /* רצפת העלות מחייבת: העלות (40 לוח + 6 ויניל) אושרה מול הלקוח ב-2026-08-23,
     ולכן מחיר שמתחת לעלות×מקדם הוא טעות, לא הצעה. למדבקות היא כבויה עד
     שיאושר אם ₪6 הוא לגיליון או למ״ר (פער של פי 7). */
  plan: { modifiers: [{ kind: "cost_floor" }] },
  /* הדפסה ישירה עד 60/90; מעבר לכך — ויניל מודבק (קפיצת מחיר ~₪25) */
  maxPrintW: 60,
  maxPrintL: 90,
  overLimit: "mount",
  mountCostUnit: 25,
  /* הלוח 240×120 — אין חתיכה רחבה מ-120; החומר מחויב בלוח שלם (הכלל החי) */
  capW: 120,
  capL: 240,
  wholeBoard: true,
  boardW: 240,
  boardH: 120,
  /* טבלת התפוקה תתווסף לאחר אימות מול המפעל */
  yieldTable: [],
  todos: ["קאפה: מחירי מדרגות תפוקה (יח׳ בגיליון) טרם אומתו מול הלקוח (TODO)"],
});

const INVOICES = baseFamilyPricing({
  engine: "unit_floor",
  formatPrices: [
    { label: "A5 × 10 פנקסים", w: 14.8, h: 21, qty: 10, price: 320 },
    { label: "שישיות × 10 פנקסים", w: null, h: null, qty: 10, price: 418 },
    { label: "A4 × 10 פנקסים", w: 21, h: 29.7, qty: 10, price: 418 },
    { label: "A4 × 20 פנקסים", w: 21, h: 29.7, qty: 20, price: 858 },
  ],
  todos: ["חשבוניות: מספר סטים לפנקס (25/50) טרם אומת בסנזיי — המחיר עשוי להשתנות (TODO)"],
});

const SECURITY_STICKERS = baseFamilyPricing({
  engine: "unit_floor",
  /* מינימום הזמנה ₪250 כולל מע״מ (AllPrint גובה ₪250 לפני מע״מ) */
  minOrderValue: 250,
});

/**
 * ההגדרות המאושרות לכל משפחה — המפתחות הם מחרוזות המשפחה המדויקות בקטלוג.
 * חשבוניות ופנקסים הן שתי משפחות נפרדות במסד — אותה תצורה לשתיהן.
 */
/* תוספת 2026-09-03: פרספקס נכנס כמשפחת גדם עד שיגיע גיליון העלויות.
   זו הדוגמה למה שהתוכנית קונה — משפחה חדשה היא נתונים, בלי קוד מנוע. */
const PERSPEX = baseFamilyPricing({
  engine: "size_ladder",
  plan: { gates: [{ kind: "quote_only", note: "פרספקס — ממתין לגיליון עלויות מהלקוח" }] },
  todos: ["פרספקס: אין עדיין עלויות ומחירים — כל מידה מוחזרת כהצעת מחיר (TODO לקוח)"],
});

export const SPEC_FAMILY_CONFIGS: Record<string, FamilyPricing> = {
  פליירים: FLYERS,
  מדבקות: STICKERS,
  שמשונית: SHIMSHONIT,
  "שלטי PVC": PVC,
  פוליגל: POLYGAL,
  קנבס: CANVAS,
  זכוכית: GLASS,
  קאפה: KAPA,
  חשבוניות: INVOICES,
  פנקסים: INVOICES,
  פרספקס: PERSPEX,
};

/** משפחה אופציונלית — נוצרת רק באישור הלקוח (בלוק מוער במיגרציה). */
export const OPTIONAL_FAMILY_CONFIGS: Record<string, FamilyPricing> = {
  "מדבקה בטחונית": SECURITY_STICKERS,
};

/* ------------------------------------------------------------------ *
 *  Approved catalog anchors — seeded as verified is_anchor products
 *  where the engine formula alone cannot reproduce the approved price.
 * ------------------------------------------------------------------ */
export type SpecAnchor = { family: string; w: number; h: number; qty: number; price: number };

export const SPEC_ANCHORS: SpecAnchor[] = [
  /* שמשונית — נקודות מאושרות שהנוסחה לבדה אינה נותנת */
  { family: "שמשונית", w: 120, h: 80, qty: 1, price: 90 },
  { family: "שמשונית", w: 120, h: 100, qty: 1, price: 105 },
  { family: "שמשונית", w: 200, h: 100, qty: 1, price: 150 },
];

/* ------------------------------------------------------------------ *
 *  Dry-run targets — approved points + directional targets (spec §10)
 * ------------------------------------------------------------------ */
export type Target = {
  family: string;
  w?: number;
  h?: number;
  qty?: number;
  /** substring the product name must contain (fallback matcher) */
  nameLike?: string;
  price?: number;
  priceMin?: number;
  priceMax?: number;
  source: string;
};

export const TARGETS: Target[] = [
  /* פליירים — עקומת A5 */
  { family: "פליירים", w: 15, h: 21, qty: 200, price: 125, source: "ספק: 351 → ₪125" },
  { family: "פליירים", w: 15, h: 21, qty: 300, price: 170, source: "ספק: 417 → ₪170" },
  { family: "פליירים", w: 15, h: 21, qty: 500, price: 232, source: "מחיר האתר (8/23)" },
  { family: "פליירים", w: 15, h: 21, qty: 1000, price: 395, source: "עקומת A5 מאושרת" },
  { family: "פליירים", w: 15, h: 21, qty: 2000, price: 475, source: "עקומת A5 מאושרת" },
  { family: "פליירים", w: 15, h: 21, qty: 3000, price: 535, source: "עקומת A5 מאושרת" },
  { family: "פליירים", w: 15, h: 21, qty: 5000, price: 600, source: "עקומת A5 מאושרת" },
  { family: "פליירים", w: 15, h: 21, qty: 10000, price: 1093, source: "עקומת A5 מאושרת" },
  { family: "פליירים", w: 10, h: 15, qty: 1000, price: 330, source: "בסיס 10/15 מאושר" },
  { family: "פליירים", w: 21, h: 29.7, qty: 1000, price: 710, source: "בסיס A4 מאושר" },
  /* מדבקות */
  { family: "מדבקות", w: 3, h: 3, qty: 1000, price: 299, source: "מדרגת 1000 מאושרת" },
  { family: "מדבקות", w: 4, h: 4, qty: 1000, price: 310, source: "מדרגת 1000 מאושרת" },
  { family: "מדבקות", w: 5, h: 5, qty: 1000, price: 345, source: "מדרגת 1000 מאושרת" },
  { family: "מדבקות", w: 6, h: 6, qty: 500, price: 249, source: "תיקון נתונים מאושר" },
  { family: "מדבקות", w: 6, h: 6, qty: 1000, price: 370, source: "מדרגת 1000 מאושרת" },
  { family: "מדבקות", w: 9, h: 9, qty: 1000, price: 420, source: "תיקון נתונים מאושר" },
  { family: "מדבקות", w: 5, h: 9, qty: 500, price: 174, source: "סולם 5×9 מאושר" },
  { family: "מדבקות", w: 5, h: 9, qty: 1000, price: 245, source: "סולם 5×9 מאושר" },
  /* שמשונית */
  { family: "שמשונית", w: 60, h: 40, qty: 1, price: 70, source: "מינימום ₪70 (8/23)" },
  { family: "שמשונית", w: 120, h: 10, qty: 1, price: 70, source: "מינימום ₪70 (8/23)" },
  { family: "שמשונית", w: 120, h: 80, qty: 1, price: 90, source: "נקודה מאושרת" },
  { family: "שמשונית", w: 120, h: 100, qty: 1, price: 105, source: "נקודה מאושרת" },
  { family: "שמשונית", w: 200, h: 100, qty: 1, price: 150, source: "נקודה מאושרת" },
  { family: "שמשונית", w: 200, h: 200, qty: 1, price: 320, source: "ייצור חוץ ₪80 למ״ר (8/31, 9/1)" },
  { family: "שמשונית", w: 300, h: 200, qty: 1, price: 480, source: "ייצור חוץ ₪80 למ״ר (8/31, 9/1)" },
  { family: "שמשונית", w: 400, h: 200, qty: 1, price: 640, source: "ייצור חוץ ₪80 למ״ר (8/31, 9/1)" },
  { family: "שמשונית", w: 500, h: 300, qty: 1, price: 1200, source: "ייצור חוץ ₪80 למ״ר (8/31, 9/1)" },
  { family: "שמשונית", w: 600, h: 400, qty: 1, price: 1920, source: "ייצור חוץ ₪80 למ״ר (8/31, 9/1)" },
  /* PVC */
  { family: "שלטי PVC", w: 20, h: 30, qty: 1, price: 35, source: "מחירון הלקוח 8/19" },
  { family: "שלטי PVC", w: 30, h: 60, qty: 1, price: 60, source: "מחירון הלקוח 8/19" },
  { family: "שלטי PVC", w: 30, h: 80, qty: 1, price: 80, source: "מחירון הלקוח 8/19" },
  { family: "שלטי PVC", w: 40, h: 60, qty: 1, price: 70, source: "מחירון הלקוח 8/19" },
  { family: "שלטי PVC", w: 30, h: 90, qty: 1, price: 90, source: "סולם מאושר" },
  {
    family: "שלטי PVC",
    w: 80,
    h: 200,
    qty: 1,
    price: 350,
    source: "סולם מאושר (מחיקת כפילות 754/760)",
  },
  /* פוליגל */
  { family: "פוליגל", w: 120, h: 80, qty: 1, price: 90, source: "בודדים ₪90 (8/18)" },
  { family: "פוליגל", w: 60, h: 40, qty: 1, price: 90, source: "בודדים ₪90 (8/18)" },
  { family: "פוליגל", w: 120, h: 80, qty: 10, price: 470, source: "מבצע מרץ — 10 שלטים ₪470" },
  { family: "פוליגל", w: 40, h: 40, qty: 10, price: 295, source: "חבילה מאושרת" },
  /* קנבס */
  { family: "קנבס", w: 20, h: 20, qty: 1, price: 59, source: "הוזלה מאושרת" },
  { family: "קנבס", w: 90, h: 90, qty: 1, price: 230, source: "העלאה מאושרת" },
  { family: "קנבס", w: 70, h: 140, qty: 1, price: 281, source: "איחוד 140/70↔70/140" },
  { family: "קנבס", w: 100, h: 70, qty: 1, price: 245, source: "איחוד 100/70+70/100" },
  /* זכוכית */
  { family: "זכוכית", w: 20, h: 30, qty: 1, price: 160, source: "נשמר" },
  {
    family: "זכוכית",
    w: 100,
    h: 70,
    qty: 1,
    priceMin: 650,
    priceMax: 700,
    source: "יעד מאושר (מ-₪800)",
  },
  { family: "זכוכית", w: 120, h: 80, qty: 1, price: 1035, source: "שיא השוק — נשמר" },
  /* חשבוניות / פנקסים */
  { family: "חשבוניות", w: 14.8, h: 21, qty: 10, price: 320, source: "מחיר מבנה אחיד" },
  { family: "חשבוניות", w: 21, h: 29.7, qty: 10, price: 418, source: "מחיר מבנה אחיד" },
  { family: "חשבוניות", w: 21, h: 29.7, qty: 20, price: 858, source: "מחיר מבנה אחיד" },
  { family: "פנקסים", w: 14.8, h: 21, qty: 10, price: 320, source: "מחיר מבנה אחיד" },
  /* §10 — יעדים כיווניים */
  {
    family: "כרטיסי ביקור",
    qty: 1000,
    priceMin: 200,
    priceMax: 220,
    source: "יעד כיווני: 276 → ~210",
  },
  { family: "כרטיסי ביקור", qty: 5000, priceMin: 800, priceMax: 900, source: "יעד כיווני: ~850" },
  {
    family: "מגנטים",
    w: 9,
    h: 5,
    qty: 1000,
    priceMin: 220,
    priceMax: 260,
    source: "יעד כיווני: מגנט כרטיס ביקור",
  },
  {
    family: "מגנטים",
    w: 10,
    h: 10,
    qty: 1000,
    priceMin: 600,
    priceMax: 700,
    source: "יעד כיווני: 920 → 600–700",
  },
  {
    family: "מעטפות",
    qty: 1000,
    nameLike: "צבע",
    priceMin: 450,
    priceMax: 490,
    source: "יעד כיווני: 650 → ~470",
  },
  { family: "פולדר", qty: 100, priceMin: 650, priceMax: 750, source: "יעד כיווני: 1000 → ~700" },
  { family: "כוסות", qty: 1, priceMin: 49, priceMax: 55, source: "יעד כיווני: 70 → 49–55" },
  {
    family: "הדפסה על חפצים",
    nameLike: "עטים",
    qty: 500,
    priceMin: 950,
    priceMax: 1100,
    source: "יעד כיווני: 2146 → 950–1100",
  },
  { family: "רול אפ", qty: 1, nameLike: "רול אפ", price: 215, source: "נשמר" },
];

/**
 * קובץ המיגרציה שמייצר scripts/generate-config-migration.ts מהזרעים כאן.
 * הבדיקה pricing-defaults.test.ts מוודאת שהקובץ המחויב שווה לזרעים.
 */
export const PRICING_MIGRATION_FILE =
  "supabase/migrations/20260922120000_pricing_config_client_rules.sql";

/** מע״מ — עוגני מתחרים שפורסמו לפני מע״מ מוכפלים ב-1.18 לפני השוואה. */
export const VAT_FACTOR = 1.18;
