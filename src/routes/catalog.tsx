import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { familiesQuery, productsQuery } from "@/lib/queries";
import { STATUSES, STATUS_CLASS, STATUS_LABEL, shekel, type Product } from "@/lib/mdvd";

type Search = { family?: string | undefined };

export const Route = createFileRoute("/catalog")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    family: typeof s['family'] === "string" ? (s['family'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "קטלוג מוצרים — קונסולת MDVD" },
      { name: "description", content: "טבלת כל המוצרים עם מחירים, סטטוסים וחריגות." },
      { property: "og:title", content: "קטלוג מוצרים — קונסולת MDVD" },
      { property: "og:description", content: "טבלת כל המוצרים עם מחירים וסטטוסים." },
    ],
  }),
  component: Catalog,
});

const inputCls =
  "border-b-2 border-[var(--ink)] bg-transparent px-2 py-1 text-sm outline-none focus:border-[var(--accent-raw)]";

function StatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      className={`border px-2 py-0.5 text-xs font-bold ${STATUS_CLASS[value] ?? ""}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}

function Catalog() {
  const { family: familyParam } = Route.useSearch();
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery(productsQuery());
  const { data: families = [] } = useQuery(familiesQuery());

  const [q, setQ] = useState("");
  const [family, setFamily] = useState(familyParam ?? "");
  const [senzeyStatus, setSenzeyStatus] = useState("");
  const [siteStatus, setSiteStatus] = useState("");
  const [onlyAnomaly, setOnlyAnomaly] = useState(false);
  const [onlyGap, setOnlyGap] = useState(false);
  const [onlyDup, setOnlyDup] = useState(false);
  const [presence, setPresence] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<Product | null>(null);
  const [limit, setLimit] = useState(200);

  const update = useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<Product> }) => {
      const { error } = await supabase
        .from("products")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("עודכן");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (family && (p.family ?? "") !== family) return false;
      if (senzeyStatus && p.senzey_status !== senzeyStatus) return false;
      if (siteStatus && p.site_status !== siteStatus) return false;
      if (onlyAnomaly && !(p.anomaly ?? "").trim()) return false;
      if (onlyGap && !(p.notes ?? "").includes("פער מחיר")) return false;
      if (onlyDup && !((p.senzey_dup_count ?? 0) > 1)) return false;
      if (presence === "both" && !(p.site_exists && p.senzey_exists)) return false;
      if (presence === "site" && !(p.site_exists && !p.senzey_exists)) return false;
      if (presence === "senzey" && !(p.senzey_exists && !p.site_exists)) return false;
      return true;
    });
  }, [products, q, family, senzeyStatus, siteStatus, onlyAnomaly, onlyGap, onlyDup, presence]);

  const visible = rows.slice(0, limit);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="קטלוג" sub={`${rows.length.toLocaleString("he-IL")} פריטים תואמים`} />
        <Link
          to="/new-product"
          className="mb-6 bg-[var(--accent-raw)] px-4 py-2 text-sm font-bold text-white"
        >
          + מוצר חדש
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3 border-2 border-[var(--ink)] bg-card p-3">
        <input
          placeholder="חיפוש לפי שם…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className={`${inputCls} min-w-[220px] flex-1`}
        />
        <select value={family} onChange={(e) => setFamily(e.target.value)} className={inputCls}>
          <option value="">כל המשפחות</option>
          {families.map((f) => (
            <option key={f.family} value={f.family}>
              {f.family}
            </option>
          ))}
        </select>
        <select
          value={senzeyStatus}
          onChange={(e) => setSenzeyStatus(e.target.value)}
          className={inputCls}
        >
          <option value="">סטטוס סנזיי: הכל</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select
          value={siteStatus}
          onChange={(e) => setSiteStatus(e.target.value)}
          className={inputCls}
        >
          <option value="">סטטוס אתר: הכל</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <select value={presence} onChange={(e) => setPresence(e.target.value)} className={inputCls}>
          <option value="">נוכחות: הכל</option>
          <option value="both">בשתי המערכות</option>
          <option value="site">רק אתר</option>
          <option value="senzey">רק סנזיי</option>
        </select>
        <label className="flex items-center gap-1 text-sm font-semibold">
          <input
            type="checkbox"
            checked={onlyAnomaly}
            onChange={(e) => setOnlyAnomaly(e.target.checked)}
          />
          רק חריגות
        </label>
        <label className="flex items-center gap-1 text-sm font-semibold">
          <input type="checkbox" checked={onlyGap} onChange={(e) => setOnlyGap(e.target.checked)} />
          רק פערי מחיר
        </label>
        <label className="flex items-center gap-1 text-sm font-semibold">
          <input type="checkbox" checked={onlyDup} onChange={(e) => setOnlyDup(e.target.checked)} />
          רק כפילויות
        </label>
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3 border-2 border-[var(--accent-raw)] bg-[oklch(0.95_0.03_250)] p-3 text-sm">
          <b>{selected.size} נבחרו</b>
          <span>שינוי סטטוס סנזיי:</span>
          <select
            className={inputCls}
            defaultValue=""
            onChange={(e) =>
              e.target.value &&
              update.mutate({ ids: [...selected], patch: { senzey_status: e.target.value } })
            }
          >
            <option value="">—</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <span>שינוי סטטוס אתר:</span>
          <select
            className={inputCls}
            defaultValue=""
            onChange={(e) =>
              e.target.value &&
              update.mutate({ ids: [...selected], patch: { site_status: e.target.value } })
            }
          >
            <option value="">—</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
          <button onClick={() => setSelected(new Set())} className="ms-auto underline">
            ניקוי בחירה
          </button>
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">טוען…</p>
      ) : (
        <div className="overflow-x-auto border-2 border-[var(--ink)] bg-card">
          <table className="w-full text-sm">
            <thead className="bg-[var(--ink)] text-white">
              <tr className="text-right">
                <th className="w-8 px-2 py-2"></th>
                <th className="px-3 py-2 font-semibold">שם</th>
                <th className="px-3 py-2 font-semibold">משפחה</th>
                <th className="px-3 py-2 font-semibold">מידה</th>
                <th className="px-3 py-2 font-semibold">כמות</th>
                <th className="px-3 py-2 font-semibold">סנזיי</th>
                <th className="px-3 py-2 font-semibold">אתר</th>
                <th className="px-3 py-2 font-semibold">מחיר סופי</th>
                <th className="px-3 py-2 font-semibold">סט׳ סנזיי</th>
                <th className="px-3 py-2 font-semibold">סט׳ אתר</th>
                <th className="px-3 py-2 font-semibold">קישור</th>
                <th className="px-3 py-2 font-semibold">סימונים</th>
                <th className="px-3 py-2 text-center font-semibold">אומת</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((p, i) => (
                <tr
                  key={p.id}
                  onClick={() => setDrawer(p)}
                  className={`cursor-pointer border-t border-border hover:bg-[oklch(0.95_0.03_250)] ${
                    i % 2 ? "bg-[var(--surface-deep)]" : ""
                  }`}
                >
                  <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                  </td>
                  <td className="max-w-[320px] truncate px-3 py-1 font-semibold">{p.name}</td>
                  <td className="px-3 py-1 text-muted-foreground">{p.family ?? "—"}</td>
                  <td className="num px-3 py-1">
                    {p.width_cm && p.height_cm ? `${p.width_cm}×${p.height_cm}` : "—"}
                  </td>
                  <td className="num px-3 py-1">{p.qty ?? 1}</td>
                  <td className="num px-3 py-1">{shekel(p.senzey_price)}</td>
                  <td className="num px-3 py-1">{shekel(p.site_price)}</td>
                  <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      defaultValue={p.final_price ?? ""}
                      key={`fp-${p.id}-${p.final_price}`}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        const num = v === "" ? null : Number(v);
                        if (num !== (p.final_price ?? null))
                          update.mutate({ ids: [p.id], patch: { final_price: num } });
                      }}
                      className="num w-20 border-b border-dashed border-muted-foreground bg-transparent px-1 outline-none focus:border-solid focus:border-[var(--accent-raw)]"
                    />
                  </td>
                  <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                    <StatusSelect
                      value={p.senzey_status}
                      onChange={(v) => update.mutate({ ids: [p.id], patch: { senzey_status: v } })}
                    />
                  </td>
                  <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                    <StatusSelect
                      value={p.site_status}
                      onChange={(v) => update.mutate({ ids: [p.id], patch: { site_status: v } })}
                    />
                  </td>
                  <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                    {p.site_url ? (
                      <a href={p.site_url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-4 text-[var(--accent-raw)]" />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1">
                    {p.anomaly && (
                      <span
                        title={p.anomaly}
                        className="me-1 border border-destructive bg-[oklch(0.95_0.05_25)] px-1.5 py-0.5 text-[11px] font-bold text-destructive"
                      >
                        חריגה
                      </span>
                    )}
                    {(p.senzey_dup_count ?? 0) > 1 && (
                      <span className="border border-[oklch(0.6_0.14_50)] bg-[oklch(0.95_0.05_60)] px-1.5 py-0.5 text-[11px] font-bold text-[oklch(0.45_0.14_50)]">
                        כפילות ×{p.senzey_dup_count}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > visible.length && (
            <button
              onClick={() => setLimit((l) => l + 300)}
              className="w-full border-t-2 border-[var(--ink)] bg-[var(--surface-deep)] py-3 text-sm font-bold"
            >
              הצג עוד ({rows.length - visible.length} נותרו)
            </button>
          )}
        </div>
      )}

      {drawer && (
        <EditDrawer
          product={drawer}
          onClose={() => setDrawer(null)}
          onSave={(patch) => {
            update.mutate({ ids: [drawer.id], patch });
            setDrawer(null);
          }}
        />
      )}
    </div>
  );
}

function EditDrawer({
  product,
  onClose,
  onSave,
}: {
  product: Product;
  onClose: () => void;
  onSave: (patch: Partial<Product>) => void;
}) {
  const [f, setF] = useState<Product>(product);
  const set = (k: keyof Product, v: unknown) => setF((p) => ({ ...p, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/40" />
      <aside
        onClick={(e) => e.stopPropagation()}
        className="h-full w-full max-w-lg overflow-y-auto border-s-2 border-[var(--ink)] bg-card p-6"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="text-xl font-black">{product.name}</h2>
          <button onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="שם" full>
            <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field label="משפחה">
            <input
              className={inputCls}
              value={f.family ?? ""}
              onChange={(e) => set("family", e.target.value)}
            />
          </Field>
          <Field label="כמות">
            <input
              className={`${inputCls} num`}
              value={f.qty ?? ""}
              onChange={(e) => set("qty", num(e.target.value))}
            />
          </Field>
          <Field label="רוחב (ס״מ)">
            <input
              className={`${inputCls} num`}
              value={f.width_cm ?? ""}
              onChange={(e) => set("width_cm", num(e.target.value))}
            />
          </Field>
          <Field label="גובה (ס״מ)">
            <input
              className={`${inputCls} num`}
              value={f.height_cm ?? ""}
              onChange={(e) => set("height_cm", num(e.target.value))}
            />
          </Field>
          <Field label="מחיר סנזיי">
            <input
              className={`${inputCls} num`}
              value={f.senzey_price ?? ""}
              onChange={(e) => set("senzey_price", num(e.target.value))}
            />
          </Field>
          <Field label="מחיר אתר">
            <input
              className={`${inputCls} num`}
              value={f.site_price ?? ""}
              onChange={(e) => set("site_price", num(e.target.value))}
            />
          </Field>
          <Field label="מחיר סופי">
            <input
              className={`${inputCls} num`}
              value={f.final_price ?? ""}
              onChange={(e) => set("final_price", num(e.target.value))}
            />
          </Field>
          <Field label="מזהי סנזיי">
            <input
              className={inputCls}
              value={f.senzey_ids ?? ""}
              onChange={(e) => set("senzey_ids", e.target.value)}
            />
          </Field>
          <Field label="מספר כפילויות סנזיי">
            <input
              className={`${inputCls} num`}
              value={f.senzey_dup_count ?? ""}
              onChange={(e) => set("senzey_dup_count", num(e.target.value))}
            />
          </Field>
          <Field label="סטטוס סנזיי">
            <StatusSelect value={f.senzey_status} onChange={(v) => set("senzey_status", v)} />
          </Field>
          <Field label="סטטוס אתר">
            <StatusSelect value={f.site_status} onChange={(v) => set("site_status", v)} />
          </Field>
          <Field label="קישור לאתר" full>
            <input
              className={inputCls}
              value={f.site_url ?? ""}
              onChange={(e) => set("site_url", e.target.value)}
            />
          </Field>
          <Field label="חריגה" full>
            <input
              className={inputCls}
              value={f.anomaly ?? ""}
              onChange={(e) => set("anomaly", e.target.value)}
            />
          </Field>
          <Field label="הערות" full>
            <textarea
              className={`${inputCls} min-h-20 w-full`}
              value={f.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </div>
        <button
          onClick={() =>
            onSave({
              name: f.name,
              family: f.family,
              width_cm: f.width_cm,
              height_cm: f.height_cm,
              qty: f.qty,
              senzey_price: f.senzey_price,
              site_price: f.site_price,
              final_price: f.final_price,
              senzey_ids: f.senzey_ids,
              senzey_dup_count: f.senzey_dup_count,
              senzey_status: f.senzey_status,
              site_status: f.site_status,
              site_url: f.site_url,
              anomaly: f.anomaly,
              notes: f.notes,
            })
          }
          className="mt-6 w-full bg-[var(--accent-raw)] py-3 font-bold text-white"
        >
          שמירה
        </button>
      </aside>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="mb-1 text-xs font-bold text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
