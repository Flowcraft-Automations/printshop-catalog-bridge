import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/AppShell";
import { CurveChart } from "@/components/CurveChart";
import { supabase } from "@/integrations/supabase/client";
import { familiesQuery, productsQuery } from "@/lib/queries";

import {
  buildAnchors,
  fitFamilyLine,
  fitQtyExponent,
  priceFromLine,
  qtyFactor,
  shekel,
  DEFAULT_QTY_EXPONENT,
  QTY_REF,
  type Product,
} from "@/lib/mdvd";

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

function Calculator() {
  const nav = useNavigate();
  const { data: families = [] } = useQuery(familiesQuery());
  const { data: products = [] } = useQuery(productsQuery());

  const [family, setFamily] = useState("");
  const [familySearch, setFamilySearch] = useState("");
  const [familyOpen, setFamilyOpen] = useState(false);
  const familyWrapRef = useRef<HTMLDivElement>(null);
  const [itemSearch, setItemSearch] = useState("");
  const [w, setW] = useState("");

  const [h, setH] = useState("");
  const [qty, setQty] = useState("1000");
  const [cInput, setCInput] = useState("");

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

  const fit = useMemo(() => fitFamilyLine(anchors), [anchors]);
  const calc = useMemo(
    () => priceFromLine(anchors, skipped, fam, fit, nw, nh, nq, c),
    [anchors, skipped, fam, fit, nw, nh, nq, c],
  );

  const similar = useMemo(() => {
    if (!fam || !area) return [];
    return products
      .filter((p) => p.family === family && p.width_cm && p.height_cm)
      .map((p) => ({ p, area: (Number(p.width_cm) * Number(p.height_cm)) / 10000 }))
      .filter((x) => x.area >= area * 0.75 && x.area <= area * 1.25)
      .sort((a, b) => Math.abs(a.area - area) - Math.abs(b.area - area))
      .slice(0, 12);
  }, [products, family, fam, area]);

  const famItems = useMemo(() => {
    if (!family) return [];
    return products
      .filter((p) => p.family === family)
      .map((p) => {
        const w = Number(p.width_cm) || 0;
        const h = Number(p.height_cm) || 0;
        return { p, w, h, area: (w * h) / 10000 };
      })
      .sort((a, b) => a.area - b.area || a.p.name.localeCompare(b.p.name, "he"));
  }, [products, family]);

  const filteredFamItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return famItems;
    return famItems.filter(({ p }) => p.name.toLowerCase().includes(q));
  }, [famItems, itemSearch]);

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
  const simFit = useMemo(() => fitFamilyLine(simBuild.anchors), [simBuild.anchors]);
  const simCalc = useMemo(
    () =>
      priceFromLine(simBuild.anchors, simBuild.skipped, fam, simFit, nw, nh, nq, c),
    [simBuild, fam, simFit, nw, nh, nq, c],
  );

  /** suggested price per family item under the experimental curve */
  const simSuggestions = useMemo(() => {
    if (!simOn || !fam || !simFit) return [];
    return filteredFamItems
      .filter((x) => x.w && x.h)
      .map((x) => {
        const itemQty = Math.max(1, Number(x.p.qty) || 1);
        const res = priceFromLine(
          simBuild.anchors,
          simBuild.skipped,
          fam,
          simFit,
          x.w,
          x.h,
          itemQty,
          c,
        );
        const current = Number(x.p.final_price ?? x.p.senzey_price ?? 0) || 0;
        const diff = current ? ((res.unit - current) / current) * 100 : null;
        return { ...x, suggested: res.unit, current, diff };
      });
  }, [simOn, fam, simFit, simBuild, filteredFamItems, c]);




  return (
    <div>
      <PageTitle title="מחשבון מידות" sub="חישוב מחיר לפי עקומת התמחור של המשפחה" />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="border-2 border-[var(--ink)] bg-card p-5 shadow-[6px_6px_0_0_var(--ink)]">
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


          <div className="mt-4 grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">רוחב ס״מ</label>
              <input className={`${inputCls} num`} value={w} onChange={(e) => setW(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">גובה ס״מ</label>
              <input className={`${inputCls} num`} value={h} onChange={(e) => setH(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-muted-foreground">כמות</label>
              <input className={`${inputCls} num`} value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
          </div>

          {fam ? (
            <>
              <div className="mt-6 flex items-end justify-between border-t-2 border-dashed border-[var(--ink)] pt-4">
                <div>
                  <div className="text-xs font-bold text-muted-foreground">מחיר ליחידה</div>
                  <div className="num text-4xl font-black text-[var(--accent-raw)]">
                    {shekel(calc.unit)}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-muted-foreground">סה״כ</div>
                  <div className="num text-2xl font-black">{shekel(calc.total)}</div>
                </div>
              </div>
              <div className="mt-4 space-y-2 border-s-4 border-[var(--accent-raw)] ps-3 text-[13px] leading-relaxed">
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
                {calc.tier ? (
                  <div className="text-muted-foreground">
                    הנחת כמות ×{calc.mult} (מ־{calc.tier.min} יח׳).
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
                        : `התאמה מ־${fit.count} עוגנים · סטייה ממוצעת ${fit.deviation.toFixed(0)}%`}
                    {calc.skipped > 0 ? ` · דילגנו על ${calc.skipped} חריגות` : ""}
                  </div>
                ) : null}
                {fit && source === "all-items" && fit.deviation > 15 ? (
                  <div className="text-[12px] font-bold text-[oklch(0.5_0.16_45)]">
                    סמן עוגן אחד או יותר במשפחה כדי לייצב את העקומה
                  </div>
                ) : null}
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
                      price: calc.unit,
                    },
                  })
                }
                className="mt-5 w-full bg-[var(--accent-raw)] py-3 font-bold text-white"
              >
                צור מוצר מהחישוב
              </button>
            </>
          ) : (
            <p className="mt-6 text-sm text-muted-foreground">בחר משפחה כדי לחשב.</p>
          )}
        </div>

        <div>
          {family ? (
            <section className="mb-8">
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
                        <th className="px-3 py-2 font-semibold">שם</th>
                        <th className="px-3 py-2 font-semibold">מידה</th>
                        <th className="px-3 py-2 font-semibold">מ״ר</th>
                        <th className="px-3 py-2 font-semibold">כמות</th>
                        <th className="px-3 py-2 font-semibold">סנזיי</th>
                        <th className="px-3 py-2 font-semibold">סופי</th>
                        <th className="px-3 py-2 font-semibold">עוגן</th>
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
          ) : null}

          {family ? (
            <section className="mb-8 border-2 border-dashed border-[var(--accent-raw)] bg-card p-4">
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
                          ? `בסיס ${shekel(simFit.base)} + ${(simFit.rate / 10000).toFixed(4)}₪/סמ״ר`
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
                          <th className="px-3 py-2 font-semibold">שם</th>
                          <th className="px-3 py-2 font-semibold">מידה</th>
                          <th className="px-3 py-2 font-semibold">מחיר נוכחי</th>
                          <th className="px-3 py-2 font-semibold">מחיר ניסוי</th>
                          <th className="px-3 py-2 font-semibold">עוגן ניסיוני</th>
                          <th className="px-3 py-2 font-semibold">הצעה מהעקומה</th>
                          <th className="px-3 py-2 font-semibold">פער %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredFamItems.map(({ p, w: iw, h: ih }, i) => {
                          const sug = simSuggestions.find((s) => s.p.id === p.id);
                          const pinned = simPin[p.id] ?? !!p.is_anchor;
                          const cur = p.final_price ?? p.senzey_price;
                          return (
                            <tr key={p.id} className={i % 2 ? "bg-[var(--surface-deep)]" : ""}>
                              <td className="px-3 py-1.5">{p.name}</td>
                              <td className="num px-3 py-1.5">
                                {iw && ih ? `${iw}×${ih}` : "—"}
                              </td>
                              <td className="num px-3 py-1.5">{shekel(cur)}</td>
                              <td className="px-3 py-1.5">
                                <input
                                  className="num w-24 border-b-2 border-[var(--ink)] bg-transparent px-1 py-0.5 outline-none focus:border-[var(--accent-raw)]"
                                  value={simPrice[p.id] ?? ""}
                                  placeholder={cur != null ? String(cur) : "—"}
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
                                {sug ? shekel(sug.suggested) : "—"}
                              </td>
                              <td
                                className={`num px-3 py-1.5 font-bold ${
                                  sug?.diff == null
                                    ? ""
                                    : Math.abs(sug.diff) > 20
                                      ? "text-[oklch(0.5_0.2_25)]"
                                      : Math.abs(sug.diff) > 5
                                        ? "text-[oklch(0.55_0.16_70)]"
                                        : "text-muted-foreground"
                                }`}
                              >
                                {sug?.diff == null ? "—" : `${sug.diff > 0 ? "+" : ""}${sug.diff.toFixed(0)}%`}
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
          ) : null}

          {family ? (
            <CurveChart
              anchors={simOn ? simBuild.anchors : anchors}
              dropped={simOn ? simBuild.dropped : dropped}
              fit={simOn ? simFit : fit}
              requestedArea={area}
              requestedPrice={simOn ? simCalc.unit : calc.unit}
              qty={nq}
              factor={qtyFactor(nq, c)}
            />
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
        </div>
      </div>
    </div>
  );
}
