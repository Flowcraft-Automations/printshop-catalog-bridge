import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { PageTitle } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/import")({
  head: () => ({
    meta: [
      { title: "ייבוא נתונים — קונסולת MDVD" },
      { name: "description", content: "העלאת קובץ אקסל עם גיליונות מוצרים ומשפחות." },
      { property: "og:title", content: "ייבוא נתונים — קונסולת MDVD" },
      { property: "og:description", content: "ייבוא קטלוג מקובץ אקסל בלי לדרוס עבודה ידנית." },
    ],
  }),
  component: ImportPage,
});

type Row = Record<string, unknown>;

const PRODUCT_COLS = [
  "row_key",
  "name",
  "family",
  "width_cm",
  "height_cm",
  "qty",
  "senzey_exists",
  "senzey_ids",
  "senzey_price",
  "senzey_dup_count",
  "site_exists",
  "site_url",
  "site_price",
  "final_price",
  "senzey_status",
  "site_status",
  "notes",
  "source",

  "senzey_group",
  "site_category",
  "competitor_price",
  "competitor_ref",
  "proposed_price",
] as const;

// Never overwritten on existing rows — manual work is protected.
const PROTECTED = ["final_price", "senzey_status", "site_status", "notes"];

const num = (v: unknown) =>
  v === undefined || v === null || v === "" ? null : Number.isNaN(Number(v)) ? null : Number(v);
const str = (v: unknown) => (v === undefined || v === null || v === "" ? null : String(v).trim());
const text = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
const bool = (v: unknown) =>
  typeof v === "boolean" ? v : ["true", "1", "כן", "yes"].includes(String(v).trim().toLowerCase());

function normalizeProduct(r: Row) {
  return {
    row_key: str(r['row_key']) ?? str(r['name']) ?? "",
    name: str(r['name']) ?? "",
    family: str(r['family']),
    width_cm: num(r['width_cm']),
    height_cm: num(r['height_cm']),
    qty: num(r['qty']) ?? 1,
    senzey_exists: bool(r['senzey_exists']),
    senzey_ids: str(r['senzey_ids']),
    senzey_price: num(r['senzey_price']),
    senzey_dup_count: num(r['senzey_dup_count']) ?? 0,
    site_exists: bool(r['site_exists']),
    site_url: str(r['site_url']),
    site_price: num(r['site_price']),
    final_price: num(r['final_price']),
    senzey_status: str(r['senzey_status']) ?? "to_review",
    site_status: str(r['site_status']) ?? "to_review",
    notes: str(r['notes']),
    source: str(r['source']) ?? "import",

    senzey_group: text(r['senzey_group']),
    site_category: text(r['site_category']),
    competitor_price: num(r['competitor_price']),
    competitor_ref: text(r['competitor_ref']),
    proposed_price: num(r['proposed_price']),
  };
}

function normalizeFamily(r: Row) {
  return {
    family: str(r['family']) ?? "",
    items_count: num(r['items_count']),
    notes: str(r['notes']),
  };
}

async function fetchAllKeys(table: "products" | "families", col: "row_key" | "family") {
  const keys = new Set<string>();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase.from(table).select(col).range(from, from + page - 1);
    if (error) throw error;
    for (const r of data ?? []) keys.add((r as Record<string, string>)[col]!);
    if (!data || data.length < page) break;
  }
  return keys;
}

type Preview = {
  products: ReturnType<typeof normalizeProduct>[];
  families: ReturnType<typeof normalizeFamily>[];
  newProducts: number;
  updatedProducts: number;
  newFamilies: number;
  updatedFamilies: number;
};

function ImportPage() {
  const qc = useQueryClient();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function onFile(file: File) {
    setBusy(true);
    setResult(null);
    try {
      const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const psheet = wb.Sheets["products"];
      const fsheet = wb.Sheets["families"];
      if (!psheet || !fsheet) throw new Error('הקובץ חייב לכלול גיליונות "products" ו-"families"');

      const products = XLSX.utils
        .sheet_to_json<Row>(psheet, { defval: null })
        .map(normalizeProduct)
        .filter((p) => p.row_key && p.name);
      const families = XLSX.utils
        .sheet_to_json<Row>(fsheet, { defval: null })
        .map(normalizeFamily)
        .filter((f) => f.family);

      const pKeys = await fetchAllKeys("products", "row_key");
      const fKeys = await fetchAllKeys("families", "family");

      setPreview({
        products,
        families,
        newProducts: products.filter((p) => !pKeys.has(p.row_key)).length,
        updatedProducts: products.filter((p) => pKeys.has(p.row_key)).length,
        newFamilies: families.filter((f) => !fKeys.has(f.family)).length,
        updatedFamilies: families.filter((f) => fKeys.has(f.family)).length,
      });
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  async function commit() {
    if (!preview) return;
    setBusy(true);
    try {
      // families
      const fKeys = await fetchAllKeys("families", "family");
      const newFams = preview.families.filter((f) => !fKeys.has(f.family));
      if (newFams.length) {
        const { error } = await supabase.from("families").insert(newFams as never);
        if (error) throw error;
      }
      for (const f of preview.families.filter((x) => fKeys.has(x.family))) {
        const { error } = await supabase
          .from("families")
          .update({ items_count: f.items_count } as never)
          .eq("family", f.family);
        if (error) throw error;
      }

      // products
      const pKeys = await fetchAllKeys("products", "row_key");
      const inserts = preview.products.filter((p) => !pKeys.has(p.row_key));
      const updates = preview.products.filter((p) => pKeys.has(p.row_key));

      for (let i = 0; i < inserts.length; i += 500) {
        const { error } = await supabase
          .from("products")
          .insert(inserts.slice(i, i + 500) as never);
        if (error) throw error;
      }
      for (const p of updates) {
        const patch: Record<string, unknown> = {};
        for (const c of PRODUCT_COLS) {
          if (c === "row_key" || PROTECTED.includes(c)) continue;
          patch[c] = (p as Record<string, unknown>)[c];
        }
        patch['updated_at'] = new Date().toISOString();
        const { error } = await supabase
          .from("products")
          .update(patch as never)
          .eq("row_key", p.row_key);
        if (error) throw error;
      }

      qc.invalidateQueries();
      setResult(
        `הייבוא הושלם: ${inserts.length} מוצרים חדשים, ${updates.length} עודכנו · ${newFams.length} משפחות חדשות.`,
      );
      setPreview(null);
      toast.success("הייבוא הושלם");
    } catch (e) {
      toast.error((e as Error).message);
    }
    setBusy(false);
  }

  return (
    <div className="max-w-3xl">
      <PageTitle
        title="ייבוא נתונים"
        sub="קובץ .xlsx עם גיליונות products ו-families. עדכון קיימים לא דורס מחיר סופי, סטטוסים והערות."
      />

      <label className="block cursor-pointer border-2 border-dashed border-[var(--ink)] bg-card p-10 text-center hover:bg-[var(--surface-deep)]">
        <input
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <div className="text-lg font-black">גרור או בחר קובץ אקסל</div>
        <div className="mt-1 text-sm text-muted-foreground">
          {busy ? "מעבד…" : "נדרשים גיליונות: products, families"}
        </div>
      </label>

      {result && (
        <div className="mt-5 border-2 border-[oklch(0.5_0.12_155)] bg-[oklch(0.95_0.05_155)] p-4 font-semibold">
          {result}
        </div>
      )}

      {preview && (
        <div className="mt-6 border-2 border-[var(--ink)] bg-card p-5 shadow-[6px_6px_0_0_var(--ink)]">
          <h2 className="mb-4 text-lg font-black">תצוגה מקדימה</h2>
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <Stat label="מוצרים חדשים" v={preview.newProducts} />
            <Stat label="מוצרים לעדכון" v={preview.updatedProducts} />
            <Stat label="משפחות חדשות" v={preview.newFamilies} />
            <Stat label="משפחות לעדכון" v={preview.updatedFamilies} />
          </div>
          <div className="mt-5 flex gap-3">
            <button
              onClick={() => void commit()}
              disabled={busy}
              className="bg-[var(--accent-raw)] px-6 py-3 font-bold text-white disabled:opacity-50"
            >
              {busy ? "מייבא…" : "אישור וייבוא"}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="border-2 border-[var(--ink)] px-6 py-3 font-bold"
            >
              ביטול
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="num text-3xl font-black text-[var(--accent-raw)]">{v}</div>
      <div className="text-xs font-bold text-muted-foreground">{label}</div>
    </div>
  );
}
