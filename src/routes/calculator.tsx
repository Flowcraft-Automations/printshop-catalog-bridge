import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { familiesQuery, productsQuery } from "@/lib/queries";
import {
  buildAnchors,
  priceFromAnchors,
  shekel,
  type Family,
  type QtyDiscount,
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
  const [w, setW] = useState("100");
  const [h, setH] = useState("70");
  const [qty, setQty] = useState("1");

  const fam = families.find((f) => f.family === family);
  const nw = Number(w) || 0;
  const nh = Number(h) || 0;
  const nq = Math.max(1, Number(qty) || 1);
  const calc = computePrice(fam, nw, nh, nq);

  const similar = useMemo(() => {
    if (!fam || !calc.area) return [];
    return products
      .filter((p) => p.family === family && p.width_cm && p.height_cm)
      .map((p) => ({ p, area: (Number(p.width_cm) * Number(p.height_cm)) / 10000 }))
      .filter((x) => x.area >= calc.area * 0.75 && x.area <= calc.area * 1.25)
      .sort((a, b) => Math.abs(a.area - calc.area) - Math.abs(b.area - calc.area))
      .slice(0, 12);
  }, [products, family, fam, calc.area]);

  return (
    <div>
      <PageTitle title="מחשבון מידות" sub="חישוב מחיר לפי עקומת התמחור של המשפחה" />

      <div className="grid gap-5 lg:grid-cols-[380px_1fr]">
        <div className="border-2 border-[var(--ink)] bg-card p-5 shadow-[6px_6px_0_0_var(--ink)]">
          <label className="mb-1 block text-xs font-bold text-muted-foreground">משפחה</label>
          <select className={inputCls} value={family} onChange={(e) => setFamily(e.target.value)}>
            <option value="">— בחר משפחה —</option>
            {families.map((f) => (
              <option key={f.family} value={f.family}>
                {f.family}
              </option>
            ))}
          </select>

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
              <div className="mt-4 space-y-1 border-s-4 border-[var(--accent-raw)] ps-3 font-mono text-[12px] text-muted-foreground">
                <div>שטח = {nw}×{nh}/10000 = {calc.area.toFixed(4)} מ״ר</div>
                <div>
                  תעריף {fam.rate_m2 ?? 0}₪/מ״ר × שטח = {calc.raw.toFixed(2)}₪
                </div>
                <div>מינימום {fam.min_charge ?? 0}₪ → {calc.beforeDiscount.toFixed(2)}₪</div>
                <div>
                  הנחת כמות ×{calc.mult}
                  {calc.tier ? ` (מ־${calc.tier.min} יח׳)` : " (אין)"}
                </div>
                <div>עיגול ליחידה = {calc.unit}₪ · × {nq} = {calc.total}₪</div>
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

          <FamilyAdmin families={families} />
        </div>
      </div>
    </div>
  );
}

function FamilyAdmin({ families }: { families: Family[] }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (row: Family) => {
      const { error } = await supabase
        .from("families")
        .update({
          rate_m2: row.rate_m2,
          min_charge: row.min_charge,
          qty_discounts: row.qty_discounts ?? [],
          notes: row.notes,
        })
        .eq("family", row.family);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["families"] });
      toast.success("עקומת התמחור עודכנה");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-10">
      <h2 className="mb-1 text-lg font-black">ניהול עקומות תמחור</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        תעריף למ״ר, מחיר מינימום והנחות כמות (פורמט: 10:0.85, 20:0.75)
      </p>
      <div className="overflow-x-auto border-2 border-[var(--ink)] bg-card">
        <table className="w-full text-sm">
          <thead className="bg-[var(--ink)] text-white">
            <tr className="text-right">
              <th className="px-3 py-2 font-semibold">משפחה</th>
              <th className="px-3 py-2 font-semibold">₪/מ״ר</th>
              <th className="px-3 py-2 font-semibold">מינימום</th>
              <th className="px-3 py-2 font-semibold">הנחות כמות</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {families.map((f, i) => (
              <FamilyRow key={f.family} f={f} odd={i % 2 === 1} onSave={(r) => save.mutate(r)} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function tiersToText(t: QtyDiscount[] | null) {
  return (t ?? []).map((x) => `${x.min}:${x.mult}`).join(", ");
}
function textToTiers(s: string): QtyDiscount[] {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => {
      const [min, mult] = x.split(":");
      return { min: Number(min), mult: Number(mult) };
    })
    .filter((x) => !Number.isNaN(x.min) && !Number.isNaN(x.mult));
}

function FamilyRow({
  f,
  odd,
  onSave,
}: {
  f: Family;
  odd: boolean;
  onSave: (row: Family) => void;
}) {
  const [rate, setRate] = useState(f.rate_m2?.toString() ?? "");
  const [min, setMin] = useState(f.min_charge?.toString() ?? "");
  const [tiers, setTiers] = useState(tiersToText(f.qty_discounts));

  const cell = "num w-24 border-b border-dashed border-muted-foreground bg-transparent px-1 outline-none focus:border-[var(--accent-raw)]";

  return (
    <tr className={odd ? "bg-[var(--surface-deep)]" : ""}>
      <td className="px-3 py-1.5 font-semibold">{f.family}</td>
      <td className="px-3 py-1.5">
        <input className={cell} value={rate} onChange={(e) => setRate(e.target.value)} />
      </td>
      <td className="px-3 py-1.5">
        <input className={cell} value={min} onChange={(e) => setMin(e.target.value)} />
      </td>
      <td className="px-3 py-1.5">
        <input
          className={`${cell} w-44`}
          value={tiers}
          placeholder="10:0.85, 20:0.75"
          onChange={(e) => setTiers(e.target.value)}
        />
      </td>
      <td className="px-3 py-1.5">
        <button
          onClick={() =>
            onSave({
              ...f,
              rate_m2: rate === "" ? null : Number(rate),
              min_charge: min === "" ? null : Number(min),
              qty_discounts: textToTiers(tiers),
            })
          }
          className="border border-[var(--ink)] px-2 py-1 text-xs font-bold hover:bg-[oklch(0.93_0.05_250)]"
        >
          שמור
        </button>
      </td>
    </tr>
  );
}
