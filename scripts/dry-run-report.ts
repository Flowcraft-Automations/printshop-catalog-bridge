/* ------------------------------------------------------------------ *
 *  dry-run-report — audits every catalog SKU against the approved
 *  SPEC pricing engines and emits the manual-edit worklists.
 *
 *  Usage:
 *    bun run scripts/dry-run-report.ts --csv <catalog-export.csv> \
 *        [--json <products.json>] [--out-dir reports]
 *
 *  Input:  --json  array of product rows from a DB SELECT (preferred —
 *                  has final_price), else
 *          --csv   the Hebrew catalog CSV export (final_price absent;
 *                  current price = senzey ?? site, noted in the output).
 *
 *  Output (UTF-8 BOM + CRLF, plain numbers):
 *    reports/dry-run-2026-08-25.csv          — full audit
 *    reports/worklist-senzey-2026-08-25.csv  — manual edits in Senzey
 *    reports/worklist-site-2026-08-25.csv    — manual edits on the site
 *
 *  Offline by construction: prices against SPEC_FAMILY_CONFIGS (never
 *  the DB config) and never imports the supabase client.
 * ------------------------------------------------------------------ */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { parseCsv, writeCsv, HEADER_MAP } from "./lib/csv";
import { parseNumber } from "../src/lib/parse";
import {
  readFamilyPricing,
  writeFamilyPricing,
  priceJob,
  prepareFamily,
  familyAnchors,
  familyValidated,
  BINDING_LABEL,
  type Family,
  type Product,
  type JobAnchor,
  type PreparedFamily,
  type FamilyPricing,
  type JobPrice,
} from "../src/lib/mdvd";
import {
  SPEC_FAMILY_CONFIGS,
  SPEC_ANCHORS,
  TARGETS,
  type Target,
} from "../src/lib/pricing-defaults";

/* ------------------------------- args ------------------------------ */

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? (process.argv[i + 1] as string) : null;
}

const REPO_ROOT = resolve(import.meta.dir, "..");
const csvPath = argValue("--csv");
const jsonPath = argValue("--json");
const outDirArg = argValue("--out-dir") ?? "reports";
const OUT_DIR = isAbsolute(outDirArg) ? outDirArg : resolve(REPO_ROOT, outDirArg);
const STAMP = "2026-08-25";

if (!csvPath && !jsonPath) {
  console.error(
    "usage: bun run scripts/dry-run-report.ts --csv <path> [--json <path>] [--out-dir reports]",
  );
  process.exit(1);
}

/* --------------------------- load products ------------------------- */

const NUMERIC = new Set([
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
const BOOL = new Set(["senzey_exists", "site_exists", "verified", "is_anchor"]);

const toBool = (v: unknown): boolean =>
  v === true || v === "true" || String(v ?? "").trim() === "כן";

function blankProduct(): Product {
  return {
    id: "",
    row_key: "",
    name: "",
    family: null,
    width_cm: null,
    height_cm: null,
    qty: null,
    senzey_exists: null,
    senzey_ids: null,
    senzey_price: null,
    senzey_dup_count: null,
    site_exists: null,
    site_url: null,
    site_price: null,
    final_price: null,
    senzey_status: "",
    site_status: "",
    anomaly: null,
    notes: null,
    source: null,
    verified: false,
    is_anchor: false,
  };
}

function loadFromJson(path: string): Product[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>[];
  return raw.map((r, i) => {
    const p = blankProduct();
    for (const [k, v] of Object.entries(r)) {
      if (NUMERIC.has(k)) (p as Record<string, unknown>)[k] = parseNumber(v);
      else if (BOOL.has(k)) (p as Record<string, unknown>)[k] = toBool(v);
      else (p as Record<string, unknown>)[k] = v == null ? null : String(v);
    }
    p.id = String(r["id"] ?? r["row_key"] ?? i);
    p.row_key = String(r["row_key"] ?? p.id);
    p.name = String(r["name"] ?? p.row_key);
    if (p.family) p.family = p.family.trim();
    return p;
  });
}

function loadFromCsv(path: string): Product[] {
  const rows = parseCsv(readFileSync(path, "utf8"));
  const header = rows[0] ?? [];
  const fieldAt: (string | null)[] = header.map((h) => HEADER_MAP[h.trim()] ?? null);
  const out: Product[] = [];
  for (const r of rows.slice(1)) {
    if (r.length <= 1) continue;
    const p = blankProduct();
    for (let i = 0; i < fieldAt.length; i++) {
      const f = fieldAt[i];
      if (!f) continue;
      const v = r[i] ?? "";
      if (NUMERIC.has(f)) (p as Record<string, unknown>)[f] = parseNumber(v);
      else if (BOOL.has(f)) (p as Record<string, unknown>)[f] = toBool(v);
      else (p as Record<string, unknown>)[f] = v === "" ? null : v;
    }
    if (!p.row_key) continue;
    p.id = p.row_key;
    p.name = p.name || p.row_key;
    if (p.family) p.family = p.family.trim();
    out.push(p);
  }
  return out;
}

const products: Product[] = jsonPath ? loadFromJson(jsonPath) : loadFromCsv(csvPath as string);

/* -------------------- per-family engine preparation ----------------- */

type FamilyCtx = {
  cfg: FamilyPricing;
  anchors: JobAnchor[];
  validated: JobAnchor[];
  prepared: PreparedFamily;
};

/** Family object seeded from the SPEC config — the dry run prices against
 *  the approved spec, never against whatever the DB currently stores. */
function specFamily(name: string): Family {
  const seed = SPEC_FAMILY_CONFIGS[name]!;
  return {
    family: name,
    items_count: null,
    notes: null,
    cost_per_m2: seed.cost,
    outsource_cost_per_m2: seed.outsourceCost,
    outsource_width_cm: seed.thresholdW || null,
    outsource_height_cm: seed.thresholdH || null,
    pricing_config: writeFamilyPricing(seed),
  };
}

const ctxByFamily = new Map<string, FamilyCtx>();
for (const name of Object.keys(SPEC_FAMILY_CONFIGS)) {
  const cfg = readFamilyPricing(specFamily(name));
  const anchors = familyAnchors(products, name);
  for (const a of SPEC_ANCHORS) {
    if (a.family !== name) continue;
    anchors.push({
      id: `spec-anchor-${a.w}x${a.h}-${a.qty}`,
      name: `עוגן מפרט ${a.w}/${a.h}`,
      w: a.w,
      h: a.h,
      area: (a.w * a.h) / 10000,
      qty: a.qty,
      price: a.price,
    });
  }
  anchors.sort((x, y) => x.area - y.area || x.qty - y.qty);
  /* validated pool: drop (size, qty) groups whose verified rows DISAGREE on
     price (e.g. the שמשונית 120/100 ₪80-vs-₪105 dup, the חשבוניות ₪280 row)
     — a conflicting "verified" price would contaminate P0 matches of the
     other rows; the spec engine decides those instead. */
  const validatedRaw = familyValidated(products, name);
  const groups = new Map<string, JobAnchor[]>();
  for (const v of validatedRaw) {
    const k = `${Math.max(v.w, v.h)}x${Math.min(v.w, v.h)}|${v.qty}`;
    groups.set(k, [...(groups.get(k) ?? []), v]);
  }
  const validated: JobAnchor[] = [];
  for (const g of groups.values()) {
    const prices = g.map((v) => v.price);
    if (Math.max(...prices) - Math.min(...prices) <= 0.01) validated.push(...g);
  }
  ctxByFamily.set(name, { cfg, anchors, validated, prepared: prepareFamily(cfg, anchors) });
}

/* ---------------------------- target match -------------------------- */

const DIM_TOL = 0.51;
const dimsMatch = (t: Target, w: number, h: number) =>
  t.w !== undefined &&
  t.h !== undefined &&
  Math.abs(Math.max(t.w, t.h) - Math.max(w, h)) <= DIM_TOL &&
  Math.abs(Math.min(t.w, t.h) - Math.min(w, h)) <= DIM_TOL;

function targetPrice(t: Target): number {
  if (t.price !== undefined) return t.price;
  if (t.priceMin !== undefined && t.priceMax !== undefined) return (t.priceMin + t.priceMax) / 2;
  return t.priceMin ?? t.priceMax ?? 0;
}

function findTarget(p: Product): Target | null {
  const fam = p.family ?? "";
  const qty = p.qty && p.qty > 0 ? p.qty : 1;
  const w = p.width_cm ?? 0;
  const h = p.height_cm ?? 0;
  const pool = TARGETS.filter((t) => t.family === fam && (t.qty === undefined || t.qty === qty));
  /* 1: exact dims (orientation-insensitive) · 2: name substring · 3: family+qty */
  return (
    pool.find((t) => w > 0 && h > 0 && dimsMatch(t, w, h)) ??
    pool.find((t) => t.nameLike !== undefined && p.name.includes(t.nameLike)) ??
    pool.find((t) => t.w === undefined && t.nameLike === undefined) ??
    null
  );
}

/* ------------------------------ audit ------------------------------- */

const DUAL_RE = /דו[\s-]?צדדי/;
const r2 = (n: number) => Math.round(n * 100) / 100;
const r1 = (n: number) => Math.round(n * 10) / 10;

type AuditRow = {
  p: Product;
  current: number | null;
  currentSource: string;
  job: JobPrice | null;
  engine: number | null;
  target: Target | null;
  targetP: number | null;
  dCur: number | null;
  dTar: number | null;
  flag: string;
  notes: string;
};

const audit: AuditRow[] = [];
for (const p of products) {
  const fam = (p.family ?? "").trim();
  const ctx = fam ? ctxByFamily.get(fam) : undefined;

  const current = p.final_price ?? p.senzey_price ?? p.site_price ?? null;
  const currentSource =
    p.final_price != null
      ? "final_price"
      : p.senzey_price != null
        ? "senzey_price"
        : p.site_price != null
          ? "site_price"
          : "";

  let job: JobPrice | null = null;
  if (ctx && p.width_cm && p.height_cm && p.width_cm > 0 && p.height_cm > 0) {
    /* self-exclusion: a verified row would otherwise trivially P0-match its
       own catalog price and hide every deviation from the spec curve */
    const validatedForRow = ctx.validated.filter((v) => v.id !== p.id);
    job = priceJob(
      ctx.cfg,
      ctx.anchors,
      p.width_cm,
      p.height_cm,
      p.qty && p.qty > 0 ? p.qty : 1,
      validatedForRow,
      { prepared: ctx.prepared, dualSided: DUAL_RE.test(p.name) },
    );
  }
  const engine = job && !job.noQuote && job.total > 0 ? job.total : null;

  const target = findTarget(p);
  const targetP = target ? targetPrice(target) : null;

  const dCur =
    engine != null && current != null && current > 0 ? ((engine - current) / current) * 100 : null;
  const baseForTarget = engine ?? current;
  const dTar =
    targetP != null && targetP > 0 && baseForTarget != null && baseForTarget > 0
      ? ((baseForTarget - targetP) / targetP) * 100
      : null;

  let flag = "";
  if (fam && !SPEC_FAMILY_CONFIGS[fam]) flag = "NO_ENGINE";
  else if (job && (job.noQuote || job.total <= 0)) flag = "NO_QUOTE";
  else if (current == null) flag = "NO_PRICE";
  else if ((dCur != null && Math.abs(dCur) > 3) || (dTar != null && Math.abs(dTar) > 3))
    flag = "REVIEW";

  const notes: string[] = [];
  if (job?.configError) notes.push(job.configError);
  if (job?.monotoneViolation) notes.push("הפרת מונוטוניות");
  if (job?.todos.length) notes.push(...job.todos);

  audit.push({
    p,
    current,
    currentSource,
    job,
    engine,
    target,
    targetP,
    dCur,
    dTar,
    flag,
    notes: [...new Set(notes)].join(" · "),
  });
}

/* --------------------------- output 1: audit ------------------------ */

const auditRows: (string | number | null)[][] = [
  [
    "row_key",
    "name",
    "family",
    "width_cm",
    "height_cm",
    "qty",
    "current_price",
    "current_source",
    "engine_name",
    "engine_price",
    "binding_rule",
    "target_price",
    "target_source",
    "delta_current_pct",
    "delta_target_pct",
    "flag",
    "notes",
  ],
];
for (const a of audit) {
  auditRows.push([
    a.p.row_key,
    a.p.name,
    a.p.family,
    a.p.width_cm,
    a.p.height_cm,
    a.p.qty,
    a.current != null ? r2(a.current) : null,
    a.currentSource,
    a.job ? a.job.engine : "",
    a.engine != null ? r2(a.engine) : null,
    a.job && a.engine != null ? BINDING_LABEL[a.job.bindingRule] : "",
    a.targetP != null ? r2(a.targetP) : null,
    a.target?.source ?? "",
    a.dCur != null ? r1(a.dCur) : null,
    a.dTar != null ? r1(a.dTar) : null,
    a.flag,
    a.notes,
  ]);
}

/* --------------------- outputs 2+3: manual worklists ----------------- */

type WorklistItem = {
  /** row_key of the catalog row (omit for pure additions) */
  rowKey?: string;
  action: "עדכון מחיר" | "מחיקה" | "הוספה" | "תיקון כמות";
  newPrice?: number;
  reason: string;
  priority: 1 | 2;
  /** for הוספה entries that have no catalog row */
  add?: { name: string; family: string; size: string; qty: number };
};

/** The approved cleanup items — the SAME set encoded in
 *  supabase/cleanup/2026-08-25-app-db-worklist.sql (keep in sync). */
const WORKLIST: WorklistItem[] = [
  /* §A — comma-bug quantity fixes */
  {
    rowKey: "כרטיסי ביקור 10.000 יחי",
    action: "תיקון כמות",
    reason: 'תיקון כמות 10,000 — באג פסיקים ("10.000")',
    priority: 1,
  },
  {
    rowKey: "כרטיסי ביקור 20.000 יחי",
    action: "תיקון כמות",
    reason: 'תיקון כמות 20,000 — באג פסיקים ("20.000")',
    priority: 1,
  },
  {
    rowKey: "הדפסה על מגנט 10/10 10,000 יח",
    action: "תיקון כמות",
    reason: 'תיקון כמות 10,000 — באג פסיקים ("10,000")',
    priority: 1,
  },
  {
    rowKey: "12/9 10.000 יחידות הדפסה על מגנט",
    action: "תיקון כמות",
    reason: 'תיקון כמות 10,000 — באג פסיקים ("10.000")',
    priority: 1,
  },
  {
    rowKey: "15.000 אלף 10/8 מגנט 5/9magnetbusiness",
    action: "תיקון כמות",
    reason: 'תיקון כמות 15,000 — באג פסיקים ("15.000")',
    priority: 1,
  },
  {
    rowKey: "10.000 גלויות 10/15",
    action: "תיקון כמות",
    reason: 'תיקון כמות 10,000 — באג פסיקים ("10.000")',
    priority: 1,
  },
  /* §B — פליירים */
  {
    rowKey: "פליירים 15/21 דו או חד צדדי 200 יחי",
    action: "עדכון מחיר",
    newPrice: 125,
    reason: "ספק: 351 → ₪125 (עקומת A5 מאושרת)",
    priority: 1,
  },
  {
    rowKey: "פליירים 15/21 דו או חד צדדי 300 יחי",
    action: "עדכון מחיר",
    newPrice: 170,
    reason: "ספק: 417 → ₪170 (עקומת A5 מאושרת)",
    priority: 1,
  },
  {
    rowKey: "פליירים 15/21 דו או חד צדדי 400 יחי",
    action: "מחיקה",
    reason: "המפרט מוחק את מק״ט 400 היחידות",
    priority: 1,
  },
  /* §C — מדבקות: סולם 5×9 */
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 5-9 סמ",
    action: "עדכון מחיר",
    newPrice: 126,
    reason: "סולם 5×9 מאושר (דלי 126)",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 5-9 סמ-q150",
    action: "עדכון מחיר",
    newPrice: 134,
    reason: "סולם 5×9 מאושר",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 5-9 סמ-q200",
    action: "עדכון מחיר",
    newPrice: 143,
    reason: "סולם 5×9 מאושר",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 5-9 סמ-q250",
    action: "עדכון מחיר",
    newPrice: 157,
    reason: "סולם 5×9 מאושר",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 5-9 סמ-q500",
    action: "עדכון מחיר",
    newPrice: 174,
    reason: "סולם 5×9 מאושר",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 5-9 סמ-q1000",
    action: "עדכון מחיר",
    newPrice: 245,
    reason: "סולם 5×9 מאושר",
    priority: 1,
  },
  /* §C — תיקוני נתונים */
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 6-6 סמ-q500",
    action: "עדכון מחיר",
    newPrice: 249,
    reason: "תיקון נתונים מאושר 6×6×500",
    priority: 1,
  },
  {
    rowKey: "הדפסת-מדבקות-בעיצוב-אישי-עם-הלוגו-שלכם-קוטר-9-9-ס''מ-500-יחי-1786216738040",
    action: "עדכון מחיר",
    newPrice: 420,
    reason: "תיקון נתונים מאושר 9×9×1000",
    priority: 1,
  },
  /* §C — מדרגות 1000 */
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 3-3 סמ-q1000",
    action: "עדכון מחיר",
    newPrice: 299,
    reason: "מדרגת 1000 מאושרת",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 4-4 סמ-q1000",
    action: "עדכון מחיר",
    newPrice: 310,
    reason: "מדרגת 1000 מאושרת",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 6-6 סמ-q1000",
    action: "עדכון מחיר",
    newPrice: 370,
    reason: "מדרגת 1000 מאושרת",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 7-7 סמ-q1000",
    action: "עדכון מחיר",
    newPrice: 395,
    reason: "מדרגת 1000 מאושרת",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 8-8 סמ-q1000",
    action: "עדכון מחיר",
    newPrice: 395,
    reason: "מדרגת 1000 מאושרת",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 10-10 סמ-q1000",
    action: "עדכון מחיר",
    newPrice: 480,
    reason: "מדרגת 1000 מאושרת",
    priority: 1,
  },
  /* §C — מלבנים גדולים */
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 24-6 סמ-q500",
    action: "עדכון מחיר",
    newPrice: 375,
    reason: "מלבן גדול 500 מאושר",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 24-6 סמ-q1000",
    action: "עדכון מחיר",
    newPrice: 595,
    reason: "מלבן גדול 1000 מאושר",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 10-15 סמ-q500",
    action: "עדכון מחיר",
    newPrice: 375,
    reason: "מלבן גדול 500 מאושר",
    priority: 1,
  },
  {
    rowKey: "הדפסת מדבקות בעיצוב אישי עם הלוגו שלכם קוטר 10-15 סמ-q1000",
    action: "עדכון מחיר",
    newPrice: 595,
    reason: "מלבן גדול 1000 מאושר",
    priority: 1,
  },
  /* §D — קנבס */
  {
    rowKey: "הדפסה על קנבס 30/30",
    action: "עדכון מחיר",
    newPrice: 95,
    reason: "הוזלה מאושרת (סולם קנבס)",
    priority: 2,
  },
  {
    rowKey: "הדפסה על קנבס 30/45",
    action: "עדכון מחיר",
    newPrice: 110,
    reason: "העלאה מאושרת (סולם קנבס)",
    priority: 2,
  },
  {
    rowKey: "הדפסה על קנבס 50/30",
    action: "עדכון מחיר",
    newPrice: 115,
    reason: "העלאה מאושרת (סולם קנבס)",
    priority: 2,
  },
  {
    rowKey: "הדפסה על קנבס 60/180",
    action: "עדכון מחיר",
    newPrice: 365,
    reason: "הוזלה מאושרת (סולם קנבס)",
    priority: 2,
  },
  {
    rowKey: "הדפסה על קנבס 90/90",
    action: "עדכון מחיר",
    newPrice: 230,
    reason: "העלאה מאושרת (סולם קנבס)",
    priority: 2,
  },
  {
    rowKey: "הדפסה על קנבס 80/120",
    action: "עדכון מחיר",
    newPrice: 255,
    reason: "העלאה מאושרת (סולם קנבס)",
    priority: 2,
  },
  {
    rowKey: "הדפסה על קנבס 90/120",
    action: "עדכון מחיר",
    newPrice: 280,
    reason: "העלאה מאושרת (סולם קנבס)",
    priority: 2,
  },
  {
    rowKey: "הדפסה על קנבס 70/100",
    action: "עדכון מחיר",
    newPrice: 245,
    reason: "איחוד 100/70+70/100 = ₪245",
    priority: 2,
  },
  /* §E — שמשונית */
  {
    rowKey: "הדפסה על שמשונית 120/100",
    action: "מחיקה",
    reason: "כפילות 120/100 ב-₪80 — נשארת רק נקודת ה-₪105",
    priority: 2,
  },
  /* §F — פוליגל */
  {
    rowKey: "הדפסה על פוליגל 120/80 סמ",
    action: "עדכון מחיר",
    newPrice: 85,
    reason: "סולם מאושר (ביטול ₪70)",
    priority: 2,
  },
  /* §G — חשבוניות/פנקסים */
  {
    rowKey: "הזמנת עבודה A5 עשר פנקסים מקור + 2 העתקים",
    action: "עדכון מחיר",
    newPrice: 320,
    reason: "מחיר מבנה אחיד A5×10 = ₪320",
    priority: 2,
  },
  {
    rowKey: "תעודת משלוח A5 עשרה פנקסים",
    action: "עדכון מחיר",
    newPrice: 320,
    reason: "מחיר מבנה אחיד A5×10 = ₪320",
    priority: 2,
  },
  {
    rowKey: "קבלת עוסק פטור A4 עשרה פנקסים",
    action: "עדכון מחיר",
    newPrice: 418,
    reason: "מחיר מבנה אחיד A4×10 = ₪418",
    priority: 2,
  },
  {
    action: "הוספה",
    newPrice: 320,
    reason: "מוצר חדש מאושר — הצעות מחיר A5 × 10 פנקסים",
    priority: 2,
    add: {
      name: "הצעות מחיר A5 עשר פנקסים מקור + 2 העתקים",
      family: "חשבוניות",
      size: "14.8x21",
      qty: 10,
    },
  },
  /* §H — זכוכית */
  {
    rowKey: "הדפסת תמונות על זכוכית בעיצוב אישי 120/80",
    action: "עדכון מחיר",
    newPrice: 1035,
    reason: "שיא השוק — ₪1,035 מאושר",
    priority: 2,
  },
  {
    rowKey: "הדפסת תמונות על זכוכית בעיצוב אישי 100/70",
    action: "עדכון מחיר",
    newPrice: 675,
    reason: "יעד מאושר 650–700",
    priority: 2,
  },
];

type WorkRow = {
  action: string;
  identifier: string;
  name: string;
  family: string;
  size: string;
  qty: number | null;
  current: number | null;
  newPrice: number | null;
  reason: string;
  priority: number;
};

const byRowKey = new Map(products.map((p) => [p.row_key, p]));
const sizeOf = (p: Product | null) =>
  p && p.width_cm && p.height_cm ? `${p.width_cm}x${p.height_cm}` : "";

const senzeyRows: WorkRow[] = [];
const siteRows: WorkRow[] = [];
const covered = new Set<string>();

function pushWork(
  p: Product | null,
  item: { action: string; newPrice?: number | null; reason: string; priority: number },
  add?: WorklistItem["add"],
) {
  const base = {
    action: item.action,
    name: p?.name ?? add?.name ?? "",
    family: p?.family ?? add?.family ?? "",
    size: p ? sizeOf(p) : (add?.size ?? ""),
    qty: p ? p.qty : (add?.qty ?? null),
    newPrice: item.newPrice ?? null,
    reason: item.reason,
    priority: item.priority,
  };
  if (!p) {
    /* pure addition — needs manual creation in BOTH systems */
    senzeyRows.push({ ...base, identifier: "", current: null });
    siteRows.push({ ...base, identifier: "", current: null });
    return;
  }
  const inSenzey = (p.senzey_ids ?? "").trim() !== "" || p.senzey_exists === true;
  const onSite = (p.site_url ?? "").trim() !== "";
  if (inSenzey)
    senzeyRows.push({ ...base, identifier: (p.senzey_ids ?? "").trim(), current: p.senzey_price });
  if (onSite)
    siteRows.push({ ...base, identifier: (p.site_url ?? "").trim(), current: p.site_price });
}

/* (a) — the approved cleanup items */
for (const item of WORKLIST) {
  if (!item.rowKey) {
    pushWork(null, item, item.add);
    continue;
  }
  const p = byRowKey.get(item.rowKey) ?? null;
  if (!p) {
    console.error(`worklist: row_key not found in catalog — ${item.rowKey}`);
    continue;
  }
  covered.add(p.row_key);
  pushWork(p, item);
}

/* (b) — every REVIEW-flagged row with a target (and NO_ENGINE rows whose
   current price misses a directional target by >3%) */
for (const a of audit) {
  if (covered.has(a.p.row_key)) continue;
  if (!a.target || a.targetP == null) continue;
  const review =
    a.flag === "REVIEW" || (a.flag === "NO_ENGINE" && a.dTar != null && Math.abs(a.dTar) > 3);
  if (!review) continue;
  covered.add(a.p.row_key);
  const newPrice = a.target.price ?? (a.engine != null ? a.engine : r2(a.targetP));
  pushWork(a.p, {
    action: "עדכון מחיר",
    newPrice: r2(newPrice),
    reason: a.target.source || "עקומת מנוע",
    priority: 3,
  });
}

const workSort = (x: WorkRow, y: WorkRow) =>
  x.priority - y.priority ||
  x.family.localeCompare(y.family, "he") ||
  x.name.localeCompare(y.name, "he");
senzeyRows.sort(workSort);
siteRows.sort(workSort);

const WORK_HEADER = [
  "action",
  "identifier",
  "name",
  "family",
  "size",
  "qty",
  "current_price_in_system",
  "new_price",
  "reason",
  "priority",
];
const workCsv = (rows: WorkRow[]) =>
  writeCsv([
    WORK_HEADER,
    ...rows.map((r) => [
      r.action,
      r.identifier,
      r.name,
      r.family,
      r.size,
      r.qty,
      r.current != null ? r2(r.current) : null,
      r.newPrice != null ? r2(r.newPrice) : null,
      r.reason,
      r.priority,
    ]),
  ]);

/* ------------------------------ write ------------------------------- */

mkdirSync(OUT_DIR, { recursive: true });
const outAudit = resolve(OUT_DIR, `dry-run-${STAMP}.csv`);
const outSenzey = resolve(OUT_DIR, `worklist-senzey-${STAMP}.csv`);
const outSite = resolve(OUT_DIR, `worklist-site-${STAMP}.csv`);
writeFileSync(outAudit, writeCsv(auditRows), "utf8");
writeFileSync(outSenzey, workCsv(senzeyRows), "utf8");
writeFileSync(outSite, workCsv(siteRows), "utf8");

/* ----------------------------- summary ------------------------------ */

type FamStat = { rows: number; review: number; noEngine: number };
const stats = new Map<string, FamStat>();
for (const a of audit) {
  const fam = a.p.family ?? "(ללא משפחה)";
  const s = stats.get(fam) ?? { rows: 0, review: 0, noEngine: 0 };
  s.rows++;
  if (a.flag === "REVIEW") s.review++;
  if (a.flag === "NO_ENGINE") s.noEngine++;
  stats.set(fam, s);
}

console.log(`dry-run report — ${products.length} products (${jsonPath ? "json" : "csv"} input)`);
console.log("");
console.log("family                        rows  REVIEW  NO_ENGINE");
for (const [fam, s] of [...stats.entries()].sort((x, y) => y[1].rows - x[1].rows)) {
  console.log(
    `${fam.padEnd(28)} ${String(s.rows).padStart(5)} ${String(s.review).padStart(7)} ${String(s.noEngine).padStart(10)}`,
  );
}

const deviations = audit
  .filter((a) => a.dCur != null)
  .sort((x, y) => Math.abs(y.dCur!) - Math.abs(x.dCur!))
  .slice(0, 10);
console.log("");
console.log("top 10 deviations (engine vs current):");
for (const a of deviations) {
  console.log(
    `  ${r1(a.dCur!)}%  ${a.p.family} · ${a.p.name} · current ${a.current} → engine ${r2(a.engine!)}`,
  );
}

console.log("");
console.log(`written: ${outAudit}`);
console.log(`written: ${outSenzey}  (${senzeyRows.length} rows)`);
console.log(`written: ${outSite}  (${siteRows.length} rows)`);
