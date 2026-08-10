import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUpDown } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { CurveChart } from "@/components/CurveChart";
import { supabase } from "@/integrations/supabase/client";
import { businessConfigQuery, familiesQuery, productsQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";

import {
  buildAnchors,
  costFloor,
  fitPowerCurve,
  fitQtyExponent,
  isClosedOut,
  jobCost,
  priceFromCurve,
  qtyFactor,
  shekel,
  DEFAULT_OVERHEAD_FACTOR,
  DEFAULT_QTY_EXPONENT,
  QTY_REF,
  type Product,
} from "@/lib/mdvd";


type SortKey =
  | "name"
  | "size"
  | "area"
  | "qty"
  | "senzey"
  | "final"
  | "anchor"
  | "current"
  | "trial"
  | "pin"
  | "suggested"
  | "diff";

type SortState = { key: SortKey; dir: "asc" | "desc" } | null;


export const Route = createFileRoute("/calculator")({
  head: () => ({
    meta: [
      { title: "מחשבון מידות — קונסולת MDVD" },
      { name: "description", content: "חישוב מחיר לפי שטח, מחיר מינימום והנחות כמות." },
      { property: "og:title", content: "מחשבון מידות — קונסולת MDVD" },
      { property: "og:description", content: "חישוב מחירים לפי עקומת תמחור למשפחה." },
    ],
  }),
  component: Calculator,
});

const inputCls =
  "w-full border-b-2 border-[var(--ink)] bg-transparent px-2 py-2 outline-none focus:border-[var(--accent-raw)]";

function SortHeader({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  current: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = current?.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={`flex w-full items-center justify-end gap-1 px-3 py-2 font-semibold text-white hover:bg-white/10 ${active ? "underline underline-offset-4" : ""}`}
    >
      {label}
      <ArrowUpDown className={`size-3 ${active ? "opacity-100" : "opacity-60"}`} />
    </button>
  );
}

function sortFamilyItems(
  items: { p: Product; w: number; h: number; area: number }[],
  sort: SortState,
) {
  if (!sort) return items;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (sort.key) {
      case "name":
        cmp = a.p.name.localeCompare(b.p.name, "he");
        break;
      case "size":
        cmp = a.area - b.area;
        break;
      case "area":
        cmp = a.area - b.area;
        break;
      case "qty":
        cmp = (a.p.qty ?? 1) - (b.p.qty ?? 1);
        break;
      case "senzey":
        cmp = (a.p.senzey_price ?? 0) - (b.p.senzey_price ?? 0);
        break;
      case "final":
        cmp = (a.p.final_price ?? 0) - (b.p.final_price ?? 0);
        break;
      case "anchor":
        cmp = Number(!!a.p.is_anchor) - Number(!!b.p.is_anchor);
        break;
    }
    return cmp * dir;
  });
}

function sortSimItems(
  items: {
    p: Product;
    w: number;
    h: number;
    area: number;
    suggested: number;
    current: number;
    diff: number | null;
  }[],
  simPrice: Record<string, string>,
  simPin: Record<string, boolean>,
  sort: SortState,
) {
  if (!sort) return items;
  const dir = sort.dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (sort.key) {
      case "name":
        cmp = a.p.name.localeCompare(b.p.name, "he");
        break;
      case "size":
        cmp = a.area - b.area;
        break;
      case "current":
        cmp = a.current - b.current;
        break;
      case "trial": {
        const av = simPrice[a.p.id] !== undefined ? Number(simPrice[a.p.id]) : a.current;
        const bv = simPrice[b.p.id] !== undefined ? Number(simPrice[b.p.id]) : b.current;
        cmp = av - bv;
        break;
      }
      case "pin":
        cmp = Number(!!(simPin[a.p.id] ?? a.p.is_anchor)) - Number(!!(simPin[b.p.id] ?? b.p.is_anchor));
        break;
      case "suggested":
        cmp = a.suggested - b.suggested;
        break;
      case "diff":
        cmp = (a.diff ?? Infinity) - (b.diff ?? Infinity);
        break;
    }
    return cmp * dir;
  });
}

function handleSortClick(
  current: SortState,
  setSort: (s: SortState) => void,
  key: SortKey,
) {
  if (current?.key === key) {
    setSort(current.dir === "asc" ? { key, dir: "desc" } : null);
  } else {
    setSort({ key, dir: "asc" });
  }
}


function Calculator() {
  const nav = useNavigate();
  const { isAdmin, allowedFamilies } = useAuth();
  const { data: allFamilies = [] } = useQuery(familiesQuery());
  const families = useMemo(
    () =>
      allowedFamilies === null
        ? allFamilies
        : allFamilies.filter((f) => allowedFamilies.includes(f.family)),
    [allFamilies, allowedFamilies],
  );
  const { data: products = [] } = useQuery(productsQuery());
  const { data: bizCfg } = useQuery(businessConfigQuery());

  const [family, setFamily] = useState("");
  const [familySearch, setFamilySearch] = useState("");
  const [familyOpen, setFamilyOpen] = useState(false);
  const familyWrapRef = useRef<HTMLDivElement>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [w, setW] = useState("");

  const [h, setH] = useState("");
  const [qty, setQty] = useState("1");
  const [cInput, setCInput] = useState("");
  const [costInput, setCostInput] = useState("");
  const [outWInput, setOutWInput] = useState("");
  const [outHInput, setOutHInput] = useState("");
  const [outCostInput, setOutCostInput] = useState("");
  const [ovhInput, setOvhInput] = useState("");
  const [famSort, setFamSort] = useState<SortState>(null);
  const [simSort, setSimSort] = useState<SortState>(null);


  const fam = families.find((f) => f.family === family);
  const nw = Number(w) || 0;
  const nh = Number(h) || 0;
  const nq = Math.max(1, Number(qty) || 1);
  const area = (nw * nh) / 10000;

  // volume-discount exponent for the family (editable, persisted)
  useEffect(() => {
    setCInput(String(fam?.qty_exponent ?? DEFAULT_QTY_EXPONENT));
  }, [family, fam?.qty_exponent]);
  const c = (() => {
    const n = Number(cInput);
    return Number.isFinite(n) && n > 0 ? Math.min(1.5, Math.max(0.2, n)) : DEFAULT_QTY_EXPONENT;
  })();

  // cost model (per family) + overhead factor (global)
  useEffect(() => {
    setCostInput(fam?.cost_per_m2 != null ? String(fam.cost_per_m2) : "");
    setOutWInput(fam?.outsource_width_cm != null ? String(fam.outsource_width_cm) : "");
    setOutHInput(fam?.outsource_height_cm != null ? String(fam.outsource_height_cm) : "");
    setOutCostInput(
      fam?.outsource_cost_per_m2 != null ? String(fam.outsource_cost_per_m2) : "",
    );
  }, [family, fam?.cost_per_m2, fam?.outsource_width_cm, fam?.outsource_height_cm, fam?.outsource_cost_per_m2]);
  useEffect(() => {
    setOvhInput(String(bizCfg?.overhead_factor ?? DEFAULT_OVERHEAD_FACTOR));
  }, [bizCfg?.overhead_factor]);
  const overhead = (() => {
    const n = Number(ovhInput);
    return Number.isFinite(n) && n > 0 ? n : DEFAULT_OVERHEAD_FACTOR;
  })();
  const costFamily = fam
    ? {
        ...fam,
        cost_per_m2: Number(costInput) || 0,
        outsource_width_cm: outWInput === "" ? null : Number(outWInput),
        outsource_height_cm: outHInput === "" ? null : Number(outHInput),
        outsource_cost_per_m2: outCostInput === "" ? null : Number(outCostInput),
      }
    : undefined;
  const cost = jobCost(costFamily, nw, nh, nq);
  const floorPrice = Math.round(costFloor(cost.directCost, overhead));
  const [useFloorPrice, setUseFloorPrice] = useState(false);
  useEffect(() => {
    setUseFloorPrice(false);
  }, [family, w, h, qty]);



  const qtyFit = useMemo(
    () => (family ? fitQtyExponent(products, family) : { c: DEFAULT_QTY_EXPONENT, groups: 0 }),
    [products, family],
  );


  const filteredFamilies = useMemo(() => {
    const q = familySearch.trim().toLowerCase();
    if (!q) return families;
    return families.filter((f) => f.family.toLowerCase().includes(q));
  }, [families, familySearch]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!familyWrapRef.current?.contains(e.target as Node)) {
        setFamilyOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);



  const { anchors, skipped, dropped, source } = useMemo(
    () =>
      family
        ? buildAnchors(products, family, c)
        : { anchors: [], skipped: 0, dropped: [], source: "all-items" as const },
    [products, family, c],
  );

  const qc = useQueryClient();
  const toggleAnchor = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase
        .from("products")
        .update({ is_anchor: !p.is_anchor })
        .eq("id", p.id);
      if (error) throw error;
      return !p.is_anchor;
    },
    onSuccess: (now) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(now ? "סומן כעוגן עקומה" : "הוסר מעוגני העקומה");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveExponent = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from("families")
        .update({ qty_exponent: value })
        .eq("family", family);
      if (error) throw error;
      return value;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ["families"] });
      toast.success(`מקדם הכמות נשמר (${v})`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveCosts = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("families")
        .update({
          cost_per_m2: Number(costInput) || 0,
          outsource_width_cm: outWInput === "" ? null : Number(outWInput),
          outsource_height_cm: outHInput === "" ? null : Number(outHInput),
          outsource_cost_per_m2: outCostInput === "" ? null : Number(outCostInput),
        })
        .eq("family", family);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["families"] });
      toast.success("נתוני העלות נשמרו למשפחה");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveOverhead = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from("business_config")
        .upsert({ id: 1, overhead_factor: value });
      if (error) throw error;
      return value;
    },
    onSuccess: (v) => {
      qc.invalidateQueries({ queryKey: ["business-config"] });
      toast.success(`מקדם התקורה נשמר (×${v})`);
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const fit = useMemo(() => fitPowerCurve(anchors), [anchors]);
  const calc = useMemo(
    () => priceFromCurve(anchors, skipped, fam, fit, nw, nh, nq, c),
    [anchors, skipped, fam, fit, nw, nh, nq, c],
  );
  const effectivePrice =
    useFloorPrice && floorPrice > calc.total ? floorPrice : calc.unit;



  const similar = useMemo(() => {
    if (!fam || !area) return [];
    return products
      .filter((p) => p.family === family && !isClosedOut(p) && p.width_cm && p.height_cm)
      .map((p) => ({ p, area: (Number(p.width_cm) * Number(p.height_cm)) / 10000 }))
      .filter((x) => x.area >= area * 0.75 && x.area <= area * 1.25)
      .sort((a, b) => Math.abs(a.area - area) - Math.abs(b.area - area))
      .slice(0, 12);
  }, [products, family, fam, area]);

  const famItems = useMemo(() => {
    if (!family) return [];
    return products
      .filter((p) => p.family === family && !isClosedOut(p))
      .map((p) => {
        const w = Number(p.width_cm) || 0;
        const h = Number(p.height_cm) || 0;
        return { p, w, h, area: (w * h) / 10000 };
      })
      .sort((a, b) => a.area - b.area || a.p.name.localeCompare(b.p.name, "he"));
  }, [products, family]);

  const filteredFamItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const filtered = q ? famItems.filter(({ p }) => p.name.toLowerCase().includes(q)) : famItems;
    return sortFamilyItems(filtered, famSort);
  }, [famItems, itemSearch, famSort]);


  const anchorKeys = useMemo(
    () => new Set(anchors.map((a) => `${a.w}x${a.h}`)),
    [anchors],
  );

  /* ---------------- אזור ניסוי: sandbox anchors, nothing is written to DB ---------------- */
  const [simOn, setSimOn] = useState(false);
  const [simPrice, setSimPrice] = useState<Record<string, string>>({});
  const [simPin, setSimPin] = useState<Record<string, boolean>>({});

  const resetSim = () => {
    setSimPrice({});
    setSimPin({});
  };

  useEffect(() => {
    resetSim();
  }, [family]);

  const simProducts = useMemo(() => {
    if (!simOn) return products;
    return products.map((p) => {
      const priceRaw = simPrice[p.id];
      const pin = simPin[p.id];
      if (priceRaw === undefined && pin === undefined) return p;
      const n = Number(priceRaw);
      return {
        ...p,
        final_price:
          priceRaw !== undefined && priceRaw !== "" && !Number.isNaN(n) ? n : p.final_price,
        is_anchor: pin === undefined ? p.is_anchor : pin,
      } as Product;
    });
  }, [products, simOn, simPrice, simPin]);

  const simBuild = useMemo(
    () =>
      family && simOn
        ? buildAnchors(simProducts, family, c)
        : { anchors: [], skipped: 0, dropped: [], source: "all-items" as const },
    [simProducts, family, simOn, c],
  );
  const simFit = useMemo(() => fitPowerCurve(simBuild.anchors), [simBuild.anchors]);
  const simCalc = useMemo(
    () =>
      priceFromCurve(simBuild.anchors, simBuild.skipped, fam, simFit, nw, nh, nq, c),
    [simBuild, fam, simFit, nw, nh, nq, c],
  );

  /** suggested price per family item under the experimental curve */
  const simSuggestions = useMemo(() => {
    if (!simOn || !fam || !simFit) return [];
    const items = filteredFamItems.map((x) => {
      const current = Number(x.p.final_price ?? x.p.senzey_price ?? 0) || 0;
      if (x.w && x.h) {
        const itemQty = Math.max(1, Number(x.p.qty) || 1);
        const res = priceFromCurve(
          simBuild.anchors,
          simBuild.skipped,
          fam,
          simFit,
          x.w,
          x.h,
          itemQty,
          c,
        );
        const diff = current ? ((res.unit - current) / current) * 100 : null;
        return { ...x, suggested: res.unit, current, diff };
      }
      return { ...x, suggested: 0, current, diff: null };
    });
    return sortSimItems(items, simPrice, simPin, simSort);
  }, [simOn, fam, simFit, simBuild, filteredFamItems, c, simPrice, simPin, simSort]);






  return (
    <div>
      <PageTitle title="מחשבון מידות" sub="חישוב מחיר לפי עקומת התמחור של המשפחה" />

      {/* === sticky horizontal top bar: inputs + price, always visible === */}
      <div className="sticky top-0 z-30 border-b-2 border-[var(--ink)] bg-card shadow-[4px_4px_0_0_var(--ink)]">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 p-4 lg:flex lg:flex-wrap lg:items-end lg:justify-between">
          {/* inputs */}
          <div className="flex min-w-0 flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs font-bold text-muted-foreground">משפחה</label>
              <div ref={familyWrapRef} className="relative">
                <input
                  className={inputCls}
                  value={familyOpen ? familySearch : familySearch || family || ""}
                  placeholder={family ? family : "הקלד לחיפוש משפחה…"}
                  onChange={(e) => {
                    setFamilySearch(e.target.value);
                    setFamilyOpen(true);
                  }}
                  onFocus={() => setFamilyOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      setFamilyOpen(false);
                    }
                    if (e.key === "ArrowDown" && filteredFamilies.length > 0) {
                      e.preventDefault();
                      const first = document.querySelector<HTMLButtonElement>("[data-family-option]");
                      first?.focus();
                    }
                  }}
                  aria-expanded={familyOpen}
                  aria-autocomplete="list"
                  aria-controls="family-listbox"
                />
                {familyOpen && (
                  <div
                    id="family-listbox"
                    className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto border-2 border-[var(--ink)] bg-card shadow-[4px_4px_0_0_var(--ink)]"
                  >
                    {filteredFamilies.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">לא נמצאו משפחות</div>
                    ) : (
                      filteredFamilies.map((f) => (
                        <button
                          key={f.family}
                          type="button"
                          data-family-option
                          className={`w-full px-3 py-2 text-right text-sm hover:bg-[var(--accent-raw)] hover:text-white ${
                            f.family === family ? "bg-[var(--surface-deep)] font-bold" : ""
                          }`}
                          onClick={() => {
                            setFamily(f.family);
                            setFamilySearch("");
                            setFamilyOpen(false);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              const next = (e.target as HTMLElement).nextElementSibling as HTMLButtonElement | null;
                              next?.focus();
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              const prev = (e.target as HTMLElement).previousElementSibling as HTMLButtonElement | null;
                              if (prev) {
                                prev.focus();
                              } else {
                                setFamilyOpen(false);
                              }
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                              setFamily(f.family);
                              setFamilySearch("");
                              setFamilyOpen(false);
                            } else if (e.key === "Escape") {
                              setFamilyOpen(false);
                            }
                          }}
                        >
                          {f.family}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="w-24 shrink-0">
              <label className="mb-1 block text-xs font-bold text-muted-foreground">רוחב ס״מ</label>
              <input className={`${inputCls} num`} value={w} onChange={(e) => setW(e.target.value)} />
            </div>
            <div className="w-24 shrink-0">
              <label className="mb-1 block text-xs font-bold text-muted-foreground">גובה ס״מ</label>
              <input className={`${inputCls} num`} value={h} onChange={(e) => setH(e.target.value)} />
            </div>
            <div className="w-28 shrink-0">
              <label className="mb-1 block text-xs font-bold text-muted-foreground">כמות בחבילה</label>
              <input className={`${inputCls} num`} value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>

          {/* price, always visible */}
          <div className="flex flex-wrap items-end gap-4">
            {fam ? (
              <>
                <div>
                  <div className="text-xs font-bold text-muted-foreground">
                    מחיר לעבודה ({nq.toLocaleString()} יח׳)
                  </div>
                  <div className="num text-4xl font-black text-[var(--accent-raw)]">
                    {shekel(calc.total)}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-muted-foreground">ליחידה</div>
                  <div className="num text-2xl font-black">
                    ₪{(calc.total / nq).toFixed(3)}
                  </div>
                </div>
                <button
                  onClick={() =>
                    nav({
                      to: "/new-product",
                      search: {
                        name: `הדפסה על ${family} ${nw}/${nh}`,
                        family,
                        width: nw,
                        height: nh,
                        qty: nq,
                        price: effectivePrice,
                      },
                    })
                  }
                  className="shrink-0 bg-[var(--accent-raw)] px-4 py-2 font-bold text-white shadow-[3px_3px_0_0_var(--ink)]"
                >
                  צור מוצר
                </button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">בחר משפחה כדי לחשב.</p>
            )}
          </div>
        </div>
      </div>

      {/* === main content below the sticky bar === */}
      <div className="mt-5 space-y-8">
        {fam ? (
          <>
            {/* calculation details + cost floor */}
            <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
              <div className="border-s-4 border-[var(--accent-raw)] ps-3 text-[13px] leading-relaxed">
                <div className="font-bold">{calc.label}</div>
                {calc.detail ? (
                  <div className="text-muted-foreground">{calc.detail}</div>
                ) : null}
                <div className="text-muted-foreground">
                  שטח מבוקש: {nw}×{nh} = {Math.round(area * 10000).toLocaleString()} סמ״ר
                </div>
                {calc.floorApplied ? (
                  <div className="text-muted-foreground">
                    הועלה למחיר הפריט הזול ביותר במשפחה.
                  </div>
                ) : null}
                {calc.minApplied ? (
                  <div className="text-muted-foreground">
                    הופעל מחיר מינימום של המשפחה ({shekel(fam.min_charge ?? 0)}).
                  </div>
                ) : null}
                {calc.basis !== "catalog" ? (
                  <div className="text-muted-foreground">המחיר עוגל ל־5₪ הקרובים.</div>
                ) : null}
                {fit ? (
                  <div className="text-[11px] text-muted-foreground/70">
                    {source === "anchors"
                      ? `העקומה נבנתה מ־${fit.count} עוגנים שסימנת`
                      : source === "single-anchor"
                        ? "העקומה נבנתה מעוגן יחיד שסימנת (הרחבה יחסית לשטח)"
                        : `התאמה מ־${fit.count} פריטים · מעריך ${fit.b.toFixed(2)} · סטייה ממוצעת ${fit.deviation.toFixed(0)}%`}
                    {calc.skipped > 0 ? ` · דילגנו על ${calc.skipped} חריגות` : ""}
                  </div>
                ) : null}
                {fit && source === "all-items" && fit.deviation > 15 ? (
                  <div className="text-[12px] font-bold text-[oklch(0.5_0.16_45)]">
                    סמן עוגן אחד או יותר במשפחה כדי לייצב את העקומה
                  </div>
                ) : null}
              </div>

              {cost.hasCost ? (
                <div
                  className={`border-2 p-3 text-[13px] leading-relaxed ${
                    calc.total < floorPrice
                      ? "border-[oklch(0.55_0.2_25)] bg-[oklch(0.55_0.2_25/0.08)]"
                      : "border-[var(--ink)]"
                  }`}
                >
                  {cost.outsourced ? (
                    <div className="mb-1 font-bold">
                      מעל {cost.thresholdW}×{cost.thresholdH} ס״מ — הדפסה במיקור חוץ, {shekel(cost.ratePerM2)} למ״ר
                    </div>
                  ) : null}
                  <div className="text-muted-foreground">
                    שטח {area.toFixed(3)} מ״ר × {shekel(cost.ratePerM2)} למ״ר
                    {nq > 1 ? ` × ${nq.toLocaleString()} יח׳` : ""} · עלות ישירה{" "}
                    <span className="num font-bold text-foreground">
                      {shekel(Math.round(cost.directCost))}
                    </span>{" "}
                    · רצפת מחיר (×{overhead}){" "}
                    <span className="num font-bold text-foreground">{shekel(floorPrice)}</span>
                  </div>
                  {calc.total < floorPrice ? (
                    <div className="mt-2 flex items-center gap-3">
                      <span className="font-bold text-[oklch(0.5_0.2_25)]">
                        מחיר העקומה ({shekel(calc.total)}) מתחת לרצפת המחיר
                      </span>
                      <button
                        onClick={() => setUseFloorPrice(true)}
                        className="border-2 border-[var(--ink)] px-2 py-1 text-[11px] font-bold shadow-[2px_2px_0_0_var(--ink)]"
                      >
                        השתמש ב{shekel(floorPrice)}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-1">
                      רווח גולמי{" "}
                      <span className="num font-bold">
                        {shekel(Math.round(calc.total - cost.directCost))}
                      </span>{" "}
                      ({Math.round(((calc.total - cost.directCost) / calc.total) * 100)}%)
                    </div>
                  )}
                  {useFloorPrice && floorPrice > calc.total ? (
                    <div className="mt-2 text-[12px] font-bold">
                      נבחר מחיר לפי עלות: {shekel(effectivePrice)} (לחץ{" "}
                      <button className="underline" onClick={() => setUseFloorPrice(false)}>
                        ביטול
                      </button>
                      )
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            {/* quantity exponent */}
            <section className="flex flex-wrap items-end gap-3 border-2 border-dashed border-[var(--ink)] p-3">
              <div>
                <label className="mb-1 block text-xs font-bold text-muted-foreground">
                  מקדם כמות (c)
                </label>
                <input
                  className={`${inputCls} num w-28`}
                  value={cInput}
                  onChange={(e) => setCInput(e.target.value)}
                />
              </div>
              <button
                onClick={() => setCInput(String(qtyFit.c))}
                className="border-2 border-[var(--ink)] px-3 py-2 text-xs font-bold shadow-[3px_3px_0_0_var(--ink)] disabled:opacity-40"
                disabled={qtyFit.groups === 0}
              >
                חשב מהנתונים ({qtyFit.c})
              </button>
              <button
                onClick={() => saveExponent.mutate(c)}
                className="border-2 border-[var(--ink)] bg-[var(--accent-raw)] px-3 py-2 text-xs font-bold text-[var(--ink)] shadow-[3px_3px_0_0_var(--ink)]"
              >
                שמור למשפחה
              </button>
              <p className="text-[11px] text-muted-foreground">
                המחיר גדל לפי (כמות / {QTY_REF.toLocaleString()})^c. c=1 מחיר יחסי לכמות, c נמוך יותר =
                הנחת כמות חזקה יותר.
                {qtyFit.groups > 0
                  ? ` נמדד מ־${qtyFit.groups} קבוצות מידה עם כמויות שונות.`
                  : " אין מספיק נתונים במשפחה למדידה — ערך ברירת מחדל."}
              </p>
            </section>

            <CurveChart
              anchors={simOn ? simBuild.anchors : anchors}
              dropped={simOn ? simBuild.dropped : dropped}
              fit={simOn ? simFit : fit}
              requestedArea={area}
              requestedPrice={simOn ? simCalc.unit : calc.unit}
              qty={nq}
              factor={qtyFactor(nq, c)}
              costRatePerM2={Number(costInput) || 0}
              outsourceWidthCm={outWInput === "" ? null : Number(outWInput)}
              outsourceHeightCm={outHInput === "" ? null : Number(outHInput)}
              outsourceRatePerM2={Number(outCostInput) || 0}
              overheadFactor={overhead}
            />

            {/* family items table */}
            <section>
              <h2 className="mb-1 text-lg font-black">
                כל הפריטים במשפחה «{family}»
              </h2>
              <p className="mb-2 text-sm text-muted-foreground">
                {filteredFamItems.length} פריטים מוצגים · {anchors.length} עוגני תמחור
              </p>
              <input
                className={inputCls}
                value={itemSearch}
                placeholder="סנן לפי שם פריט…"
                onChange={(e) => setItemSearch(e.target.value)}
              />
              {filteredFamItems.length === 0 ? (
                <p className="mt-3 border-2 border-dashed border-border p-6 text-sm text-muted-foreground">
                  לא נמצאו פריטים תואמים לחיפוש.
                </p>
              ) : (
                <div className="mt-3 max-h-[420px] overflow-y-auto border-2 border-[var(--ink)] bg-card">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-[var(--ink)] text-white">
                      <tr className="text-right">
                        <th className="px-0 py-0 font-semibold">
                          <SortHeader label="שם" sortKey="name" current={famSort} onSort={(k) => handleSortClick(famSort, setFamSort, k)} />
                        </th>
                        <th className="px-0 py-0 font-semibold">
                          <SortHeader label="מידה" sortKey="size" current={famSort} onSort={(k) => handleSortClick(famSort, setFamSort, k)} />
                        </th>
                        <th className="px-0 py-0 font-semibold">
                          <SortHeader label="מ״ר" sortKey="area" current={famSort} onSort={(k) => handleSortClick(famSort, setFamSort, k)} />
                        </th>
                        <th className="px-0 py-0 font-semibold">
                          <SortHeader label="כמות" sortKey="qty" current={famSort} onSort={(k) => handleSortClick(famSort, setFamSort, k)} />
                        </th>
                        <th className="px-0 py-0 font-semibold">
                          <SortHeader label="סנזיי" sortKey="senzey" current={famSort} onSort={(k) => handleSortClick(famSort, setFamSort, k)} />
                        </th>
                        <th className="px-0 py-0 font-semibold">
                          <SortHeader label="סופי" sortKey="final" current={famSort} onSort={(k) => handleSortClick(famSort, setFamSort, k)} />
                        </th>
                        <th className="px-0 py-0 font-semibold">
                          <SortHeader label="עוגן" sortKey="anchor" current={famSort} onSort={(k) => handleSortClick(famSort, setFamSort, k)} />
                        </th>
                      </tr>

                    </thead>
                    <tbody>
                      {filteredFamItems.map(({ p, w, h, area: a }, i) => (
                        <tr key={p.id} className={i % 2 ? "bg-[var(--surface-deep)]" : ""}>
                          <td className="px-3 py-1.5">{p.name}</td>
                          <td className="num px-3 py-1.5">
                            {w && h ? `${w}×${h}` : "—"}
                          </td>
                          <td className="num px-3 py-1.5">{a ? a.toFixed(3) : "—"}</td>
                          <td className="num px-3 py-1.5">{p.qty ?? 1}</td>
                          <td className="num px-3 py-1.5">{shekel(p.senzey_price)}</td>
                          <td className="num px-3 py-1.5 font-bold">{shekel(p.final_price)}</td>
                          <td className="px-3 py-1.5">
                            <button
                              onClick={() => toggleAnchor.mutate(p)}
                              title={p.is_anchor ? "הסר עוגן" : "קבע כעוגן לעקומת המשפחה"}
                              className={
                                p.is_anchor
                                  ? "bg-[var(--accent-raw)] px-1.5 py-0.5 text-[11px] font-bold text-white"
                                  : "border-2 border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:border-[var(--accent-raw)] hover:text-[var(--accent-raw)]"
                              }
                            >
                              {p.is_anchor
                                ? "עוגן"
                                : (p.qty ?? 1) === 1 && anchorKeys.has(`${w}x${h}`)
                                  ? "בשימוש"
                                  : "קבע עוגן"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* experiment section */}
            <section className="border-2 border-dashed border-[var(--accent-raw)] bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black">אזור ניסוי — עקומה זמנית</h2>
                  <p className="text-sm text-muted-foreground">
                    שנה מחירי עוגן או סמן עוגנים זמניים. שום דבר לא נשמר בקטלוג.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {simOn ? (
                    <button
                      onClick={resetSim}
                      className="border-2 border-[var(--ink)] px-3 py-1.5 text-xs font-bold"
                    >
                      אפס ניסוי
                    </button>
                  ) : null}
                  <button
                    onClick={() => setSimOn((v) => !v)}
                    className={
                      simOn
                        ? "bg-[var(--accent-raw)] px-3 py-1.5 text-xs font-bold text-white"
                        : "border-2 border-[var(--ink)] px-3 py-1.5 text-xs font-bold"
                    }
                  >
                    {simOn ? "ניסוי פעיל" : "הפעל מצב ניסוי"}
                  </button>
                </div>
              </div>

              {simOn ? (
                <>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="border-2 border-[var(--ink)] p-3">
                      <div className="text-[11px] font-bold text-muted-foreground">מחיר נוכחי לחישוב</div>
                      <div className="num text-2xl font-black">{shekel(calc.unit)}</div>
                    </div>
                    <div className="border-2 border-[var(--accent-raw)] p-3">
                      <div className="text-[11px] font-bold text-muted-foreground">מחיר בניסוי</div>
                      <div className="num text-2xl font-black text-[var(--accent-raw)]">
                        {shekel(simCalc.unit)}
                      </div>
                    </div>
                    <div className="border-2 border-dashed border-border p-3">
                      <div className="text-[11px] font-bold text-muted-foreground">עקומת הניסוי</div>
                      <div className="num text-sm font-bold">
                        {simFit
                          ? `${shekel(simFit.a)} למ״ר ^ ${simFit.b.toFixed(2)}`
                          : "אין מספיק עוגנים"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {simBuild.anchors.length} עוגנים
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 max-h-[360px] overflow-y-auto border-2 border-[var(--ink)]">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[var(--ink)] text-white">
                        <tr className="text-right">
                          <th className="px-0 py-0 font-semibold">
                            <SortHeader label="שם" sortKey="name" current={simSort} onSort={(k) => handleSortClick(simSort, setSimSort, k)} />
                          </th>
                          <th className="px-0 py-0 font-semibold">
                            <SortHeader label="מידה" sortKey="size" current={simSort} onSort={(k) => handleSortClick(simSort, setSimSort, k)} />
                          </th>
                          <th className="px-0 py-0 font-semibold">
                            <SortHeader label="מחיר נוכחי" sortKey="current" current={simSort} onSort={(k) => handleSortClick(simSort, setSimSort, k)} />
                          </th>
                          <th className="px-0 py-0 font-semibold">
                            <SortHeader label="מחיר ניסוי" sortKey="trial" current={simSort} onSort={(k) => handleSortClick(simSort, setSimSort, k)} />
                          </th>
                          <th className="px-0 py-0 font-semibold">
                            <SortHeader label="עוגן ניסיוני" sortKey="pin" current={simSort} onSort={(k) => handleSortClick(simSort, setSimSort, k)} />
                          </th>
                          <th className="px-0 py-0 font-semibold">
                            <SortHeader label="הצעה מהעקומה" sortKey="suggested" current={simSort} onSort={(k) => handleSortClick(simSort, setSimSort, k)} />
                          </th>
                          <th className="px-0 py-0 font-semibold">
                            <SortHeader label="פער %" sortKey="diff" current={simSort} onSort={(k) => handleSortClick(simSort, setSimSort, k)} />
                          </th>
                        </tr>

                      </thead>
                      <tbody>
                        {simSuggestions.map(({ p, w: iw, h: ih, suggested, current, diff }, i) => {
                          const pinned = simPin[p.id] ?? !!p.is_anchor;
                          return (
                            <tr key={p.id} className={i % 2 ? "bg-[var(--surface-deep)]" : ""}>
                              <td className="px-3 py-1.5">{p.name}</td>
                              <td className="num px-3 py-1.5">
                                {iw && ih ? `${iw}×${ih}` : "—"}
                              </td>
                              <td className="num px-3 py-1.5">{shekel(current)}</td>
                              <td className="px-3 py-1.5">
                                <input
                                  className="num w-24 border-b-2 border-[var(--ink)] bg-transparent px-1 py-0.5 outline-none focus:border-[var(--accent-raw)]"
                                  value={simPrice[p.id] ?? ""}
                                  placeholder={current != null ? String(current) : "—"}
                                  onChange={(e) =>
                                    setSimPrice((s) => ({ ...s, [p.id]: e.target.value }))
                                  }
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <button
                                  onClick={() =>
                                    setSimPin((s) => ({ ...s, [p.id]: !pinned }))
                                  }
                                  className={
                                    pinned
                                      ? "bg-[var(--accent-raw)] px-1.5 py-0.5 text-[11px] font-bold text-white"
                                      : "border-2 border-dashed border-border px-1.5 py-0.5 text-[11px] text-muted-foreground"
                                  }
                                >
                                  {pinned ? "עוגן" : "קבע"}
                                </button>
                              </td>
                              <td className="num px-3 py-1.5 font-bold">
                                {iw && ih ? shekel(suggested) : "—"}
                              </td>
                              <td
                                className={`num px-3 py-1.5 font-bold ${
                                  diff == null
                                    ? ""
                                    : Math.abs(diff) > 20
                                      ? "text-[oklch(0.5_0.2_25)]"
                                      : Math.abs(diff) > 5
                                        ? "text-[oklch(0.55_0.16_70)]"
                                        : "text-muted-foreground"
                                }`}
                              >
                                {diff == null ? "—" : `${diff > 0 ? "+" : ""}${diff.toFixed(0)}%`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>

                    </table>
                  </div>
                </>
              ) : null}
            </section>
          </>
        ) : null}

        <h2 className="mb-3 text-lg font-black">מוצרים קיימים דומים (±25% שטח)</h2>
        {!fam ? (
          <p className="text-sm text-muted-foreground">בחר משפחה.</p>
        ) : similar.length === 0 ? (
          <p className="border-2 border-dashed border-border p-6 text-sm text-muted-foreground">
            לא נמצאו מוצרים דומים בטווח.
          </p>
        ) : (
          <div className="overflow-x-auto border-2 border-[var(--ink)] bg-card">
            <table className="w-full text-sm">
              <thead className="bg-[var(--ink)] text-white">
                <tr className="text-right">
                  <th className="px-3 py-2 font-semibold">שם</th>
                  <th className="px-3 py-2 font-semibold">מידה</th>
                  <th className="px-3 py-2 font-semibold">מ״ר</th>
                  <th className="px-3 py-2 font-semibold">כמות</th>
                  <th className="px-3 py-2 font-semibold">מחיר סנזיי</th>
                </tr>
              </thead>
              <tbody>
                {similar.map(({ p, area }, i) => (
                  <tr key={p.id} className={i % 2 ? "bg-[var(--surface-deep)]" : ""}>
                    <td className="px-3 py-1.5">{p.name}</td>
                    <td className="num px-3 py-1.5">
                      {p.width_cm}×{p.height_cm}
                    </td>
                    <td className="num px-3 py-1.5">{area.toFixed(3)}</td>
                    <td className="num px-3 py-1.5">{p.qty ?? 1}</td>
                    <td className="num px-3 py-1.5 font-bold">{shekel(p.senzey_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* cost model — moved to bottom, admin only */}
        {family && isAdmin ? (
          <section className="border-2 border-dashed border-[var(--ink)] bg-card p-4">
            <div className="mb-2 text-xs font-black">עלות ייצור למשפחה</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                  ₪ למ״ר
                </label>
                <input
                  className={`${inputCls} num`}
                  value={costInput}
                  onChange={(e) => setCostInput(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                  סף רוחב (ס״מ)
                </label>
                <input
                  className={`${inputCls} num`}
                  value={outWInput}
                  onChange={(e) => setOutWInput(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                  סף גובה (ס״מ)
                </label>
                <input
                  className={`${inputCls} num`}
                  value={outHInput}
                  onChange={(e) => setOutHInput(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                  ₪ למ״ר במיקור חוץ
                </label>
                <input
                  className={`${inputCls} num`}
                  value={outCostInput}
                  onChange={(e) => setOutCostInput(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold text-muted-foreground">
                  מקדם תקורה (×)
                </label>
                <input
                  className={`${inputCls} num w-24`}
                  value={ovhInput}
                  onChange={(e) => setOvhInput(e.target.value)}
                />
              </div>
              <button
                onClick={() => saveCosts.mutate()}
                className="border-2 border-[var(--ink)] px-3 py-2 text-xs font-bold shadow-[3px_3px_0_0_var(--ink)]"
              >
                שמור עלויות
              </button>
              <button
                onClick={() => saveOverhead.mutate(overhead)}
                className="border-2 border-[var(--ink)] bg-[var(--accent-raw)] px-3 py-2 text-xs font-bold text-[var(--ink)] shadow-[3px_3px_0_0_var(--ink)]"
              >
                שמור תקורה
              </button>
              <p className="text-[11px] text-muted-foreground">
                תקורה ×{overhead} — מחיר חייב לכסות פי {overhead} מהעלות הישירה כדי לשאת עבודה
                והוצאות (₪{Number(bizCfg?.monthly_cost ?? 200000).toLocaleString()} חודשי מול ₪
                {Number(bizCfg?.monthly_revenue ?? 175000).toLocaleString()} מחזור).
              </p>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );

}
