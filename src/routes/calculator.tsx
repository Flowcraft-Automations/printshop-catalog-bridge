import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Anchor as AnchorIcon } from "lucide-react";
import { PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { familiesQuery, productsQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_MARGIN,
  DEFAULT_ROUNDING,
  SHEET_W_CM,
  SHEET_H_CM,
  SHEET_GAP_CM,
  familyAnchors,
  isClosedOut,
  familyColor,
  priceJob,
  readFamilyPricing,
  sheetUnitsFor,
  sizeKey,
  shekel,
  slugify,
  writeFamilyPricing,
  type FamilyPricing,
} from "@/lib/mdvd";

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
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  width?: string;
  as?: "input" | "select";
  children?: React.ReactNode;
}) {
  return (
    <div className={width}>
      <label className={labelCls}>{label}</label>
      {as === "select" ? (
        <select className={`${inputCls} text-base`} value={value} onChange={(e) => onChange(e.target.value)}>
          {children}
        </select>
      ) : (
        <input className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

type Draft = {
  method: string;
  tw: string;
  th: string;
  cost: string;
  out: string;
  margin: string;
  rounding: string;
  packages: string;
  minUnitArea: string;
  qtyExponent: string;
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
  const [search, setSearch] = useState("");
  useEffect(() => {
    if (!family && families.length) setFamily(families[0]!.family);
  }, [families, family]);


  const fam = families.find((f) => f.family === family);
  const saved = useMemo(() => readFamilyPricing(fam), [fam]);

  const [draft, setDraft] = useState<Draft>({
    method: "area",
    tw: "",
    th: "",
    cost: "",
    out: "",
    margin: String(DEFAULT_MARGIN),
    rounding: String(DEFAULT_ROUNDING),
    packages: "",
    minUnitArea: "1",
    qtyExponent: "1",

  });
  const [sheetUnits, setSheetUnits] = useState<Record<string, number>>({});

  useEffect(() => {
    setDraft({
      method: saved.method,
      tw: saved.thresholdW ? String(saved.thresholdW) : "",
      th: saved.thresholdH ? String(saved.thresholdH) : "",
      cost: saved.cost ? String(saved.cost) : "",
      out: saved.outsourceCost ? String(saved.outsourceCost) : "",
      margin: String(saved.margin),
      rounding: String(saved.rounding),
      packages: saved.packages.join(", "),
      minUnitArea: String(saved.minUnitArea),
      qtyExponent: String(saved.qtyExponent),

    });
    setSheetUnits(saved.sheetUnits);
  }, [saved]);

  const cfg: FamilyPricing = useMemo(() => {
    const n = (s: string) => (Number(s) > 0 ? Number(s) : 0);
    return {
      method: draft.method === "sheet" ? "sheet" : "area",
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
      qtyExponent: n(draft.qtyExponent) || 1,
      sheetUnits,

    };
  }, [draft, sheetUnits]);

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
          pricing_config: writeFamilyPricing(cfg),
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
  useEffect(() => {
    if (cfg.packages.length) setQty(String(cfg.packages[0]));
    else setQty("1");
  }, [family, cfg.packages.length]);

  const nw = Number(w) || 0;
  const nh = Number(h) || 0;
  const nq = Math.max(1, Number(qty) || 1);
  const job = useMemo(() => priceJob(cfg, anchors, nw, nh, nq), [cfg, anchors, nw, nh, nq]);

  const inconsistent = job?.inconsistent ?? [];

  const packagePrices = useMemo(
    () =>
      cfg.packages.map((p) => ({ qty: p, job: priceJob(cfg, anchors, nw, nh, p) })),
    [cfg, anchors, nw, nh],
  );

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
      <div className="flex flex-wrap gap-2">
        {families.map((f) => (
          <button
            key={f.family}
            onClick={() => setFamily(f.family)}
            className="border-2 px-3 py-1 text-sm font-bold"
            style={
              family === f.family
                ? { background: familyColor(f.family), borderColor: familyColor(f.family), color: "#fff" }
                : { borderColor: familyColor(f.family), color: familyColor(f.family) }
            }
          >
            {f.family}
          </button>
        ))}
      </div>

      {/* calculator */}
      <section className="border-2 border-[var(--ink)] bg-card p-5 shadow-[4px_4px_0_var(--ink)]">
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
          </div>


          <div className="mr-auto text-left">
            {!nw || !nh ? (
              <div className="text-lg font-bold text-muted-foreground">הזינו מידות</div>
            ) : job ? (
              <>
                <div className="text-4xl font-black text-[var(--accent-raw)]">{shekel(job.total)}</div>
                <div className="text-xs text-muted-foreground">
                  {shekel(job.unit)} ליחידה · {job.label}
                </div>
              </>
            ) : null}
          </div>
        </div>

        {job && nw && nh ? (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div>{job.detail}</div>
            <div>
              עלות ייצור {shekel(job.cost)} · סף רווח {shekel(job.costFloorValue)}
              {job.above ? " · מעל הסף" : ""}
            </div>
            {job.belowCost ? (
              <div className="border-2 border-destructive px-2 py-1 font-bold text-destructive">
                מתחת לעלות — המחיר נמוך מ־{shekel(job.costFloorValue)}
              </div>
            ) : null}
            {!job.hasAnchors ? (
              <div className="font-bold text-destructive">אין עוגנים למשפחה — המחיר מחושב מהעלות</div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* family config — admin only */}
      {family && isAdmin ? (
        <section className="border-2 border-[var(--ink)] bg-card p-5 shadow-[4px_4px_0_var(--ink)]">
          <h2 className="mb-4 text-base font-black text-[var(--ink)]">תמחור משפחה — {family}</h2>

          <div className="flex flex-wrap items-end gap-6">
            <Field
              label="שיטת תמחור"
              value={draft.method}
              onChange={(v) => setDraft((p) => ({ ...p, method: v }))}
              width="w-48"
              as="select"
            >
              <option value="area">לפי מ״ר</option>
              <option value="sheet">לפי גיליון</option>
            </Field>
            <Field label='סף רוחב (ס"מ)' value={draft.tw} onChange={(v) => setDraft((p) => ({ ...p, tw: v }))} />
            <Field label='סף גובה (ס"מ)' value={draft.th} onChange={(v) => setDraft((p) => ({ ...p, th: v }))} />
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-6">
            {cfg.method === "area" ? (
              <>
                <Field
                  label="עלות ייצור ₪/מ״ר (מתחת לסף)"
                  value={draft.cost}
                  onChange={(v) => setDraft((p) => ({ ...p, cost: v }))}
                  width="w-44"
                />
                <Field
                  label="עלות מיקור חוץ ₪/מ״ר (מעל הסף)"
                  value={draft.out}
                  onChange={(v) => setDraft((p) => ({ ...p, out: v }))}
                  width="w-48"
                />
              </>
            ) : (
              <>
                <Field
                  label="עלות ייצור ₪ לגיליון"
                  value={draft.cost}
                  onChange={(v) => setDraft((p) => ({ ...p, cost: v }))}
                  width="w-40"
                />
                <Field
                  label="עלות חוץ ₪ למ״ר (מעל הסף)"
                  value={draft.out}
                  onChange={(v) => setDraft((p) => ({ ...p, out: v }))}
                  width="w-48"
                />
              </>
            )}
            <Field
              label="מקדם רווח (×)"
              value={draft.margin}
              onChange={(v) => setDraft((p) => ({ ...p, margin: v }))}
            />
            {cfg.method === "area" ? (
              <Field
                label="עיגול ₪"
                value={draft.rounding}
                onChange={(v) => setDraft((p) => ({ ...p, rounding: v }))}
              />
            ) : (
              <Field
                label="חבילות"
                value={draft.packages}
                onChange={(v) => setDraft((p) => ({ ...p, packages: v }))}
                width="w-56"
              />
            )}
            <Field
              label='מ״ר מינימלי ליחידה (מעל הסף)'
              value={draft.minUnitArea}
              onChange={(v) => setDraft((p) => ({ ...p, minUnitArea: v }))}
              width="w-44"
            />
            <Field
              label="מקדם כמות (חזקה)"
              value={draft.qtyExponent}
              onChange={(v) => setDraft((p) => ({ ...p, qtyExponent: v }))}
              width="w-40"
            />
          </div>
          <div className="mt-2 text-[11px] font-bold text-muted-foreground">
            מעל הסף המחיר מחושב לכל יחידה: עלות למ״ר × מ״ר ליחידה (לפחות המינימום) × כמות^מקדם כמות × מקדם רווח.
            מקדם כמות 1 = ליניארי, קטן מ-1 = הנחת כמות.
          </div>


          {/* catalog items of the family — ⚓ marks the ones that drive the curve */}
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div className="text-xs font-bold text-muted-foreground">
              {cfg.method === "area"
                ? "פריטי המשפחה — לחצו ⚓ כדי לסמן/לבטל עוגן · בין העוגנים המחיר מחושב לפי מ״ר · מעל הסף: עלות חוץ × מ״ר × מקדם"
                : `פריטי המשפחה — לחצו ⚓ כדי לסמן/לבטל עוגן · יחידות בגיליון: אוטומטי (${SHEET_W_CM}×${SHEET_H_CM}, רווח ${SHEET_GAP_CM}), ניתן לעריכה`}
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

          <div className="mt-2 max-h-[26rem] overflow-y-auto">
          <table className="w-full">

            <thead className="sticky top-0 bg-background">
              <tr className="border-b-2 border-[var(--ink)] text-[11px] text-muted-foreground">
                <th className="w-10 p-2 text-right font-medium">⚓</th>
                <th className="p-2 text-right font-medium">מידה</th>
                {cfg.method === "sheet" ? (
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
                        className={a.isAnchor ? "text-[var(--ink)]" : "text-muted-foreground/50"}
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
                      {bad ? (
                        <span className="mr-2 text-xs font-normal text-destructive">
                          עוגן לא עקבי
                        </span>
                      ) : null}
                    </td>
                    {cfg.method === "sheet" ? (
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
                            upsertAnchor.mutate({ id: a.id, w: a.w, h: a.h, qty: a.qty, price: v });
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
                {cfg.method === "sheet" ? (
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
              onClick={() => saveCfg.mutate()}
              disabled={saveCfg.isPending}
              className="border-2 border-[var(--ink)] bg-[var(--ink)] px-6 py-1 text-sm font-bold text-white"
            >
              שמור
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
