import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, ExternalLink, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { familiesQuery, productHistoryQuery, productsQuery } from "@/lib/queries";
import {
  FIELD_LABEL,
  STATUSES,
  STATUS_CLASS,
  STATUS_LABEL,
  displayFieldValue,
  parseFieldValue,
  shekel,
  type Product,
  type ProductHistory,
} from "@/lib/mdvd";

type Search = {
  family?: string | undefined;
  senzey_group?: string | undefined;
  site_category?: string | undefined;
};

export const Route = createFileRoute("/catalog")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    family: typeof s['family'] === "string" ? (s['family'] as string) : undefined,
    senzey_group: typeof s['senzey_group'] === "string" ? (s['senzey_group'] as string) : undefined,
    site_category:
      typeof s['site_category'] === "string" ? (s['site_category'] as string) : undefined,
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

const EMPTY = "__empty__";

function Catalog() {
  const {
    family: familyParam,
    senzey_group: groupParam,
    site_category: categoryParam,
  } = Route.useSearch();
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
  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyProposed, setOnlyProposed] = useState(false);
  const [group, setGroup] = useState(groupParam ?? "");
  const [category, setCategory] = useState(categoryParam ?? "");
  const [presence, setPresence] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<Product | null>(null);
  const [limit, setLimit] = useState(200);

  const groupOptions = useMemo(
    () => [...new Set(products.map((p) => (p.senzey_group ?? "").trim()).filter(Boolean))].sort(),
    [products],
  );
  const categoryOptions = useMemo(
    () => [...new Set(products.map((p) => (p.site_category ?? "").trim()).filter(Boolean))].sort(),
    [products],
  );

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
      qc.invalidateQueries({ queryKey: ["product-history"] });
      toast.success("עודכן");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    return products.filter((p) => {
      const g = (p.senzey_group ?? "").trim();
      const c = (p.site_category ?? "").trim();
      if (q && !p.name.toLowerCase().includes(q.toLowerCase())) return false;
      if (family && (p.family ?? "") !== family) return false;
      if (senzeyStatus && p.senzey_status !== senzeyStatus) return false;
      if (siteStatus && p.site_status !== siteStatus) return false;
      if (onlyAnomaly && !(p.anomaly ?? "").trim()) return false;
      if (onlyGap && !(p.notes ?? "").includes("פער מחיר")) return false;
      if (onlyDup && !((p.senzey_dup_count ?? 0) > 1)) return false;
      if (onlyNew && p.source !== "approved_new") return false;
      if (onlyProposed && p.proposed_price == null) return false;
      if (group && (group === EMPTY ? g !== "" : g !== group)) return false;
      if (category && (category === EMPTY ? c !== "" : c !== category)) return false;
      if (presence === "both" && !(p.site_exists && p.senzey_exists)) return false;
      if (presence === "site" && !(p.site_exists && !p.senzey_exists)) return false;
      if (presence === "senzey" && !(p.senzey_exists && !p.site_exists)) return false;
      return true;
    });
  }, [
    products,
    q,
    family,
    senzeyStatus,
    siteStatus,
    onlyAnomaly,
    onlyGap,
    onlyDup,
    onlyNew,
    onlyProposed,
    group,
    category,
    presence,
  ]);


  const visible = rows.slice(0, limit);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function exportRows(kind: "xlsx" | "csv") {
    if (!rows.length) {
      toast.error("אין שורות לייצוא");
      return;
    }
    const data = rows.map((p) => ({
      "שם": p.name,
      "מפתח": p.row_key,
      "משפחה": p.family ?? "",
      "רוחב": p.width_cm ?? "",
      "גובה": p.height_cm ?? "",
      "כמות": p.qty ?? "",
      "קיים בסנזיי": p.senzey_exists ? "כן" : "לא",
      "מזהי סנזיי": p.senzey_ids ?? "",
      "מחיר סנזיי": p.senzey_price ?? "",
      "כפילויות סנזיי": p.senzey_dup_count ?? 0,
      "קיים באתר": p.site_exists ? "כן" : "לא",
      "קישור": p.site_url ?? "",
      "מחיר אתר": p.site_price ?? "",
      "מחיר סופי": p.final_price ?? "",
      "סטטוס סנזיי": STATUS_LABEL[p.senzey_status] ?? p.senzey_status,
      "סטטוס אתר": STATUS_LABEL[p.site_status] ?? p.site_status,
      "אומת": p.verified ? "כן" : "לא",
      "חריגה": p.anomaly ?? "",
      "הערות": p.notes ?? "",
      "קבוצה בסנזיי": p.senzey_group ?? "",
      "קטגוריה באתר": p.site_category ?? "",
      "מחיר מתחרה": p.competitor_price ?? "",
      "מקור מחיר מתחרה": p.competitor_ref ?? "",
      "מחיר מוצע": p.proposed_price ?? "",
      "מקור": p.source ?? "",
    }));
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.json_to_sheet(data);
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "csv") {
      const csv = "\uFEFF" + XLSX.utils.sheet_to_csv(ws);
      const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `mdvd-catalog-${stamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "catalog");
      XLSX.writeFile(wb, `mdvd-catalog-${stamp}.xlsx`);
    }
    toast.success(`יוצאו ${rows.length} שורות`);
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="קטלוג" sub={`${rows.length.toLocaleString("he-IL")} פריטים תואמים`} />
        <div className="mb-6 flex items-center gap-2">
          <button
            onClick={() => exportRows("xlsx")}
            className="flex items-center gap-1.5 border-2 border-[var(--ink)] px-3 py-1.5 text-sm font-bold hover:bg-[var(--surface-deep)]"
          >
            <Download className="size-4" /> אקסל
          </button>
          <button
            onClick={() => exportRows("csv")}
            className="flex items-center gap-1.5 border-2 border-[var(--ink)] px-3 py-1.5 text-sm font-bold hover:bg-[var(--surface-deep)]"
          >
            <Download className="size-4" /> CSV
          </button>
          <Link
            to="/new-product"
            className="bg-[var(--accent-raw)] px-4 py-2 text-sm font-bold text-white"
          >
            + מוצר חדש
          </Link>
        </div>
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
        <select value={group} onChange={(e) => setGroup(e.target.value)} className={inputCls}>
          <option value="">קבוצה בסנזיי: הכל</option>
          <option value={EMPTY}>— ללא קבוצה —</option>
          {groupOptions.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
          <option value="">קטגוריה באתר: הכל</option>
          <option value={EMPTY}>— ללא קטגוריה —</option>
          {categoryOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-sm font-semibold">
          <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />
          מוצרים חדשים מאושרים
        </label>
        <label className="flex items-center gap-1 text-sm font-semibold">
          <input
            type="checkbox"
            checked={onlyProposed}
            onChange={(e) => setOnlyProposed(e.target.checked)}
          />
          יש מחיר מוצע
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
                <th className="hidden px-3 py-2 font-semibold lg:table-cell">קבוצה בסנזיי</th>
                <th className="hidden px-3 py-2 font-semibold lg:table-cell">קטגוריה באתר</th>
                <th className="px-3 py-2 font-semibold">מידה</th>
                <th className="px-3 py-2 font-semibold">כמות</th>
                <th className="px-3 py-2 font-semibold">סנזיי</th>
                <th className="px-3 py-2 font-semibold">אתר</th>
                <th className="px-3 py-2 font-semibold">מחיר סופי</th>
                <th className="px-3 py-2 font-semibold">מחיר מתחרה</th>
                <th className="px-3 py-2 font-semibold">מחיר מוצע</th>
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
                  <td
                    className="hidden max-w-[140px] truncate px-3 py-1 text-muted-foreground lg:table-cell"
                    title={p.senzey_group ?? ""}
                  >
                    {p.senzey_group?.trim() || "—"}
                  </td>
                  <td
                    className="hidden max-w-[140px] truncate px-3 py-1 text-muted-foreground lg:table-cell"
                    title={p.site_category ?? ""}
                  >
                    {p.site_category?.trim() || "—"}
                  </td>
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
                  <td className="num whitespace-nowrap px-3 py-1">
                    {shekel(p.competitor_price)}
                    {p.competitor_ref?.trim() && (
                      <Info
                        className="ms-1 inline size-3.5 text-muted-foreground"
                        aria-label={p.competitor_ref}
                      >
                        <title>{p.competitor_ref}</title>
                      </Info>
                    )}
                  </td>
                  <td className="num whitespace-nowrap px-3 py-1" onClick={(e) => e.stopPropagation()}>
                    {shekel(p.proposed_price)}
                    {p.proposed_price != null && p.final_price == null && (
                      <button
                        onClick={() =>
                          update.mutate({
                            ids: [p.id],
                            patch: { final_price: p.proposed_price ?? null },
                          })
                        }
                        className="ms-2 border border-[var(--accent-raw)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--accent-raw)] hover:bg-[oklch(0.95_0.03_250)]"
                      >
                        אמץ
                      </button>
                    )}
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
                  <td className="px-3 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={!!p.verified}
                      title={p.verified_at ? new Date(p.verified_at).toLocaleString("he-IL") : "סמן כנבדק"}
                      onChange={(e) =>
                        update.mutate({
                          ids: [p.id],
                          patch: {
                            verified: e.target.checked,
                            verified_at: e.target.checked ? new Date().toISOString() : null,
                          },
                        })
                      }
                      className="size-4 accent-[var(--accent-raw)]"
                    />
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
        <HistoryPanel productId={product.id} />
      </aside>
    </div>
  );
}

function HistoryPanel({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data: history = [], isLoading } = useQuery(productHistoryQuery(productId));

  const revert = useMutation({
    mutationFn: async (entries: ProductHistory[]) => {
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      for (const e of entries) patch[e.field] = parseFieldValue(e.field, e.old_value);
      const { error } = await supabase
        .from("products")
        .update(patch as never)
        .eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product-history"] });
      toast.success("שוחזר");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const batches = useMemo(() => {
    const map = new Map<string, ProductHistory[]>();
    for (const h of history) {
      const arr = map.get(h.batch_id);
      if (arr) arr.push(h);
      else map.set(h.batch_id, [h]);
    }
    return [...map.values()];
  }, [history]);

  return (
    <section className="mt-8 border-t-2 border-[var(--ink)] pt-4">
      <h3 className="mb-3 text-sm font-black tracking-wide">היסטוריית שינויים</h3>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">טוען…</p>
      ) : batches.length === 0 ? (
        <p className="text-xs text-muted-foreground">אין שינויים מתועדים לפריט זה.</p>
      ) : (
        <ol className="space-y-3">
          {batches.map((entries) => {
            const first = entries[0]!;
            return (
              <li key={first.batch_id} className="border-s-4 border-[var(--accent-raw)] bg-[var(--surface-deep)] p-3">
                <div className="mb-2 flex items-center justify-between gap-2 text-[11px] font-bold text-muted-foreground">
                  <span>
                    {new Date(first.changed_at).toLocaleString("he-IL")}
                    {first.source && first.source !== "manual" ? ` · ${first.source}` : ""}
                  </span>
                  {entries.length > 1 && (
                    <button
                      onClick={() => revert.mutate(entries)}
                      disabled={revert.isPending}
                      className="flex items-center gap-1 underline"
                    >
                      <RotateCcw className="size-3" /> שחזר את כל השינוי
                    </button>
                  )}
                </div>
                <ul className="space-y-1 text-xs">
                  {entries.map((e) => (
                    <li key={e.id} className="flex items-center gap-2">
                      <b className="min-w-24">{FIELD_LABEL[e.field] ?? e.field}</b>
                      <span className="text-muted-foreground line-through">
                        {displayFieldValue(e.field, e.old_value)}
                      </span>
                      <span>←</span>
                      <span className="font-semibold">{displayFieldValue(e.field, e.new_value)}</span>
                      <button
                        onClick={() => revert.mutate([e])}
                        disabled={revert.isPending}
                        className="ms-auto flex items-center gap-1 text-[var(--accent-raw)] underline"
                      >
                        <RotateCcw className="size-3" /> שחזר
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </section>
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
