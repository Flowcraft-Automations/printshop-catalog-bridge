import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { explainFamily } from "@/lib/pricing/explain";
import { MATERIAL_LABEL } from "@/lib/pricing/modifiers";
import { resolvePlan } from "@/lib/pricing/plan";
import { Anchor as AnchorIcon } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { EngineBadge } from "@/components/EngineBadge";
import { supabase } from "@/integrations/supabase/client";
import { familiesQuery, productsQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { PAPER_SIZES, paperLabel } from "@/lib/paper";

import {
  BINDING_LABEL,
  DEFAULT_MARGIN,
  DEFAULT_ROUNDING,
  ENGINE_LABEL,
  SHEET_W_CM,
  SHEET_H_CM,
  SHEET_GAP_CM,
  familyAnchors,
  isCatalogBinds,
  mergeCloseAnchors,
  familyValidated,
  isClosedOut,
  isEngineKind,
  familyColor,
  prepareFamily,
  priceJob,
  readFamilyPricing,
  sheetUnitsFor,
  printableSheet,
  sizeKey,
  shekel,
  slugify,
  validateFamilyPricing,
  writeFamilyPricing,
  type CatalogBinds,
  type EngineKind,
  type FamilyPricing,
  type OverLimit,
} from "@/lib/mdvd";

/** הסבר של שורה אחת לכל מדיניות קשירה לקטלוג */
const CATALOG_BINDS_HELP: Record<CatalogBinds, string> = {
  all: "כל שורה מאומתת בקטלוג באותה מידה וכמות קובעת את המחיר כמות שהוא, ומידה מאומתת קטנה יותר מרצפת את המחיר.",
  anchors: "רק שורות שסומנו ⚓ (עוגן) קובעות מחיר ומרצפות; שאר השורות המאומתות משמשות להשוואה בלבד.",
  packs: "חבילות (מכמות החבילה הקטנה ומעלה) ומדבקות שאינן נכנסות לדף הקטן קובעות מחיר; מדבקה בודדת שנכנסת לדף הקטן מתומחרת לפי הדף, לא לפי הקטלוג.",
  none: "הקטלוג אינו קובע מחיר — הנוסחה בלבד. השורות מוצגות בלוח ההסכמה לצורך השוואה.",
};

export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "מחשבון מידות — קונסולת MDVD" },
      { name: "description", content: "תמחור לפי עוגנים: מידה, כמות ומחיר מחושב למשפחה." },
      { property: "og:title", content: "מחשבון מידות — קונסולת MDVD" },
      { property: "og:description", content: "תמחור לפי עוגנים למשפחת מוצרים." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Calculator,
});

const inputCls =
  "w-full border-0 border-b-2 border-[var(--ink)] bg-transparent px-1 py-1 text-lg font-bold outline-none focus:border-[var(--accent-raw)]";
const labelCls = "mb-1 block text-[11px] text-muted-foreground";

function Field({
  label,
  value,
  onChange,
  width = "w-28",
  as = "input",
  children,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  width?: string;
  as?: "input" | "select";
  children?: React.ReactNode;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className={width}>
      <label className={labelCls}>{label}</label>
      {as === "select" ? (
        <select
          className={`${inputCls} text-base ${disabled ? "opacity-50" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        >
          {children}
        </select>
      ) : (
        <input
          className={`${inputCls} ${disabled ? "opacity-50" : ""}`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
        />
      )}
    </div>
  );
}

/** שבבי TODO מהתצורה — אותה פלטת ענבר של תג "ללא מנוע". */
function TodoChips({ todos }: { todos: string[] }) {
  if (!todos.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {todos.map((t, i) => (
        <span
          key={i}
          className="inline-block border border-[oklch(0.6_0.16_70)] bg-[oklch(0.96_0.05_85_/_0.55)] px-1.5 py-0.5 text-[10px] font-black text-[oklch(0.45_0.1_70)]"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

type Draft = {
  engine: string;
  tw: string;
  th: string;
  cost: string;
  out: string;
  margin: string;
  rounding: string;
  packages: string;
  minUnitArea: string;
  shortRunPct: string;
  qtyExponent: string;
  sheetW: string;
  sheetH: string;
  sheetMargin: string;
  sheetGap: string;
  minOrderQty: string;
  minOrderValue: string;
  maxPrintW: string;
  maxPrintL: string;
  overLimit: OverLimit;
  mountCostM2: string;
  mountCostUnit: string;
  capW: string;
  capL: string;
  wholeBoard: boolean;
  boardW: string;
  boardH: string;
  /* --- v3.3 --- */
  sheetPrice: string;
  outsourcedRateM2: string;
  minJobPrice: string;
  catalogBinds: CatalogBinds;
};

function Calculator() {
  const qc = useQueryClient();
  const { isAdmin, allowedFamilies } = useAuth();
  const { data: allFamilies = [] } = useQuery(familiesQuery());
  const { data: products = [] } = useQuery(productsQuery());

  const families = useMemo(
    () =>
      allowedFamilies === null
        ? allFamilies
        : allFamilies.filter((f) => allowedFamilies.includes(f.family)),
    [allFamilies, allowedFamilies],
  );

  const [family, setFamily] = useState("");
  const [famSearch, setFamSearch] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!family && families.length) setFamily(families[0]!.family);
  }, [families, family]);

  const fam = families.find((f) => f.family === family);
  const saved = useMemo(() => readFamilyPricing(fam), [fam]);

  const [draft, setDraft] = useState<Draft>({
    engine: "",
    tw: "",
    th: "",
    cost: "",
    out: "",
    margin: String(DEFAULT_MARGIN),
    rounding: String(DEFAULT_ROUNDING),
    packages: "",
    minUnitArea: "1",
    shortRunPct: "70",
    qtyExponent: "",
    sheetW: String(SHEET_W_CM),
    sheetH: String(SHEET_H_CM),
    sheetMargin: "0",
    sheetGap: String(SHEET_GAP_CM),
    minOrderQty: "",
    minOrderValue: "",
    maxPrintW: "",
    maxPrintL: "",
    overLimit: "weld",

    mountCostM2: "",
    mountCostUnit: "",
    capW: "",
    capL: "",
    wholeBoard: false,
    boardW: "",
    boardH: "",
    sheetPrice: "",
    outsourcedRateM2: "",
    minJobPrice: "",
    catalogBinds: "all",
  });

  const [sheetUnits, setSheetUnits] = useState<Record<string, number>>({});
  const [tiersOn, setTiersOn] = useState(false);
  const [tiers, setTiers] = useState<{ minQty: string; unitPrice: string; size: string }[]>([]);

  useEffect(() => {
    setDraft({
      engine: saved.engine,
      tw: saved.thresholdW ? String(saved.thresholdW) : "",
      th: saved.thresholdH ? String(saved.thresholdH) : "",
      cost: saved.cost ? String(saved.cost) : "",
      out: saved.outsourceCost ? String(saved.outsourceCost) : "",
      margin: String(saved.margin),
      rounding: String(saved.rounding),
      packages: saved.packages.join(", "),
      minUnitArea: String(saved.minUnitArea),
      shortRunPct: String(Math.round(saved.shortRunPct * 100)),
      qtyExponent: saved.qtyExponentPinned ? String(saved.qtyExponent) : "",
      sheetW: String(saved.sheetW),
      sheetH: String(saved.sheetH),
      sheetMargin: String(saved.sheetMargin),
      sheetGap: String(saved.sheetGap),
      minOrderQty: saved.minOrderQty ? String(saved.minOrderQty) : "",
      minOrderValue: saved.minOrderValue ? String(saved.minOrderValue) : "",
      maxPrintW: saved.maxPrintW ? String(saved.maxPrintW) : "",
      maxPrintL: saved.maxPrintL ? String(saved.maxPrintL) : "",
      overLimit: saved.overLimit,

      mountCostM2: saved.mountCostM2 ? String(saved.mountCostM2) : "",
      mountCostUnit: saved.mountCostUnit ? String(saved.mountCostUnit) : "",
      capW: saved.capW ? String(saved.capW) : "",
      capL: saved.capL ? String(saved.capL) : "",
      wholeBoard: saved.wholeBoard,
      boardW: saved.boardW ? String(saved.boardW) : "",
      boardH: saved.boardH ? String(saved.boardH) : "",
      sheetPrice: saved.sheetPrice ? String(saved.sheetPrice) : "",
      outsourcedRateM2: saved.outsourcedRateM2 ? String(saved.outsourcedRateM2) : "",
      minJobPrice: saved.minJobPrice ? String(saved.minJobPrice) : "",
      catalogBinds: saved.catalogBinds,
    });

    setSheetUnits(saved.sheetUnits);
    setTiersOn(saved.qtyTiersEnabled);
    setTiers(
      saved.qtyTiers.map((t) => ({
        minQty: String(t.minQty),
        unitPrice: String(t.unitPrice),
        size: t.size ? t.size.replace("x", "×") : "",
      })),
    );
  }, [saved]);

  const cfg: FamilyPricing = useMemo(() => {
    const n = (s: string) => (Number(s) > 0 ? Number(s) : 0);
    const engine: EngineKind = isEngineKind(draft.engine) ? draft.engine : saved.engine;
    return {
      /* התצורה השמורה נושאת את כל שדות v3.1 (דליים, עקומות, סולמות, דו-צדדי,
         טבלת תפוקה, TODO וכו׳) — הטופס עורך רק את הסקלרים שמעליה */
      ...saved,
      method: engine === "anchor_curve" || engine === "two_machine_sheet" ? "sheet" : "area",
      /* סף מיקור חוץ — נפרד לחלוטין מגבול ההדפסה של המכונה */
      thresholdW: n(draft.tw),
      thresholdH: n(draft.th),
      cost: n(draft.cost),
      outsourceCost: n(draft.out),
      margin: n(draft.margin) || DEFAULT_MARGIN,
      rounding: n(draft.rounding) || DEFAULT_ROUNDING,
      packages: draft.packages
        .split(/[,\s]+/)
        .map(Number)
        .filter((x) => Number.isFinite(x) && x > 0)
        .sort((a, b) => a - b),
      minUnitArea: n(draft.minUnitArea) || 1,
      shortRunPct: Math.min(1, Math.max(0.05, (n(draft.shortRunPct) || 70) / 100)),
      qtyExponent: n(draft.qtyExponent) || 1,
      qtyExponentPinned: n(draft.qtyExponent) > 0,
      qtyTiersEnabled: tiersOn,
      qtyTiers: tiers
        .map((t) => {
          const parts = t.size
            .replace(/[×*]/g, "x")
            .split("x")
            .map((x) => Number(x.trim()))
            .filter((x) => Number.isFinite(x) && x > 0);
          const size =
            parts.length === 2
              ? `${Math.max(parts[0]!, parts[1]!)}x${Math.min(parts[0]!, parts[1]!)}`
              : "";
          return {
            minQty: Math.max(1, Math.floor(n(t.minQty))),
            unitPrice: n(t.unitPrice),
            size,
          };
        })
        .filter((t) => t.minQty > 0 && t.unitPrice > 0)
        .sort((a, b) => a.minQty - b.minQty),
      sheetUnits,
      sheetW: n(draft.sheetW) || SHEET_W_CM,
      sheetH: n(draft.sheetH) || SHEET_H_CM,
      sheetMargin: Math.max(0, Number(draft.sheetMargin) || 0),
      sheetGap: draft.sheetGap === "" ? SHEET_GAP_CM : Math.max(0, Number(draft.sheetGap) || 0),
      minOrderQty: Math.max(0, Math.floor(Number(draft.minOrderQty) || 0)),
      maxPrintW: n(draft.maxPrintW),
      maxPrintL: n(draft.maxPrintL),
      overLimit: draft.overLimit,

      mountCostM2: n(draft.mountCostM2),
      mountCostUnit: n(draft.mountCostUnit),
      capW: n(draft.capW),
      capL: n(draft.capL),
      wholeBoard: draft.wholeBoard,
      boardW: n(draft.boardW),
      boardH: n(draft.boardH),

      /* --- v3.3 --- */
      sheetPrice: n(draft.sheetPrice),
      outsourcedRateM2: n(draft.outsourcedRateM2),
      minJobPrice: n(draft.minJobPrice),
      catalogBinds: draft.catalogBinds,

      /* --- v3.1 --- */
      engine,
      /* בחירת מנוע בטופס = תצורה ממוגרת; שמירה תכתוב את שדה המנוע */
      legacy: isEngineKind(draft.engine) ? false : saved.legacy,
      minOrderValue: n(draft.minOrderValue),
    };
  }, [draft, sheetUnits, tiersOn, tiers, saved]);

  /* מנועים מבוססי-גיליון — קובעים אילו שדות/עמודות גיליון מוצגים */
  const sheetish =
    cfg.engine === "anchor_curve" ||
    cfg.engine === "sheet_yield" ||
    cfg.engine === "two_machine_sheet";

  const anchors = useMemo(() => familyAnchors(products, family), [products, family]);

  /** every approved (non-deleted / relevant) item of the family — the anchor table body */
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => (p.family ?? "").trim() === family.trim())
      .filter((p) => !isClosedOut(p))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .map((p) => {
        const w = Number(p.width_cm) || 0;
        const h = Number(p.height_cm) || 0;
        const price = p.final_price ?? p.senzey_price ?? null;
        return {
          id: p.id,
          name: p.name,
          w,
          h,
          area: (w * h) / 10000,
          qty: Math.max(1, Number(p.qty) || 1),
          price,
          isAnchor: !!p.is_anchor,
          verified: !!p.verified,
        };
      })
      .filter((r) => r.w > 0 && r.h > 0)
      .sort((a, b) => a.area - b.area || a.qty - b.qty);
  }, [products, family, search]);

  /* ---------------- mutations ---------------- */

  const saveCfg = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("families")
        .update({
          outsource_width_cm: cfg.thresholdW || null,
          outsource_height_cm: cfg.thresholdH || null,
          cost_per_m2: cfg.cost,
          outsource_cost_per_m2: cfg.outsourceCost || null,
          /* prev משמר מפתחות ישנים בתצורה (למשל customer) במקום לדרוס אותם */
          pricing_config: writeFamilyPricing(cfg, fam?.pricing_config),
        })
        .eq("family", family);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["families"] });
      toast.success("נשמר");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* שמירה חסומה כשהתצורה שגויה (למשל לפי מ״ר עם עוגני כמות מעל 500) */
  const save = () => {
    const errors = validateFamilyPricing(cfg, anchors);
    if (errors.length) {
      toast.error(errors[0]!);
      return;
    }
    saveCfg.mutate();
  };

  const upsertAnchor = useMutation({
    mutationFn: async (a: {
      id?: string;
      w: number;
      h: number;
      qty: number;
      price: number;
      anchor?: boolean;
    }) => {
      if (a.id) {
        const { error } = await supabase
          .from("products")
          .update({
            width_cm: a.w,
            height_cm: a.h,
            qty: a.qty,
            final_price: a.price,
            ...(a.anchor === undefined ? {} : { is_anchor: a.anchor }),
          })
          .eq("id", a.id);
        if (error) throw error;
        return;
      }
      const existing = products.find(
        (p) =>
          (p.family ?? "").trim() === family.trim() &&
          sizeKey(Number(p.width_cm) || 0, Number(p.height_cm) || 0) === sizeKey(a.w, a.h) &&
          Math.max(1, Number(p.qty) || 1) === a.qty,
      );
      if (existing) {
        const { error } = await supabase
          .from("products")
          .update({ final_price: a.price, is_anchor: true })
          .eq("id", existing.id);
        if (error) throw error;
        return;
      }
      const name = `${family} ${a.w}/${a.h}${a.qty > 1 ? ` — ${a.qty} יח׳` : ""}`;
      const { error } = await supabase.from("products").insert({
        row_key: slugify(`${family}-${a.w}x${a.h}-${a.qty}-${Date.now()}`),
        name,
        family,
        width_cm: a.w,
        height_cm: a.h,
        qty: a.qty,
        final_price: a.price,
        is_anchor: true,
        source: "calculator",
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleAnchor = useMutation({
    mutationFn: async ({ id, on }: { id: string; on: boolean }) => {
      const { error } = await supabase.from("products").update({ is_anchor: on }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---------------- calculator ---------------- */

  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [qty, setQty] = useState("1");
  /* חד-צדדי / דו-צדדי — מתאפס בהחלפת משפחה */
  const [sides, setSides] = useState<1 | 2>(1);
  /* חומר (מדבקות) — מפתח במקדם material_surcharge של המשפחה */
  const [material, setMaterial] = useState("vinyl");
  const materialPct = useMemo(() => {
    const m = resolvePlan(cfg, cfg.plan).modifiers.find((x) => x.kind === "material_surcharge");
    return m && m.kind === "material_surcharge" ? m.pct : null;
  }, [cfg]);
  /* כל משפחה נפתחת בכמות 1 — לקוח מזדמן קונה 1–4 (9/9); חבילות נבחרות בלחיצה */
  useEffect(() => {
    setQty("1");
    setSides(1);
    setMaterial("vinyl");
  }, [family]);

  const nw = Number(w) || 0;
  const nh = Number(h) || 0;
  const nq = Math.max(1, Number(qty) || 1);
  const validated = useMemo(() => familyValidated(products, family), [products, family]);
  /* מנורמל פעם אחת — גם מזין את שורת "על מה התבסס המחיר" */
  const prepared = useMemo(() => prepareFamily(cfg, anchors, validated), [cfg, anchors, validated]);
  /* the family's own pricing narrative, generated from its plan */
  const explanation = useMemo(
    () => (family ? explainFamily(cfg, resolvePlan(cfg, cfg.plan), prepared) : null),
    [family, cfg, prepared],
  );
  const job = useMemo(
    () =>
      priceJob(cfg, anchors, nw, nh, nq, validated, {
        dualSided: sides === 2,
        prepared,
        ...(materialPct ? { material } : {}),
      }),
    [cfg, anchors, nw, nh, nq, validated, sides, prepared, materialPct, material],
  );

  const inconsistent = job?.inconsistent ?? [];

  /* anchors describing the same job (same qty, area within ±2%) at different prices */
  const conflicts = useMemo(() => mergeCloseAnchors(anchors).conflicts, [anchors]);
  const conflictIds = useMemo(
    () => new Set(conflicts.flatMap((c) => c.members.map((m) => m.id))),
    [conflicts],
  );

  const packagePrices = useMemo(
    () =>
      cfg.packages.map((p) => ({
        qty: p,
        job: priceJob(cfg, anchors, nw, nh, p, validated, {
          dualSided: sides === 2,
          prepared,
          ...(materialPct ? { material } : {}),
        }),
      })),
    [cfg, anchors, nw, nh, validated, sides, prepared, materialPct, material],
  );

  /* the typed job's area, always shown */
  const jobArea = (nw * nh) / 10000;

  /* verified catalog items of this family, cheapest reference points for a human */
  const verifiedList = useMemo(
    () => [...validated].sort((a, b) => a.area - b.area || a.qty - b.qty),
    [validated],
  );

  /* the verified items closest to what was typed */
  const nearest = useMemo(() => {
    if (!jobArea) return [];
    return [...validated]
      .map((v) => ({
        ...v,
        gap:
          Math.abs(Math.log((v.area || 0.0001) / jobArea)) + Math.abs(Math.log(v.qty / nq)) * 0.5,
      }))
      .sort((a, b) => a.gap - b.gap)
      .slice(0, 5);
  }, [validated, jobArea, nq]);

  /* הסכמה עם הקטלוג: כל שורה מאומתת מול המחיר שהנוסחה לבדה נותנת לה
     (catalog_binds = none) — הקטלוג הופך ממדריס שקט לבדיקה שאפשר לקרוא */
  const agreement = useMemo(() => {
    if (!family || !validated.length) return null;
    const preparedNone = prepareFamily(cfg, anchors, validated, { catalogBinds: "none" });
    const rows = validated.map((v) => {
      const j = priceJob(cfg, anchors, v.w, v.h, v.qty, validated, {
        catalogBinds: "none",
        prepared: preparedNone,
      });
      const engine = j && !j.noQuote && !j.overMachine && !j.belowMinOrder ? j.total : null;
      const delta = engine !== null && v.price > 0 ? (engine - v.price) / v.price : null;
      const floor = j ? j.costFloorValue : 0;
      return {
        ...v,
        engine,
        delta,
        rule: j?.bindingRule ?? null,
        belowCost: floor > 0 && v.price < floor - 0.01,
      };
    });
    const scored = rows.filter((r): r is typeof r & { delta: number } => r.delta !== null);
    const mean = scored.length
      ? scored.reduce((t, r) => t + Math.abs(r.delta), 0) / scored.length
      : 0;
    const losing = rows.filter((r) => r.belowCost);
    /* rows sold under cost come first — those are the ones to fix on the site */
    const worst = [...losing, ...scored.filter((r) => !r.belowCost).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))].slice(0, 5);
    return { total: rows.length, scored: scored.length, mean, worst, losing: losing.length };
  }, [family, cfg, anchors, validated]);

  const famList = useMemo(() => {
    const q = famSearch.trim().toLowerCase();
    return q ? families.filter((f) => f.family.toLowerCase().includes(q)) : families;
  }, [families, famSearch]);

  /* ---------------- new anchor row ---------------- */
  const [newRow, setNewRow] = useState({ w: "", h: "", qty: "", price: "" });

  const addRow = () => {
    const aw = Number(newRow.w) || 0;
    const ah = Number(newRow.h) || 0;
    const aq = Math.max(1, Number(newRow.qty) || 1);
    const ap = Number(newRow.price) || 0;
    if (!aw || !ah || !ap) {
      toast.error("מידה ומחיר נדרשים");
      return;
    }
    upsertAnchor.mutate({ w: aw, h: ah, qty: aq, price: ap });
    setNewRow({ w: "", h: "", qty: "", price: "" });
  };

  const setUnitsForSize = (a: { w: number; h: number }, units: number) => {
    const key = sizeKey(a.w, a.h);

    setSheetUnits((prev) => {
      const next = { ...prev };
      if (units > 0) next[key] = units;
      else delete next[key];
      return next;
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 p-4 pb-24">
      <PageTitle title="מחשבון מידות" sub="תמחור לפי עוגנים" />

      {/* family picker */}
      <div className="space-y-3">
        <input
          className="w-full max-w-xs border-0 border-b-2 border-[var(--ink)] bg-transparent px-1 py-1 text-sm font-bold outline-none focus:border-[var(--accent-raw)]"
          value={famSearch}
          onChange={(e) => setFamSearch(e.target.value)}
          placeholder="חיפוש קטגוריה..."
        />
        <div className="flex flex-wrap gap-2">
          {famList.map((f) => (
            <button
              key={f.family}
              onClick={() => setFamily(f.family)}
              className={`border-2 px-3 py-1 text-sm font-bold text-white transition ${
                family === f.family
                  ? "shadow-[3px_3px_0_var(--ink)]"
                  : "opacity-60 hover:opacity-100"
              }`}
              style={{
                background: familyColor(f.family),
                borderColor: family === f.family ? "var(--ink)" : familyColor(f.family),
              }}
            >
              {f.family}
            </button>
          ))}
          {!famList.length ? (
            <span className="text-sm text-muted-foreground">לא נמצאה קטגוריה</span>
          ) : null}
        </div>
      </div>

      {/* calculator */}
      <section className="border-2 border-[var(--ink)] bg-card p-5 shadow-[4px_4px_0_var(--ink)]">
        {family ? (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-base font-black text-[var(--ink)]">{family}</span>
            <EngineBadge engine={cfg.engine} legacy={saved.legacy} />
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-6">
          <Field label='רוחב (ס"מ)' value={w} onChange={setW} />
          <Field label='גובה (ס"מ)' value={h} onChange={setH} />
          <div className="w-56">
            <Field label="כמות" value={qty} onChange={setQty} />
            {cfg.packages.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {packagePrices.map((p) => (
                  <button
                    key={p.qty}
                    type="button"
                    onClick={() => setQty(String(p.qty))}
                    className={`border-2 px-2 py-0.5 text-[11px] font-bold ${
                      Number(qty) === p.qty
                        ? "border-[var(--ink)] bg-[var(--ink)] text-background"
                        : "border-[var(--line,#c9d4de)] text-muted-foreground"
                    }`}
                    title={p.job ? shekel(p.job.total) : ""}
                  >
                    {p.qty.toLocaleString()}
                  </button>
                ))}
              </div>
            ) : null}
            {/* חד-צדדי / דו-צדדי — רק כשלמשפחה יש מדרגות תוספת דו-צדדי */}
            {cfg.engine === "anchor_curve" && cfg.dualSurcharge.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {([1, 2] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSides(s)}
                    className={`border-2 px-2 py-0.5 text-[11px] font-bold ${
                      sides === s
                        ? "border-[var(--ink)] bg-[var(--ink)] text-background"
                        : "border-[var(--line,#c9d4de)] text-muted-foreground"
                    }`}
                  >
                    {s === 1 ? "חד-צדדי" : "דו-צדדי"}
                  </button>
                ))}
              </div>
            ) : null}
            {/* חומר — רק כשלמשפחה יש מקדם material_surcharge (מדבקות) */}
            {materialPct ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.keys(materialPct).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMaterial(k)}
                    title={
                      (materialPct[k] ?? 0) > 0
                        ? `+${Math.round((materialPct[k] ?? 0) * 100)}% (טרם אושר)`
                        : "ללא תוספת"
                    }
                    className={`border-2 px-2 py-0.5 text-[11px] font-bold ${
                      material === k
                        ? "border-[var(--ink)] bg-[var(--ink)] text-background"
                        : "border-[var(--line,#c9d4de)] text-muted-foreground"
                    }`}
                  >
                    {MATERIAL_LABEL[k] ?? k}
                    {(materialPct[k] ?? 0) > 0 ? ` +${Math.round((materialPct[k] ?? 0) * 100)}%` : ""}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* area — always visible */}
          <div className="w-40">
            <div className={labelCls}>שטח (מ״ר)</div>
            <div className="border-b-2 border-dashed border-[var(--line,#c9d4de)] px-1 py-1 text-lg font-black text-[var(--ink)]">
              {jobArea ? (nq > 1 ? (jobArea * nq).toFixed(3) : jobArea.toFixed(3)) : "—"}
            </div>
            {jobArea && nq > 1 ? (
              <div className="px-1 pt-1 text-[11px] font-bold text-muted-foreground">
                {nq.toLocaleString()} יח׳ × {jobArea.toFixed(3)} מ״ר
              </div>
            ) : null}
          </div>

          <div className="mr-auto text-left">
            <div className={labelCls}>מחיר מוצע</div>
            {!nw || !nh ? (
              <div className="text-lg font-bold text-muted-foreground">הזינו מידות</div>
            ) : job?.overMachine ? (
              <div className="text-lg font-bold text-destructive">לא ניתן לייצור</div>
            ) : job?.belowMinOrder ? (
              <div className="text-lg font-bold text-destructive">
                מינימום הזמנה: {job.minOrderQty.toLocaleString()} יחידות
              </div>
            ) : job?.noQuote ? (
              <>
                <div className="text-lg font-bold text-[var(--ink)]">הצעת מחיר לפי בקשה</div>
                <div className="text-xs text-muted-foreground">
                  {job.configError ?? job.detail ?? "אין תמחור אוטומטי למידה זו"}
                </div>
              </>
            ) : job ? (
              <>
                <div className="text-4xl font-black text-[var(--accent-raw)]">
                  {shekel(job.total)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {shekel(job.unit)} ליחידה · {job.label}
                </div>
              </>
            ) : null}
          </div>
        </div>

        {/* standard size hot keys */}
        <div className="mt-4 flex flex-wrap items-center gap-1">
          <span className="ml-2 text-[11px] font-bold text-muted-foreground">מידות תקן</span>
          {PAPER_SIZES.map((p) => {
            const active = paperLabel(nw, nh) === p.label;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => {
                  setW(String(p.w));
                  setH(String(p.h));
                }}
                title={`${p.w}×${p.h} ס״מ`}
                className={`border-2 px-2 py-0.5 text-[11px] font-black transition ${
                  active
                    ? "border-[var(--ink)] bg-[var(--ink)] text-background"
                    : "border-[var(--line,#c9d4de)] text-muted-foreground hover:border-[var(--ink)] hover:text-[var(--ink)]"
                }`}
              >
                {p.label}
              </button>
            );
          })}
          {paperLabel(nw, nh) ? (
            <span className="mr-2 border-2 border-[var(--accent-raw)] px-2 py-0.5 text-[11px] font-black text-[var(--accent-raw)]">
              המידה שהוזנה = {paperLabel(nw, nh)}
            </span>
          ) : null}
        </div>

        {(job?.belowMinOrder || job?.overMachine || job?.noQuote) && nw && nh ? (
          <div className="mt-3 border-2 border-destructive px-2 py-1 text-xs font-bold text-destructive">
            {job.noQuote ? (job.configError ?? job.detail) : job.detail}
          </div>
        ) : job && nw && nh ? (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {job.total > 0 ? (
              <div className="font-bold text-[var(--ink)]">
                כלל מחייב: {BINDING_LABEL[job.bindingRule]}
              </div>
            ) : null}
            {job.above ? (
              <div className="font-bold text-[var(--ink)]">
                ייצור חוץ —{" "}
                {shekel(cfg.outsourcedRateM2 > 0 ? cfg.outsourcedRateM2 : cfg.outsourceCost)}
                /מ״ר
                {cfg.outsourcedRateM2 > 0 && cfg.minJobPrice > 0
                  ? ` · מינימום ${shekel(cfg.minJobPrice)}`
                  : ""}
              </div>
            ) : null}
            {job.dualPct > 0 ? (
              <div className="font-bold text-[var(--ink)]">
                תוספת דו-צדדי: +{Math.round(job.dualPct * 100)}% ({shekel(job.dualValue)})
              </div>
            ) : null}
            {job.altQuote ? (
              <div>
                {job.altQuote.label} → {shekel(job.altQuote.total)}
              </div>
            ) : null}
            {/* ---- internal QA checks ----
                These are signals about the CATALOG and the cost model, not
                corrections to the price. Shown under the price in red they
                read as "the real price is X", which is exactly backwards:
                an approved catalog price IS the price. Admin-only, visually
                demoted, and never leading with a bare ₪ figure. */}
            {isAdmin &&
            (job.validatedConflicts.length > 0 ||
              job.smallerViolation ||
              job.monotoneViolation ||
              job.configError ||
              job.belowCost ||
              job.noOutsourceCost ||
              (!job.hasAnchors && job.source !== "validated")) ? (
              <details className="mt-2 border-r-4 border-[var(--line,#c9d4de)] pr-2">
                <summary className="cursor-pointer text-[11px] font-bold text-muted-foreground">
                  בדיקות פנימיות (
                  {
                    [
                      job.validatedConflicts.length > 0,
                      !!job.smallerViolation,
                      job.monotoneViolation,
                      !!job.configError,
                      job.belowCost,
                      job.noOutsourceCost,
                      !job.hasAnchors && job.source !== "validated",
                    ].filter(Boolean).length
                  }
                  ) — אינן משנות את המחיר
                </summary>
                <div className="mt-1 space-y-1 text-[11px] font-normal text-muted-foreground">
                  {job.validatedConflicts.length > 0 ? (
                    <div>
                      בקטלוג יש יותר משורה מאומתת אחת לאותה מידה וכמות (
                      {job.validatedConflicts.map((c) => shekel(c.price)).join(" · ")}). נבחרה
                      הגבוהה. כדאי לנקות את הכפילות.
                    </div>
                  ) : null}
                  {job.smallerViolation ? (
                    <div>
                      בקטלוג יש מידה קטנה יותר ({job.smallerViolation.anchor.w}×
                      {job.smallerViolation.anchor.h}) שמחירה גבוה מהמחיר כאן. המחיר שמוצג נכון לפי
                      הקטלוג — שתי השורות ראויות לבדיקה.
                    </div>
                  ) : null}
                  {job.monotoneViolation ? (
                    <div>כמות קטנה יותר יוצאת יקרה יותר — כדאי לבדוק את עוגני המשפחה.</div>
                  ) : null}
                  {job.configError ? <div>{job.configError}</div> : null}
                  {job.belowCost ? (
                    <div>
                      המחיר נמוך ממודל העלות של המשפחה ({shekel(job.costFloorValue)}). לרוב זה סימן
                      שמודל העלות אינו מעודכן, ולא שהמחיר שגוי.
                    </div>
                  ) : null}
                  {job.noOutsourceCost ? <div>לא הוגדרה עלות מיקור חוץ למשפחה.</div> : null}
                  {!job.hasAnchors && job.source !== "validated" ? (
                    <div>אין עוגנים למשפחה — המחיר מחושב מהעלות.</div>
                  ) : null}
                </div>
              </details>
            ) : null}
            <TodoChips todos={job.todos} />
            {job.machineNote ? (
              <div className="border-2 border-[var(--ink)] px-2 py-1 font-bold text-[var(--ink)]">
                {job.machineNote}
                {job.mountCost > 0 ? ` · עלות הדבקה ${shekel(job.mountCost)}` : ""}
              </div>
            ) : null}

            {cfg.engine === "two_machine_sheet" ? (
              job.unitsPerSheet ? (
                <div className="font-bold text-[var(--ink)]">
                  מדפסת קטנה · {job.unitsPerSheet} יח׳ בדף · {Math.ceil(job.sheets ?? 0)} דפים ·{" "}
                  {shekel(cfg.sheetPrice)} לדף · שטח הדף {printableSheet(cfg).w}×
                  {printableSheet(cfg).h} ס״מ
                  {job.bindingRule === "validated" ||
                  job.bindingRule === "anchor" ||
                  job.bindingRule === "curve" ||
                  job.bindingRule === "package_min"
                    ? " · מחיר חבילה"
                    : ""}
                </div>
              ) : (
                <div className="font-bold text-[var(--ink)]">
                  מדפסת גדולה (דף גדול) ·{" "}
                  {nq > 1
                    ? `${nq.toLocaleString()} יח׳ × ${jobArea.toFixed(3)} = ${(jobArea * nq).toFixed(3)} מ״ר`
                    : `${jobArea.toFixed(3)} מ״ר`}{" "}
                  · לפי מ״ר
                  {cfg.minJobPrice > 0 ? ` · מינימום ${shekel(cfg.minJobPrice)} לעבודה` : ""} —
                  המדבקה אינה נכנסת לדף הקטן {printableSheet(cfg).w}×{printableSheet(cfg).h} ס״מ
                </div>
              )
            ) : job.unitsPerSheet ? (
              <div>
                {job.unitsPerSheet} יח׳ בגיליון · {Math.ceil(job.sheets ?? 0)} גיליונות · שטח הדפסה{" "}
                {printableSheet(cfg).w}×{printableSheet(cfg).h} ס״מ
              </div>
            ) : job.unitsPerSheet === 0 ? (
              /* 0 היה נופל כערך falsy והשורה נעלמה — בדיוק המקרה שבו חשוב
                 להראות שהיחידה אינה נכנסת לגיליון ולכן אינה מתומחרת ממנו */
              <div className="font-bold text-[var(--ink)]">
                היחידה אינה נכנסת לשטח ההדפסה {printableSheet(cfg).w}×{printableSheet(cfg).h} ס״מ —
                תמחור פורמט גדול לפי מ״ר
              </div>
            ) : null}
            {/* הנחת הכמות של הפורמט הגדול — מראה מה המקדם עושה בפועל לכמות
                שהוזנה, במקום להשאיר אותו מספר בהגדרות בלבד */}
            {cfg.qtyExponentPinned && job.bindingRule === "large_format" && job.qtyFactor < nq ? (
              <div>
                מקדם כמות {cfg.qtyExponent}: {nq.toLocaleString()} יח׳ מחויבות כ-
                {job.qtyFactor.toFixed(2)} · חיסכון {shekel((nq / job.qtyFactor - 1) * job.total)}
              </div>
            ) : null}
            {isAdmin ? (
              <>
                <div>{job.detail}</div>
                <div>
                  עלות ייצור {shekel(job.cost)} · סף רווח {shekel(job.costFloorValue)}
                  {job.above ? " · מעל הסף" : ""}
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* how THIS family is priced — derived from its plan, so it cannot
          drift from what the engine actually does. Hebrew for everyone,
          English added for admins. */}
      {family && explanation ? (
        <section className="border-2 border-[var(--ink)] bg-card p-5 shadow-[4px_4px_0_var(--ink)]">
          <h2 className="mb-1 text-base font-black text-[var(--ink)]">איך נקבע המחיר — {family}</h2>
          <p className="mb-4 text-xs text-muted-foreground">
            ההסבר נוצר מהתצורה של המשפחה עצמה, ולכן הוא תמיד תואם למה שהמחשבון עושה בפועל.
          </p>

          <ol className="mb-5 list-inside list-decimal space-y-2 text-xs leading-relaxed">
            {explanation.steps.map((line, i) => (
              <li key={i} className="text-[var(--ink)]">
                <span className="font-bold">{line.he}</span>
                {isAdmin ? (
                  <div dir="ltr" className="mt-0.5 text-left font-normal text-muted-foreground">
                    {line.en}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>

          {explanation.settings.length ? (
            <>
              <div className="mb-2 text-[11px] font-bold text-muted-foreground">
                ההגדרות שבתוקף למשפחה זו
              </div>
              <div className="mb-4 flex flex-wrap gap-2">
                {explanation.settings.map((line, i) => (
                  <span
                    key={i}
                    title={isAdmin ? line.en : undefined}
                    className="border-2 border-[var(--line,#c9d4de)] px-2 py-1 text-[11px] font-bold text-[var(--ink)]"
                  >
                    {line.he}
                    {isAdmin ? (
                      <span dir="ltr" className="mr-2 font-normal text-muted-foreground">
                        {line.en}
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            </>
          ) : null}

          {explanation.todos.length ? <TodoChips todos={explanation.todos} /> : null}

          <div className="mt-3 border-t-2 border-dashed border-[var(--line,#c9d4de)] pt-2 text-[11px] font-bold text-muted-foreground">
            <div>
              {validated.length.toLocaleString()} שורות מסומנות אומת
              {prepared?.sheetSurface || prepared?.largeSurface
                ? ` · משטח מחירים מ-${((prepared?.sheetSurface?.rows ?? 0) + (prepared?.largeSurface?.rows ?? 0)).toLocaleString()} מהן`
                : " · אין די שורות מאומתות — מחיר לפי התצורה"}
            </div>
            {isAdmin ? (
              <div dir="ltr" className="text-left font-normal">
                {validated.length.toLocaleString()} rows marked approved
                {prepared?.sheetSurface || prepared?.largeSurface
                  ? ` · price surface built from ${((prepared?.sheetSurface?.rows ?? 0) + (prepared?.largeSurface?.rows ?? 0)).toLocaleString()} of them`
                  : " · not enough approved rows yet — priced from configuration"}
                . Where the catalog has no nearby price the engine falls back to configuration
                rather than extrapolating.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* verified reference items */}
      {family ? (
        <section className="border-2 border-[var(--ink)] bg-card p-5 shadow-[4px_4px_0_var(--ink)]">
          <h2 className="mb-1 text-base font-black text-[var(--ink)]">
            מחירים מאומתים בקטלוג — {family}
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">
            רק פריטים שסומנו כמאומתים. אלו המחירים שכבר נגבים בפועל.
          </p>

          {nearest.length ? (
            <>
              <div className="mb-2 text-[11px] font-bold text-muted-foreground">
                הכי קרובים למידה שהוזנה
              </div>
              <div className="mb-6 flex flex-wrap gap-2">
                {nearest.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      setW(String(v.w));
                      setH(String(v.h));
                      setQty(String(v.qty));
                    }}
                    className="border-2 border-[var(--ink)] bg-background px-3 py-2 text-right"
                  >
                    <div className="text-sm font-black text-[var(--ink)]">
                      {v.w}×{v.h}
                      {paperLabel(v.w, v.h) ? (
                        <span className="mr-1 border border-[var(--ink)] px-1 text-[10px] font-black">
                          {paperLabel(v.w, v.h)}
                        </span>
                      ) : null}
                      {v.qty > 1 ? ` · ${v.qty.toLocaleString()} יח׳` : ""}
                    </div>

                    <div className="text-lg font-black text-[var(--accent-raw)]">
                      {shekel(v.price)}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{v.area.toFixed(3)} מ״ר</div>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          <div className="max-h-[22rem] overflow-y-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b-2 border-[var(--ink)] text-[11px] text-muted-foreground">
                  <th className="p-2 text-right font-medium">מידה</th>
                  <th className="p-2 text-right font-medium">שטח מ״ר</th>
                  <th className="p-2 text-right font-medium">כמות</th>
                  <th className="p-2 text-right font-medium">מחיר</th>
                  <th className="p-2 text-right font-medium">שם</th>
                </tr>
              </thead>
              <tbody>
                {verifiedList.map((v) => (
                  <tr
                    key={v.id}
                    onClick={() => {
                      setW(String(v.w));
                      setH(String(v.h));
                      setQty(String(v.qty));
                    }}
                    className="cursor-pointer border-b border-[var(--line,#c9d4de)] text-sm font-bold hover:bg-[var(--ink)]/5"
                  >
                    <td className="p-2">
                      {v.w}×{v.h}
                      {paperLabel(v.w, v.h) ? (
                        <span className="mr-1 border border-[var(--ink)] px-1 text-[10px] font-black">
                          {paperLabel(v.w, v.h)}
                        </span>
                      ) : null}
                    </td>

                    <td className="p-2 font-normal text-muted-foreground">{v.area.toFixed(3)}</td>
                    <td className="p-2">{v.qty.toLocaleString()}</td>
                    <td className="p-2 text-[var(--accent-raw)]">{shekel(v.price)}</td>
                    <td className="max-w-[18rem] truncate p-2 text-xs font-normal text-muted-foreground">
                      {v.name}
                    </td>
                  </tr>
                ))}
                {!verifiedList.length ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-sm text-muted-foreground">
                      אין עדיין פריטים מאומתים במשפחה זו.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {/* family config — viewable by everyone, editable only by admins; collapsed by default */}
      {family ? (
        <details className="group border-2 border-[var(--ink)] bg-card shadow-[4px_4px_0_var(--ink)]">
          <summary className="cursor-pointer list-none px-5 py-3 text-sm font-black text-muted-foreground hover:text-[var(--ink)]">
            <span className="ml-2 inline-block transition group-open:rotate-90">›</span>
            הגדרות מתקדמות — תמחור ועוגנים
            <span className="mr-2">
              <EngineBadge size="xs" engine={cfg.engine} legacy={saved.legacy} />
            </span>
          </summary>
          <div className="border-t-2 border-[var(--line,#c9d4de)] p-5">
            {/* כל משתמש עם גישה למשפחה עורך את התצורה (9/23); מדיניות המסד: families_update_by_access */}
            <fieldset className="min-w-0 border-0 p-0">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-black text-[var(--ink)]">תמחור משפחה — {family}</h2>
                <button
                  onClick={save}
                  disabled={saveCfg.isPending}
                  className="border-2 border-[var(--ink)] bg-[var(--ink)] px-6 py-1.5 text-sm font-black text-white shadow-[3px_3px_0_var(--line,#c9d4de)] disabled:opacity-50"
                >
                  {saveCfg.isPending ? "שומר…" : "שמור הגדרות"}
                </button>
              </div>

              {(job?.todos ?? cfg.todos).length ? (
                <div className="mb-3">
                  <TodoChips todos={job?.todos ?? cfg.todos} />
                </div>
              ) : null}

              {/* ---------- (א) מנוע ומדיניות קשירה לקטלוג ---------- */}
              <div className="flex flex-wrap items-end gap-6">
                <Field
                  label="מנוע תמחור"
                  value={draft.engine}
                  onChange={(v) => setDraft((p) => ({ ...p, engine: v }))}
                  width="w-56"
                  as="select"
                >
                  {(Object.keys(ENGINE_LABEL) as EngineKind[]).map((k) => (
                    <option key={k} value={k}>
                      {ENGINE_LABEL[k]}
                    </option>
                  ))}
                </Field>
                <Field
                  label="שורות הקטלוג קובעות מחיר"
                  value={draft.catalogBinds}
                  onChange={(v) =>
                    setDraft((p) => ({ ...p, catalogBinds: isCatalogBinds(v) ? v : p.catalogBinds }))
                  }
                  width="w-64"
                  as="select"
                >
                  <option value="all">כל שורה מאומתת</option>
                  <option value="anchors">רק עוגנים ⚓</option>
                  <option value="packs">חבילות (מ-{cfg.shortRunRefQty}) + מדבקות מחוץ לדף הקטן</option>
                  <option value="none">אף שורה — נוסחה בלבד</option>
                </Field>
                <div className="w-full text-[11px] font-bold text-muted-foreground">
                  {CATALOG_BINDS_HELP[cfg.catalogBinds]}
                </div>
              </div>

              {draft.engine === "per_m2" && anchors.some((a) => a.qty > 500) ? (
                <div className="mt-2 inline-block border-2 border-destructive px-2 py-1 text-xs font-bold text-destructive">
                  לפי מ״ר אסור: קיימים עוגני כמות מעל 500
                </div>
              ) : null}

              {/* ---------- מגבלות מכונה — גבול הייצור המוחלט קודם ---------- */}
              <div className="mt-4 w-full border-t-2 border-dashed border-[var(--line,#c9d4de)] pt-4">
                <div className="mb-3 text-[11px] font-black tracking-widest text-muted-foreground">
                  מגבלות מכונה · גבול ייצור מוחלט {cfg.capW || "∞"}×{cfg.capL || "∞"} ס״מ
                </div>
                <div className="flex flex-wrap items-end gap-6">
                  <Field
                    label='גבול ייצור מוחלט — רוחב (ס"מ)'
                    value={draft.capW}
                    onChange={(v) => setDraft((p) => ({ ...p, capW: v }))}
                    width="w-48"
                    placeholder="ללא"
                  />
                  <Field
                    label='גבול ייצור מוחלט — אורך (ס"מ)'
                    value={draft.capL}
                    onChange={(v) => setDraft((p) => ({ ...p, capL: v }))}
                    width="w-48"
                    placeholder="ללא"
                  />
                  <Field
                    label='גבול הדפסה — רוחב (ס"מ)'
                    value={draft.maxPrintW}
                    onChange={(v) => setDraft((p) => ({ ...p, maxPrintW: v }))}
                    width="w-44"
                    placeholder="ללא"
                  />
                  <Field
                    label='גבול הדפסה — אורך (ס"מ)'
                    value={draft.maxPrintL}
                    onChange={(v) => setDraft((p) => ({ ...p, maxPrintL: v }))}
                    width="w-44"
                    placeholder="ללא"
                  />
                  <Field
                    label="מעל גבול ההדפסה"
                    value={draft.overLimit}
                    onChange={(v) =>
                      setDraft((p) => ({ ...p, overLimit: v as typeof p.overLimit }))
                    }
                    width="w-48"
                    as="select"
                  >
                    <option value="weld">פיצול לחלקים (ריתוך)</option>
                    <option value="mount">הדבקה על לוח</option>
                    <option value="block">אין ייצור</option>
                    <option value="outsource">ייצור חוץ</option>
                  </Field>
                  {draft.overLimit === "outsource" ? (
                    <>
                      <Field
                        label="תעריף ייצור חוץ ללקוח ₪/מ״ר"
                        value={draft.outsourcedRateM2}
                        onChange={(v) => setDraft((p) => ({ ...p, outsourcedRateM2: v }))}
                        width="w-52"
                        placeholder="עלות × מקדם"
                      />
                      <div className="mb-[6px] w-72 text-[11px] font-bold text-muted-foreground">
                        הצד הצר מעל גבול הרוחב → ייצור חוץ במחיר שטוח למ״ר (עם מינימום העבודה).
                        שורות קטלוג במידות ייצור חוץ אינן קובעות מחיר.
                      </div>
                    </>
                  ) : null}
                  {draft.overLimit === "mount" ? (
                    <>
                      <Field
                        label="עלות הדבקה ₪ למ״ר"
                        value={draft.mountCostM2}
                        onChange={(v) => setDraft((p) => ({ ...p, mountCostM2: v }))}
                        width="w-40"
                        placeholder="0"
                      />
                      <Field
                        label="עלות הדבקה ₪ ליחידה"
                        value={draft.mountCostUnit}
                        onChange={(v) => setDraft((p) => ({ ...p, mountCostUnit: v }))}
                        width="w-40"
                        placeholder="0"
                      />
                    </>
                  ) : null}
                  <label className="mb-[6px] flex items-center gap-2 text-xs font-black">
                    <input
                      type="checkbox"
                      checked={draft.wholeBoard}
                      onChange={(e) => setDraft((p) => ({ ...p, wholeBoard: e.target.checked }))}
                    />
                    חיוב חומר לפי לוח שלם (השארית נזרקת)
                  </label>
                  {draft.wholeBoard ? (
                    <>
                      <Field
                        label='לוח — רוחב (ס"מ)'
                        value={draft.boardW}
                        onChange={(v) => setDraft((p) => ({ ...p, boardW: v }))}
                        width="w-40"
                      />
                      <Field
                        label='לוח — אורך (ס"מ)'
                        value={draft.boardH}
                        onChange={(v) => setDraft((p) => ({ ...p, boardH: v }))}
                        width="w-40"
                      />
                    </>
                  ) : null}
                </div>
              </div>

              {/* ---------- (ב) הגדרות המנוע שנבחר ---------- */}
              <div className="mt-4 w-full border-t-2 border-dashed border-[var(--line,#c9d4de)] pt-4">
                <div className="mb-3 text-[11px] font-black tracking-widest text-muted-foreground">
                  הגדרות המנוע — {ENGINE_LABEL[cfg.engine]}
                </div>

                {/* סיכום קריאה-בלבד של טבלאות התצורה (נטענות מהזרעים; עריכה בקוד) */}
                {cfg.engine === "two_machine_sheet" ? (
                  <div className="mb-3 text-[11px] font-bold text-muted-foreground">
                    דף קטן: {shekel(cfg.sheetPrice)} לדף · חבילות האתר מ-
                    {cfg.shortRunRefQty.toLocaleString()} יח׳ ({cfg.sizeBuckets.length} דליי גודל ×{" "}
                    {cfg.qtyMultipliers.length} מקדמי כמות) · מדפסת גדולה:{" "}
                    {cfg.perM2Tiers.length
                      ? cfg.perM2Tiers.map((t) => `${t.minM2}+ מ״ר → ${shekel(t.rate)}`).join(" · ")
                      : "אין מדרגות מ״ר!"}
                    {cfg.minJobPrice > 0 ? ` · מינימום ${shekel(cfg.minJobPrice)} לעבודה` : ""}
                  </div>
                ) : null}
                {(cfg.engine === "anchor_curve" || cfg.engine === "catalog_surface") &&
                (cfg.sizeBuckets.length || cfg.curveAnchors.length) ? (
                  <div className="mb-3 text-[11px] font-bold text-muted-foreground">
                    עקומה מוגדרת: {cfg.sizeBuckets.length} דליים · {cfg.curveAnchors.length} נקודות
                    {cfg.qtyMultipliers.length ? ` · ${cfg.qtyMultipliers.length} מקדמי כמות` : ""}
                    {cfg.dualSurcharge.length ? ` · ${cfg.dualSurcharge.length} מדרגות דו-צדדי` : ""}
                  </div>
                ) : null}
                {cfg.engine === "size_ladder" ? (
                  <div className="mb-3 text-[11px] font-bold text-muted-foreground">
                    סולם: {cfg.sizeLadder.length} מידות
                    {cfg.sizeLadder.length
                      ? " — " +
                        [...cfg.sizeLadder]
                          .sort((a, b) => a.w * a.h - b.w * b.h)
                          .map((p) => `${p.w}×${p.h} ${shekel(p.price)}`)
                          .join(" · ")
                      : ""}
                  </div>
                ) : null}
                {cfg.engine === "per_m2" ? (
                  <div className="mb-3 text-[11px] font-bold text-muted-foreground">
                    מדרגות מ״ר:{" "}
                    {cfg.perM2Tiers.length
                      ? cfg.perM2Tiers.map((t) => `${t.minM2}+ מ״ר → ${shekel(t.rate)}`).join(" · ")
                      : "אין — עלות × מקדם"}
                  </div>
                ) : null}
                {cfg.engine === "sheet_yield" ? (
                  cfg.yieldTable.length ? (
                    <div className="mb-3 text-[11px] font-bold text-muted-foreground">
                      טבלת תפוקה: {cfg.yieldTable.length} שורות
                    </div>
                  ) : (
                    <div className="mb-3 border-2 border-dashed border-[var(--line,#c9d4de)] p-3 text-xs font-bold text-muted-foreground opacity-60">
                      טבלת תפוקה — TODO (עריכה בקוד; המחיר מחושב מעלות חומר × מקדם)
                    </div>
                  )
                ) : null}
                {cfg.engine === "unit_floor" ? (
                  <div className="mb-3 text-[11px] font-bold text-muted-foreground">
                    מחירי מבנה: {cfg.formatPrices.length} תצורות
                  </div>
                ) : null}

                <div className="flex flex-wrap items-end gap-6">
                  {cfg.engine === "two_machine_sheet" ? (
                    <>
                      <Field
                        label="מחיר דף קטן ₪"
                        value={draft.sheetPrice}
                        onChange={(v) => setDraft((p) => ({ ...p, sheetPrice: v }))}
                        width="w-40"
                        placeholder="20"
                      />
                      <Field
                        label="מדפסת גדולה — מינימום ₪ לעבודה"
                        value={draft.minJobPrice}
                        onChange={(v) => setDraft((p) => ({ ...p, minJobPrice: v }))}
                        width="w-44"
                        placeholder="ללא"
                      />
                    </>
                  ) : null}
                  {cfg.engine === "per_m2" ? (
                    <Field
                      label="מינימום ₪ לעבודה (עד 1 מ״ר)"
                      value={draft.minJobPrice}
                      onChange={(v) => setDraft((p) => ({ ...p, minJobPrice: v }))}
                      width="w-48"
                      placeholder="ללא"
                    />
                  ) : null}
                  <Field
                    label={
                      cfg.engine === "sheet_yield"
                        ? "עלות גיליון ₪"
                        : cfg.engine === "anchor_curve" || cfg.engine === "two_machine_sheet"
                          ? "עלות ייצור ₪ לגיליון"
                          : "עלות ייצור ₪/מ״ר"
                    }
                    value={draft.cost}
                    onChange={(v) => setDraft((p) => ({ ...p, cost: v }))}
                    width="w-44"
                  />
                  <Field
                    label="עלות ייצור חוץ ₪/מ״ר"
                    value={draft.out}
                    onChange={(v) => setDraft((p) => ({ ...p, out: v }))}
                    width="w-48"
                  />
                  {cfg.engine === "per_m2" ? (
                    <>
                      <Field
                        label='סף מיקור חוץ — רוחב (ס"מ)'
                        value={draft.tw}
                        onChange={(v) => setDraft((p) => ({ ...p, tw: v }))}
                        width="w-44"
                        placeholder="ללא"
                      />
                      <Field
                        label='סף מיקור חוץ — גובה (ס"מ)'
                        value={draft.th}
                        onChange={(v) => setDraft((p) => ({ ...p, th: v }))}
                        width="w-44"
                        placeholder="ללא"
                      />
                    </>
                  ) : cfg.engine === "anchor_curve" ? (
                    /* לא שדות: הסף כאן נגזר מהגיליון עצמו, ואין ערך שאפשר להזין
                       שישנה אותו. שדות הסף הישנים לא נקראו באף מסלול תמחור. */
                    <div className="w-72 self-end text-[11px] font-bold text-muted-foreground">
                      <div className={labelCls}>סף פורמט גדול</div>
                      <div className="border-b-2 border-dashed border-[var(--line,#c9d4de)] px-1 py-1">
                        נגזר משטח ההדפסה {printableSheet(cfg).w}×{printableSheet(cfg).h} ס״מ — יחידה
                        שאינה נכנסת לגיליון מתומחרת לפי מ״ר, ללא מינימום הכמות
                      </div>
                    </div>
                  ) : null}
                  <Field
                    label="מקדם רווח (×)"
                    value={draft.margin}
                    onChange={(v) => setDraft((p) => ({ ...p, margin: v }))}
                  />
                  {cfg.engine === "anchor_curve" ? (
                    <Field
                      label="חבילות"
                      value={draft.packages}
                      onChange={(v) => setDraft((p) => ({ ...p, packages: v }))}
                      width="w-56"
                    />
                  ) : null}
                  {(cfg.engine === "anchor_curve" || cfg.engine === "sheet_yield") && (
                    <Field
                      label="ריצה קצרה — % ממחיר כמות הייחוס"
                      value={draft.shortRunPct}
                      onChange={(v) => setDraft((p) => ({ ...p, shortRunPct: v }))}
                      width="w-56"
                      placeholder="70"
                    />
                  )}
                  {/* מקדם כמות חל אך ורק על ענף הפורמט הגדול של עקומת העוגנים */}
                  {cfg.engine === "anchor_curve" && cfg.outsourceCost > 0 ? (
                    <Field
                      label="מקדם כמות — פורמט גדול (1 = ליניארי)"
                      value={draft.qtyExponent}
                      onChange={(v) => setDraft((p) => ({ ...p, qtyExponent: v }))}
                      width="w-64"
                      placeholder="1"
                    />
                  ) : null}
                  <Field
                    label="מינימום הזמנה (יחידות)"
                    value={draft.minOrderQty}
                    onChange={(v) => setDraft((p) => ({ ...p, minOrderQty: v }))}
                    width="w-44"
                    placeholder="ללא"
                  />
                  <Field
                    label="מינימום הזמנה ₪ (כולל מע״מ)"
                    value={draft.minOrderValue}
                    onChange={(v) => setDraft((p) => ({ ...p, minOrderValue: v }))}
                    width="w-48"
                    placeholder="ללא"
                  />
                  <Field
                    label="מ״ר מינימלי ליחידה (מעל הסף)"
                    value={draft.minUnitArea}
                    onChange={(v) => setDraft((p) => ({ ...p, minUnitArea: v }))}
                    width="w-44"
                  />
                  <div className="mb-[6px] text-[11px] font-bold text-muted-foreground">
                    עיגול אוטומטי: עד ₪20 → 0.5 · עד ₪100 → ₪1 · מעל ₪100 → ₪5
                  </div>

                  {sheetish && (
                    <div className="w-full border-t-2 border-dashed border-[var(--line,#c9d4de)] pt-4">
                      <div className="mb-3 text-[11px] font-black tracking-widest text-muted-foreground">
                        {cfg.engine === "two_machine_sheet" ? "הדף של המדפסת הקטנה" : "גיליון הדפסה"}
                      </div>
                      <div className="flex flex-wrap items-end gap-6">
                        <Field
                          label='רוחב גיליון (ס"מ)'
                          value={draft.sheetW}
                          onChange={(v) => setDraft((p) => ({ ...p, sheetW: v }))}
                          width="w-36"
                        />
                        <Field
                          label='גובה גיליון (ס"מ)'
                          value={draft.sheetH}
                          onChange={(v) => setDraft((p) => ({ ...p, sheetH: v }))}
                          width="w-36"
                        />
                        <Field
                          label='שוליים לא מודפסים (ס"מ)'
                          value={draft.sheetMargin}
                          onChange={(v) => setDraft((p) => ({ ...p, sheetMargin: v }))}
                          width="w-48"
                        />
                        <Field
                          label='מרווח בין יחידות (ס"מ)'
                          value={draft.sheetGap}
                          onChange={(v) => setDraft((p) => ({ ...p, sheetGap: v }))}
                          width="w-44"
                        />
                        <div className="text-xs text-muted-foreground">
                          שטח הדפסה {printableSheet(cfg).w}×{printableSheet(cfg).h} ס״מ
                          {nw && nh ? (
                            <>
                              {" · "}
                              {sheetUnitsFor(cfg, nw, nh).units} יח׳ בגיליון עבור {nw}×{nh}
                              {sheetUnitsFor(cfg, nw, nh).manual ? " (ידני)" : ""}
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* מדרגות כמות — מחיר קבוע ליחידה, גובר על מקדם כמות */}
              <div className="mt-5 border-2 border-dashed border-[var(--ink)]/40 p-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm font-black text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={tiersOn}
                    onChange={(e) => setTiersOn(e.target.checked)}
                    className="h-4 w-4 accent-[var(--ink)]"
                  />
                  מדרגות כמות — מחיר קבוע ליחידה (גובר על מקדם כמות)
                </label>
                <div className="mt-1 text-[11px] font-bold text-muted-foreground">
                  לדוגמה: מכמות 10 ומעלה — 47 ₪ ליחידה. מדרגה עם מידה חלה על כל מידה שנכנסת בה
                  (120×80 חלה גם על 100×80); מידה ריקה = כל המידות במשפחה. בין יחידה בודדת
                  לכמות המדרגה המחיר עולה ליניארית. מחיר מאומת בקטלוג באותה מידה ובאותה כמות
                  עדיין גובר (לפי מדיניות הקשירה).
                </div>

                {tiersOn ? (
                  <div className="mt-3 space-y-2">
                    {tiers.map((t, i) => (
                      <div key={i} className="flex flex-wrap items-end gap-3">
                        <div className="w-28">
                          <label className={labelCls}>מכמות</label>
                          <input
                            className="w-full border-b-2 border-[var(--ink)] bg-transparent py-1 font-bold outline-none"
                            value={t.minQty}
                            onChange={(e) =>
                              setTiers((p) =>
                                p.map((x, j) => (j === i ? { ...x, minQty: e.target.value } : x)),
                              )
                            }
                          />
                        </div>
                        <div className="w-32">
                          <label className={labelCls}>₪ ליחידה</label>
                          <input
                            className="w-full border-b-2 border-[var(--ink)] bg-transparent py-1 font-bold outline-none"
                            value={t.unitPrice}
                            onChange={(e) =>
                              setTiers((p) =>
                                p.map((x, j) =>
                                  j === i ? { ...x, unitPrice: e.target.value } : x,
                                ),
                              )
                            }
                          />
                        </div>
                        <div className="w-36">
                          <label className={labelCls}>מידה (אופציונלי)</label>
                          <input
                            placeholder="כל המידות"
                            className="w-full border-b-2 border-[var(--ink)] bg-transparent py-1 font-bold outline-none"
                            value={t.size}
                            onChange={(e) =>
                              setTiers((p) =>
                                p.map((x, j) => (j === i ? { ...x, size: e.target.value } : x)),
                              )
                            }
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setTiers((p) => p.filter((_, j) => j !== i))}
                          className="mb-1 border-2 border-[var(--ink)] px-3 py-1 text-xs font-black"
                        >
                          הסר
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setTiers((p) => [...p, { minQty: "", unitPrice: "", size: "" }])
                      }
                      className="border-2 border-[var(--ink)] bg-background px-4 py-1 text-sm font-bold"
                    >
                      + הוסף מדרגה
                    </button>
                  </div>
                ) : null}
              </div>

              {/* הסכמה עם הקטלוג — הנוסחה לבדה מול כל שורה מאומתת */}
              {agreement ? (
                <div className="mt-5 border-2 border-dashed border-[var(--ink)]/40 p-4">
                  <div className="text-sm font-black text-[var(--ink)]">
                    הסכמה עם הקטלוג — {agreement.scored.toLocaleString()} מתוך{" "}
                    {agreement.total.toLocaleString()} שורות מאומתות מתומחרות בנוסחה בלבד · סטייה
                    ממוצעת {Math.round(agreement.mean * 100)}%
                    {agreement.losing > 0 ? (
                      <span className="mr-2 text-destructive">
                        · {agreement.losing} שורות נמכרות מתחת לעלות
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-[11px] font-bold text-muted-foreground">
                    מה הנוסחה (ללא קשירה לקטלוג) הייתה נותנת לכל שורה מאומתת. סטייה גדולה = הקטלוג
                    והכלל של המשפחה אינם מסכימים — אחד מהם צריך להתעדכן. השורות עצמן אינן נערכות כאן.
                  </div>
                  {agreement.worst.length ? (
                    <table className="mt-3 w-full text-xs">
                      <thead>
                        <tr className="text-[11px] text-muted-foreground">
                          <th className="text-right font-bold">מידה</th>
                          <th className="text-right font-bold">כמות</th>
                          <th className="text-right font-bold">קטלוג</th>
                          <th className="text-right font-bold">נוסחה</th>
                          <th className="text-right font-bold">Δ</th>
                          <th className="text-right font-bold">מתחת לעלות</th>
                          <th className="text-right font-bold">כלל</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agreement.worst.map((r) => (
                          <tr key={r.id} className="border-t border-[var(--line,#c9d4de)]">
                            <td className="py-1 font-bold">
                              {r.w}×{r.h}
                              {r.anchor ? " ⚓" : ""}
                            </td>
                            <td className="py-1">{r.qty.toLocaleString()}</td>
                            <td className="py-1">{shekel(r.price)}</td>
                            <td className="py-1">{r.engine === null ? "—" : shekel(r.engine)}</td>
                            <td
                              className={`py-1 font-black ${
                                r.delta !== null && Math.abs(r.delta) > 0.1
                                  ? "text-destructive"
                                  : "text-[var(--ink)]"
                              }`}
                            >
                              {r.delta === null
                                ? "—"
                                : `${r.delta > 0 ? "+" : ""}${Math.round(r.delta * 100)}%`}
                            </td>
                            <td className="py-1 font-black text-destructive">
                              {r.belowCost ? "כן" : ""}
                            </td>
                            <td className="py-1 text-muted-foreground">
                              {r.rule ? BINDING_LABEL[r.rule] : ""}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-4 border-t-2 border-dashed border-[var(--line,#c9d4de)] pt-3">
                <button
                  onClick={save}
                  disabled={saveCfg.isPending}
                  className="border-2 border-[var(--ink)] bg-[var(--ink)] px-6 py-1.5 text-sm font-black text-white shadow-[3px_3px_0_var(--line,#c9d4de)] disabled:opacity-50"
                >
                  {saveCfg.isPending ? "שומר…" : "שמור הגדרות תמחור"}
                </button>
              </div>

              {/* catalog items of the family — ⚓ marks the ones that drive the curve */}
              <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                <div className="text-xs font-bold text-muted-foreground">
                  {!sheetish
                    ? "פריטי המשפחה — לחצו ⚓ כדי לסמן/לבטל עוגן · בין העוגנים המחיר מחושב לפי המנוע שנבחר"
                    : `פריטי המשפחה — לחצו ⚓ כדי לסמן/לבטל עוגן · יחידות בגיליון: אוטומטי (שטח הדפסה ${printableSheet(cfg).w}×${printableSheet(cfg).h}, רווח ${printableSheet(cfg).gap}), ניתן לעריכה`}
                </div>
                <div className="w-56">
                  <label className={labelCls}>חיפוש לפי שם</label>
                  <input
                    className={inputCls}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="הקלידו חלק משם הפריט..."
                  />
                </div>
              </div>

              {conflicts.length > 0 ? (
                <div className="mt-3 border-r-4 border-[oklch(0.72_0.16_70)] bg-[oklch(0.96_0.05_85_/_0.55)] p-3 text-sm">
                  <div className="font-bold text-[var(--ink)]">עוגנים סותרים</div>
                  <ul className="mt-1 space-y-1">
                    {conflicts.map((c, i) => (
                      <li key={i} className="text-[13px] leading-5">
                        {c.members
                          .map(
                            (m) =>
                              `${m.w}×${m.h} · ${m.qty.toLocaleString()} יח׳ = ${shekel(m.price)}`,
                          )
                          .join("  |  ")}
                        <span className="mr-2 text-muted-foreground">
                          → העקומה משתמשת בממוצע {shekel(c.price)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-2 max-h-[26rem] overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b-2 border-[var(--ink)] text-[11px] text-muted-foreground">
                      <th className="w-10 p-2 text-right font-medium">⚓</th>
                      <th className="p-2 text-right font-medium">מידה</th>
                      {sheetish ? (
                        <>
                          <th className="p-2 text-right font-medium">יחידות בגיליון</th>
                          <th className="p-2 text-right font-medium">חבילה</th>
                        </>
                      ) : (
                        <th className="p-2 text-right font-medium">כמות</th>
                      )}
                      <th className="p-2 text-right font-medium">מחיר</th>
                      <th className="p-2 text-right font-medium">שם</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => {
                      const per = sheetUnitsFor(cfg, a.w, a.h);
                      const bad = inconsistent.some((x) => x.id === a.id);
                      return (
                        <tr
                          key={a.id}
                          className={`border-b border-[var(--line,#c9d4de)] text-base font-bold ${a.isAnchor ? "" : "opacity-70"}`}
                        >
                          <td className="p-2">
                            <button
                              title={a.isAnchor ? "בטל עוגן" : "סמן כעוגן"}
                              onClick={() => toggleAnchor.mutate({ id: a.id, on: !a.isAnchor })}
                              className={
                                a.isAnchor ? "text-[var(--ink)]" : "text-muted-foreground/50"
                              }
                            >
                              <AnchorIcon
                                className="size-4"
                                strokeWidth={a.isAnchor ? 2.5 : 1.5}
                                fill={a.isAnchor ? "currentColor" : "none"}
                              />
                            </button>
                          </td>
                          <td className="p-2">
                            {a.w}×{a.h}
                            {a.isAnchor && !a.verified ? (
                              <span
                                className="mr-2 text-xs font-normal text-muted-foreground"
                                title="פריט לא מאומת — אינו משתתף בחישוב המחיר"
                              >
                                לא מאומת — לא משפיע על התמחור
                              </span>
                            ) : null}
                            {bad ? (
                              <span className="mr-2 text-xs font-normal text-destructive">
                                עוגן לא עקבי
                              </span>
                            ) : null}
                            {conflictIds.has(a.id) ? (
                              <span
                                className="mr-2 text-xs font-normal text-[oklch(0.6_0.15_70)]"
                                title="עוגן נוסף באותו גודל וכמות במחיר אחר — העקומה משתמשת בממוצע"
                              >
                                עוגן סותר
                              </span>
                            ) : null}
                          </td>
                          {sheetish ? (
                            <>
                              <td className="p-2">
                                <input
                                  className="w-16 border-b-2 border-[var(--ink)] bg-transparent px-1 font-bold outline-none"
                                  value={per.units || ""}
                                  onChange={(e) => setUnitsForSize(a, Number(e.target.value) || 0)}
                                />
                                <small className="mr-2 text-[11px] font-normal text-muted-foreground">
                                  {per.manual ? "ידני" : "אוטומטי"}
                                </small>
                              </td>
                              <td className="p-2">{a.qty.toLocaleString()}</td>
                            </>
                          ) : (
                            <td className="p-2">{a.qty.toLocaleString()}</td>
                          )}
                          <td className="p-2 text-[var(--ink)]">
                            <input
                              key={`${a.id}-${a.price ?? ""}`}
                              className="w-24 border-b-2 border-[var(--ink)] bg-transparent px-1 font-bold outline-none"
                              defaultValue={a.price ?? ""}
                              onBlur={(e) => {
                                const v = Number(e.target.value) || 0;
                                if (v > 0 && v !== a.price)
                                  upsertAnchor.mutate({
                                    id: a.id,
                                    w: a.w,
                                    h: a.h,
                                    qty: a.qty,
                                    price: v,
                                  });
                              }}
                            />
                          </td>
                          <td className="max-w-[18rem] truncate p-2 text-xs font-normal text-muted-foreground">
                            {a.name}
                          </td>
                        </tr>
                      );
                    })}

                    <tr className="text-base">
                      <td className="p-2 text-muted-foreground">+</td>
                      <td className="p-2">
                        <input
                          className="w-14 border-b-2 border-[var(--ink)] bg-transparent px-1 outline-none"
                          placeholder="רוחב"
                          value={newRow.w}
                          onChange={(e) => setNewRow((p) => ({ ...p, w: e.target.value }))}
                        />
                        <span className="px-1">×</span>
                        <input
                          className="w-14 border-b-2 border-[var(--ink)] bg-transparent px-1 outline-none"
                          placeholder="גובה"
                          value={newRow.h}
                          onChange={(e) => setNewRow((p) => ({ ...p, h: e.target.value }))}
                        />
                      </td>
                      {sheetish ? (
                        <>
                          <td className="p-2 text-xs text-muted-foreground">
                            {Number(newRow.w) && Number(newRow.h)
                              ? `${sheetUnitsFor(cfg, Number(newRow.w), Number(newRow.h)).units} אוטומטי`
                              : "—"}
                          </td>
                          <td className="p-2">
                            <input
                              className="w-20 border-b-2 border-[var(--ink)] bg-transparent px-1 outline-none"
                              placeholder="חבילה"
                              value={newRow.qty}
                              onChange={(e) => setNewRow((p) => ({ ...p, qty: e.target.value }))}
                            />
                          </td>
                        </>
                      ) : (
                        <td className="p-2">
                          <input
                            className="w-20 border-b-2 border-[var(--ink)] bg-transparent px-1 outline-none"
                            placeholder="כמות"
                            value={newRow.qty}
                            onChange={(e) => setNewRow((p) => ({ ...p, qty: e.target.value }))}
                          />
                        </td>
                      )}
                      <td className="p-2">
                        <input
                          className="w-24 border-b-2 border-[var(--ink)] bg-transparent px-1 outline-none"
                          placeholder="מחיר"
                          value={newRow.price}
                          onChange={(e) => setNewRow((p) => ({ ...p, price: e.target.value }))}
                        />
                      </td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={addRow}
                  className="border-2 border-[var(--ink)] bg-background px-4 py-1 text-sm font-bold"
                >
                  + הוסף עוגן
                </button>
                <button
                  onClick={save}
                  disabled={saveCfg.isPending}
                  className="border-2 border-[var(--ink)] bg-[var(--ink)] px-6 py-1 text-sm font-bold text-white"
                >
                  שמור
                </button>
              </div>
            </fieldset>
          </div>
        </details>
      ) : null}
    </div>
  );
}
