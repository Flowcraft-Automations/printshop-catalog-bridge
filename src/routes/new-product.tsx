import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { familiesQuery } from "@/lib/queries";
import { slugify } from "@/lib/mdvd";

type Search = {
  name?: string | undefined;
  family?: string | undefined;
  width?: number | undefined;
  height?: number | undefined;
  qty?: number | undefined;
  price?: number | undefined;
};

const str = (v: unknown) => (typeof v === "string" && v ? v : undefined);
const nnum = (v: unknown) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

export const Route = createFileRoute("/new-product")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    name: str(s['name']),
    family: str(s['family']),
    width: nnum(s['width']),
    height: nnum(s['height']),
    qty: nnum(s['qty']),
    price: nnum(s['price']),
  }),
  head: () => ({
    meta: [
      { title: "הוספת מוצר חדש — קונסולת MDVD" },
      { name: "description", content: "יצירת מוצר חדש שיסומן להוספה בשתי המערכות." },
      { property: "og:title", content: "הוספת מוצר חדש — קונסולת MDVD" },
      { property: "og:description", content: "יצירת מוצר חדש להגירה." },
    ],
  }),
  component: NewProduct,
});

const inputCls =
  "w-full border-b-2 border-[var(--ink)] bg-transparent px-2 py-2 outline-none focus:border-[var(--accent-raw)]";

function NewProduct() {
  const s = Route.useSearch();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: families = [] } = useQuery(familiesQuery());

  const [name, setName] = useState(s.name ?? "");
  const [family, setFamily] = useState(s.family ?? "");
  const [width, setWidth] = useState(s.width?.toString() ?? "");
  const [height, setHeight] = useState(s.height?.toString() ?? "");
  const [qty, setQty] = useState(s.qty?.toString() ?? "1");
  const [price, setPrice] = useState(s.price?.toString() ?? "");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({
        row_key: `${slugify(name)}-${Date.now()}`,
        name,
        family: family || null,
        width_cm: width ? Number(width) : null,
        height_cm: height ? Number(height) : null,
        qty: qty ? Number(qty) : 1,
        final_price: price ? Number(price) : null,
        notes: notes || null,
        source: "manual",
        senzey_status: "to_add",
        site_status: "to_add",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("המוצר נוצר וסומן להוספה בשתי המערכות");
      nav({ to: "/migration" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-2xl">
      <PageTitle title="הוספת מוצר חדש" sub="המוצר ייווצר עם סטטוס «להוספה» בשתי המערכות" />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) {
            toast.error("חובה להזין שם מוצר");
            return;
          }
          create.mutate();
        }}
        className="space-y-5 border-2 border-[var(--ink)] bg-card p-6 shadow-[6px_6px_0_0_var(--ink)]"
      >
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">שם המוצר</label>
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">משפחה</label>
          <input
            className={inputCls}
            list="families-list"
            value={family}
            onChange={(e) => setFamily(e.target.value)}
            placeholder="בחר או הקלד חדש"
          />
          <datalist id="families-list">
            {families.map((f) => (
              <option key={f.family} value={f.family} />
            ))}
          </datalist>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">רוחב (ס״מ)</label>
            <input className={`${inputCls} num`} value={width} onChange={(e) => setWidth(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">גובה (ס״מ)</label>
            <input className={`${inputCls} num`} value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold text-muted-foreground">כמות</label>
            <input className={`${inputCls} num`} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">מחיר סופי (₪)</label>
          <input className={`${inputCls} num`} value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-muted-foreground">הערות</label>
          <textarea
            className={`${inputCls} min-h-24`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <button
          disabled={create.isPending}
          className="w-full bg-[var(--accent-raw)] py-3 font-bold text-white disabled:opacity-50"
        >
          {create.isPending ? "שומר…" : "שמירת מוצר"}
        </button>
      </form>
    </div>
  );
}
