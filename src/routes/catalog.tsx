import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Anchor, Columns, Copy, Download, ExternalLink, Info, MoreHorizontal, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageTitle } from "@/components/AppShell";
import { NoteIndicator } from "@/components/NoteIndicator";
import { NotesPanel } from "@/components/NotesPanel";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { businessConfigQuery, familiesQuery, productHistoryQuery, productNotesQuery, productsQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import {
  DEFAULT_OVERHEAD_FACTOR,
  autoStatusFromPrice,
  FIELD_LABEL,
  STATUSES,
  STATUS_CLASS,
  STATUS_LABEL,
  familyAnchors,
  readFamilyPricing,
  priceJob,
  displayFieldValue,
  familyColor,
  isClosedOut,
  parseFieldValue,
  priceGap,

  shekel,
  slugify,
  type Product,
  type ProductHistory,
  type ProductNote,
} from "@/lib/mdvd";




type Search = {
  families?: string | undefined;
  senzey_group?: string | undefined;
  site_category?: string | undefined;
};

function parseSearchFamilies(s: Record<string, unknown>): string[] {
  const raw = s['families'] ?? s['family'];
  if (typeof raw === "string" && raw.trim()) {
    return raw.split(",").map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

export const Route = createFileRoute("/catalog")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    families: parseSearchFamilies(s).join(",") || undefined,
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

function FamilyMultiPicker({
  selected,
  families,
  onChange,
}: {
  selected: Set<string>;
  families: { family: string }[];
  onChange: (s: Set<string>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const filtered = useMemo(() => {
    const qf = q.trim().toLowerCase();
    if (!qf) return families;
    return families.filter((f) => f.family.toLowerCase().includes(qf));
  }, [families, q]);

  const allSelected = families.length > 0 && families.every((f) => selected.has(f.family));

  function toggle(family: string) {
    const next = new Set(selected);
    if (next.has(family)) next.delete(family);
    else next.add(family);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(families.map((f) => f.family)));
  }

  function clearAll() {
    onChange(new Set());
  }

  const label = selected.size === 0
    ? "כל המשפחות"
    : selected.size === 1
      ? [...selected][0]
      : `${selected.size} משפחות נבחרו`;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 border-2 border-[var(--ink)] bg-card px-3 py-2 text-sm font-bold shadow-[2px_2px_0_0_var(--ink)] hover:bg-[var(--surface-deep)]"
      >
        {selected.size === 1 ? (
          <span
            className="inline-block size-3 shrink-0 rounded-full"
            style={{ background: familyColor([...selected][0]!) }}
          />
        ) : (
          <span className="inline-flex -space-x-1">
            {[...selected].slice(0, 3).map((f) => (
              <span
                key={f}
                className="inline-block size-3 rounded-full border border-card"
                style={{ background: familyColor(f) }}
              />
            ))}
          </span>
        )}
        <span className="truncate">{label}</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-72 border-2 border-[var(--ink)] bg-card shadow-[4px_4px_0_0_var(--ink)]">
          <div className="border-b border-[var(--ink)] p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש משפחה…"
              className="w-full border-b-2 border-[var(--ink)] bg-transparent px-1 py-1 text-sm outline-none focus:border-[var(--accent-raw)]"
            />
          </div>
          <div className="flex items-center justify-between border-b border-[var(--ink)] px-2 py-1.5 text-xs">
            <button type="button" onClick={selectAll} className="font-bold hover:underline">
              בחר הכל
            </button>
            <button type="button" onClick={clearAll} className="font-bold hover:underline">
              נקה הכל
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map((f) => {
              const color = familyColor(f.family);
              const isSelected = selected.has(f.family);
              return (
                <button
                  key={f.family}
                  type="button"
                  onClick={() => toggle(f.family)}
                  className={`flex w-full items-center gap-2 px-2 py-1.5 text-right text-sm hover:bg-[var(--surface-deep)] ${isSelected ? "bg-[var(--surface-deep)] font-bold" : ""}`}
                >
                  <input
                    type="checkbox"
                    readOnly
                    checked={isSelected}
                    className="pointer-events-none size-4 accent-[var(--accent-raw)]"
                  />
                  <span
                    className="inline-block size-3 shrink-0 rounded-full"
                    style={{ background: color }}
                  />
                  <span className="truncate">{f.family}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="px-2 py-2 text-sm text-muted-foreground">לא נמצאו משפחות</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


/** Zoho-style per-column matchers */
function matchText(value: string | null | undefined, expr: string) {
  const f = expr.trim();
  if (!f) return true;
  const v = (value ?? "").trim();
  if (f === "-" || f === "ריק") return v === "";
  if (f === "*") return v !== "";
  return v.toLowerCase().includes(f.toLowerCase());
}

function matchNum(value: number | null | undefined, expr: string) {
  const f = expr.trim();
  if (!f) return true;
  if (f === "-" || f === "ריק") return value == null;
  if (f === "*") return value != null;
  const range = f.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
  if (range) {
    if (value == null) return false;
    return value >= Number(range[1]) && value <= Number(range[2]);
  }
  const m = f.match(/^(>=|<=|>|<|=)?\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return true;
  if (value == null) return false;
  const n = Number(m[2]);
  switch (m[1]) {
    case ">":
      return value > n;
    case ">=":
      return value >= n;
    case "<":
      return value < n;
    case "<=":
      return value <= n;
    default:
      return value === n;
  }
}

type ColKey =
  | "senzey_ids"
  | "name"
  | "family"
  | "senzey_group"
  | "site_category"
  | "size"
  | "qty"
  | "senzey_price"
  | "site_price"
  | "price_gap"
  | "final_price"
  | "curve_price"
  | "curve_dev"
  | "cost_floor"
  | "outsource"
  | "competitor_price"
  | "proposed_price"
  | "senzey_status"
  | "site_status"
  | "site_url"
  | "notes"
  | "verified"
  | "is_anchor";


let NOTE_TEXT: Record<string, string> = {};
function noteTextOf(id: string) {
  return NOTE_TEXT[id] ?? "";
}


/** Curve suggestion per product id, filled by the catalog's per-family fit memo. */
export type CurveSuggestion = { suggested: number; current: number; dev: number };
let CURVE: Record<string, CurveSuggestion> = {};
function curveOf(id: string): CurveSuggestion | null {
  return CURVE[id] ?? null;
}

/** Per-product cost picture, filled by the catalog's cost memo. */
export type CostInfo = {
  area: number;
  directCost: number;
  ratePerM2: number;
  floor: number;
  hasCost: boolean;
  below: boolean;
  thresholdW: number | null;
  thresholdH: number | null;
  aboveThreshold: boolean;
  outsourceRate: number;
};
let COST: Record<string, CostInfo> = {};
function costOf(id: string): CostInfo | null {
  return COST[id] ?? null;
}

/** Price used as "current" when comparing against the fitted curve. */
export function currentPrice(p: Product): number | null {
  const v = p.final_price ?? p.senzey_price ?? p.site_price ?? null;
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const SORT_VALUE: Record<ColKey, (p: Product) => string | number | null> = {
  senzey_ids: (p) => p.senzey_ids ?? "",
  name: (p) => p.name,
  family: (p) => p.family ?? "",
  senzey_group: (p) => p.senzey_group ?? "",
  site_category: (p) => p.site_category ?? "",
  size: (p) => (p.width_cm ?? 0) * (p.height_cm ?? 0),
  qty: (p) => p.qty ?? 0,
  senzey_price: (p) => p.senzey_price,
  site_price: (p) => p.site_price,
  price_gap: (p) => priceGap(p),
  final_price: (p) => p.final_price,
  curve_price: (p) => curveOf(p.id)?.suggested ?? null,
  curve_dev: (p) => curveOf(p.id)?.dev ?? null,
  cost_floor: (p) => {
    const c = costOf(p.id);
    return c && c.hasCost ? c.floor : null;
  },
  outsource: (p) => (costOf(p.id)?.aboveThreshold ? 1 : 0),
  competitor_price: (p) => p.competitor_price ?? null,
  proposed_price: (p) => p.proposed_price ?? null,
  senzey_status: (p) => p.senzey_status,
  site_status: (p) => p.site_status,
  site_url: (p) => p.site_url ?? "",
  notes: (p) => noteTextOf(p.id),
  verified: (p) => (p.verified ? 1 : 0),
  is_anchor: (p) => (p.is_anchor ? 1 : 0),
};


const colInput =
  "w-full min-w-[64px] border border-white/30 bg-white/10 px-1.5 py-0.5 text-xs font-normal text-white placeholder:text-white/50 outline-none focus:border-white";

function Catalog() {
  const {
    families: familiesParam,
    senzey_group: groupParam,
    site_category: categoryParam,
  } = Route.useSearch();
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery(productsQuery());
  const { data: allNotes = [] } = useQuery(productNotesQuery());
  const { data: families = [] } = useQuery(familiesQuery());
  const { data: bizCfg } = useQuery(businessConfigQuery());


  const notesByProduct = useMemo(() => {
    const map: Record<string, ProductNote[]> = {};
    const text: Record<string, string> = {};
    for (const n of allNotes) {
      (map[n.product_id] ??= []).push(n);
      text[n.product_id] = `${text[n.product_id] ?? ""} ${n.body}`.trim();
    }
    NOTE_TEXT = text;
    return map;
  }, [allNotes]);

  // Anchor engine → a suggested price for every sized item, plus its cost line.
  const engineByFamily = useMemo(() => {
    const out: Record<string, { cfg: ReturnType<typeof readFamilyPricing>; anchors: ReturnType<typeof familyAnchors> }> = {};
    for (const f of families) {
      out[f.family] = { cfg: readFamilyPricing(f), anchors: familyAnchors(products, f.family) };
    }
    return out;
  }, [families, products]);

  const curveByProduct = useMemo(() => {
    const out: Record<string, CurveSuggestion> = {};
    for (const p of products) {
      const e = engineByFamily[(p.family ?? "").trim()];
      const w = Number(p.width_cm);
      const h = Number(p.height_cm);
      const cur = currentPrice(p);
      if (!e || !w || !h || cur === null) continue;
      if (p.is_anchor) {
        out[p.id] = { suggested: cur, current: cur, dev: 0 };
        continue;
      }
      const job = priceJob(e.cfg, e.anchors, w, h, Math.max(1, Number(p.qty) || 1));
      if (!job || job.total <= 0) continue;
      out[p.id] = { suggested: job.total, current: cur, dev: ((job.total - cur) / cur) * 100 };
    }
    CURVE = out;
    return out;
  }, [products, engineByFamily]);

  // Below-cost line per product: production cost × מקדם רווח.
  const overheadFactor = Number(bizCfg?.overhead_factor) || DEFAULT_OVERHEAD_FACTOR;
  const floorByProduct = useMemo(() => {
    const out: Record<string, CostInfo> = {};
    for (const p of products) {
      const e = engineByFamily[(p.family ?? "").trim()];
      const w = Number(p.width_cm);
      const h = Number(p.height_cm);
      if (!e || !w || !h) continue;
      const area = (w * h) / 10000;
      const job = priceJob(e.cfg, e.anchors, w, h, Math.max(1, Number(p.qty) || 1));
      if (!job) continue;
      const floor = Math.round(job.costFloorValue);
      const cur = currentPrice(p);
      out[p.id] = {
        area,
        directCost: job.cost,
        ratePerM2: job.above ? e.cfg.outsourceCost : e.cfg.cost,
        floor,
        hasCost: job.cost > 0,
        below: job.cost > 0 && cur !== null && cur < floor,
        thresholdW: e.cfg.thresholdW,
        thresholdH: e.cfg.thresholdH,
        aboveThreshold: job.above,
        outsourceRate: e.cfg.outsourceCost,
      };
    }
    COST = out;
    return out;
  }, [products, engineByFamily]);





  const navigate = useNavigate({ from: "/catalog" });

  const [q, setQ] = useState("");
  const [selectedFamilies, setSelectedFamilies] = useState<Set<string>>(
    new Set(familiesParam ? familiesParam.split(",").map((x: string) => x.trim()).filter(Boolean) : []),
  );
  const [senzeyStatus, setSenzeyStatus] = useState("");
  const [siteStatus, setSiteStatus] = useState("");
  const [onlyGap, setOnlyGap] = useState(false);
  const [onlyDup, setOnlyDup] = useState(false);

  const [onlyBelowCost, setOnlyBelowCost] = useState(false);
  const [onlyOutsource, setOnlyOutsource] = useState(false);

  const [onlyNew, setOnlyNew] = useState(false);
  const [onlyProposed, setOnlyProposed] = useState(false);
  const [onlyCurveOut, setOnlyCurveOut] = useState(false);
  const { isAdmin } = useAuth();
  const [showClosed, setShowClosed] = useState(false);
  const [colorRows, setColorRows] = useState(false);
  const [group, setGroup] = useState(groupParam ?? "");
  const [category, setCategory] = useState(categoryParam ?? "");
  const [presence, setPresence] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [drawer, setDrawer] = useState<Product | null>(null);
  const [limit, setLimit] = useState(200);
  const [colFilters, setColFilters] = useState<Partial<Record<ColKey, string>>>({});
  const [showColFilters, setShowColFilters] = useState(true);
  const [sort, setSort] = useState<{ key: ColKey; dir: "asc" | "desc" }>({ key: "size", dir: "asc" });
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>({
    senzey_ids: true,
    name: true,
    family: true,
    senzey_group: false,
    site_category: false,
    size: true,
    qty: true,
    senzey_price: true,
    site_price: true,
    price_gap: true,
    final_price: true,
    curve_price: true,
    curve_dev: false,
    cost_floor: true,
    outsource: true,
    competitor_price: false,
    proposed_price: false,
    senzey_status: true,
    site_status: true,
    site_url: true,
    notes: true,
    verified: true,
    is_anchor: true,
  });


  const baseWidths: Record<ColKey, number> = {
    senzey_ids: 7,
    name: 22,
    family: 9,
    senzey_group: 8,
    site_category: 8,
    size: 8,
    qty: 4,
    senzey_price: 7,
    site_price: 7,
    price_gap: 6,
    final_price: 7,
    curve_price: 8,
    curve_dev: 6,
    cost_floor: 7,
    outsource: 6,
    competitor_price: 7,
    proposed_price: 7,
    senzey_status: 6,
    site_status: 6,
    site_url: 4,
    notes: 4,
    verified: 4,
    is_anchor: 4,
  };

  const scaledWidths = useMemo(() => {
    const visible = Object.entries(baseWidths)
      .filter(([k]) => visibleCols[k as ColKey])
      .map(([, v]) => v);
    const total = visible.reduce((a, b) => a + b, 0);
    const factor = total > 0 ? (100 - 2) / total : 0;
    const out: Partial<Record<ColKey, string>> = {};
    for (const [k, v] of Object.entries(baseWidths)) {
      if (visibleCols[k as ColKey]) out[k as ColKey] = `${(v * factor).toFixed(2)}%`;
    }
    return out;
  }, [visibleCols]);
  const visibleCount = Object.values(visibleCols).filter(Boolean).length;

  const cf = (k: ColKey) => colFilters[k] ?? "";
  const setCf = (k: ColKey, v: string) => setColFilters((s) => ({ ...s, [k]: v }));
  const activeColFilters = Object.values(colFilters).filter((v) => (v ?? "").trim()).length;
  function toggleSort(k: ColKey) {
    setSort((s) => (s?.key !== k ? { key: k, dir: "asc" } : s.dir === "asc" ? { key: k, dir: "desc" } : { key: k, dir: "asc" }));
  }
  function SortHead({ k, label, className = "" }: { k: ColKey; label: string; className?: string }) {
    const active = sort.key === k;
    return (
      <button
        onClick={() => toggleSort(k)}
        className={`flex items-center gap-1 font-semibold ${active ? "text-[var(--paper,#fff)] underline" : ""} ${className}`}
      >
        {label}
        <span className="text-[10px] opacity-70">{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    );
  }

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
      const stamp = new Date().toISOString();
      const has = (k: string) => Object.prototype.hasOwnProperty.call(patch, k);
      const priceChanged = has("senzey_price") || has("site_price");

      // Changing a system's price re-derives that system's status (עלה / ירד / ללא שינוי).
      // Auto always wins over a manually picked status in the same save.
      if (priceChanged) {
        let autoCount = 0;
        for (const id of ids) {
          const p = products.find((x) => x.id === id);
          const auto = p ? autoStatusFromPrice(p, patch) : {};
          if (Object.keys(auto).length) autoCount++;
          const { error } = await supabase
            .from("products")
            .update({ ...patch, ...auto, updated_at: stamp })
            .eq("id", id);
          if (error) throw error;
        }
        return { autoCount };
      }


      const { error } = await supabase
        .from("products")
        .update({ ...patch, updated_at: stamp })
        .in("id", ids);
      if (error) throw error;
      return { autoCount: 0 };
    },

    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product-history"] });
      toast.success(res?.autoCount ? "עודכן — הסטטוסים חושבו מחדש לפי המחיר" : "עודכן");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (product: Product) => {
      const { id, row_key, created_at, updated_at, ...rest } = product;
      const timestamp = Date.now();
      const newRowKey = `${slugify(product.name)}-${timestamp}`;
      const newName = `${product.name} (עותק)`;
      const { error } = await supabase.from("products").insert({
        ...rest,
        row_key: newRowKey,
        name: newName,
        source: "manual",
        senzey_status: "to_add",
        site_status: "to_add",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("המוצר שוכפל וסומן להוספה בשתי המערכות");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProduct = useMutation({
    mutationFn: async (product: Product) => {
      const { error: notesError } = await supabase.from("product_notes").delete().eq("product_id", product.id);
      if (notesError) throw notesError;
      const { error: historyError } = await supabase.from("product_history").delete().eq("product_id", product.id);
      if (historyError) throw historyError;
      const { error } = await supabase.from("products").delete().eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["product-notes"] });
      qc.invalidateQueries({ queryKey: ["product-history"] });
      toast.success("המוצר נמחק");
      if (deleteCandidate?.id) {
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(deleteCandidate.id);
          return next;
        });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteCandidate, setDeleteCandidate] = useState<Product | null>(null);

  const rows = useMemo(() => {
    const qNorm = q.trim().toLowerCase();
    const out = products.filter((p) => {
      const g = (p.senzey_group ?? "").trim();
      const c = (p.site_category ?? "").trim();
      if (qNorm) {
        const haystack = [
          p.name,
          p.family,
          p.senzey_group,
          p.site_category,
          p.site_url,
          p.row_key,
          p.senzey_ids,
          noteTextOf(p.id),
          STATUS_LABEL[p.senzey_status],
          STATUS_LABEL[p.site_status],
        ]
          .map((v) => (v ?? "").toLowerCase())
          .join(" ");
        if (!haystack.includes(qNorm)) return false;
      }
      if (selectedFamilies.size > 0 && !selectedFamilies.has(p.family ?? "")) return false;
      if (senzeyStatus && p.senzey_status !== senzeyStatus) return false;
      if (siteStatus && p.site_status !== siteStatus) return false;
      if (onlyGap) {
        const g = priceGap(p);
        if (!(g !== null && Math.abs(g) > 0.009)) return false;
      }
      if (onlyDup && !((p.senzey_dup_count ?? 0) > 1)) return false;

      if (onlyBelowCost && !floorByProduct[p.id]?.below) return false;
      if (onlyOutsource && !floorByProduct[p.id]?.aboveThreshold) return false;

      if (onlyNew && p.source !== "approved_new") return false;
      if (onlyProposed && p.proposed_price == null) return false;
      if (onlyCurveOut && Math.abs(curveByProduct[p.id]?.dev ?? 0) <= 20) return false;
      if (group && (group === EMPTY ? g !== "" : g !== group)) return false;
      if (category && (category === EMPTY ? c !== "" : c !== category)) return false;
      if (presence === "both" && !(p.site_exists && p.senzey_exists)) return false;
      if (presence === "site" && !(p.site_exists && !p.senzey_exists)) return false;
      if (presence === "senzey" && !(p.senzey_exists && !p.site_exists)) return false;
      if ((!showClosed || !isAdmin) && isClosedOut(p)) return false;

      // per-column filters (Zoho-style)
      if (!matchText(p.senzey_ids, colFilters.senzey_ids ?? "")) return false;
      if (!matchText(p.name, colFilters.name ?? "")) return false;
      if (!matchText(p.family, colFilters.family ?? "")) return false;
      if (!matchText(p.senzey_group, colFilters.senzey_group ?? "")) return false;
      if (!matchText(p.site_category, colFilters.site_category ?? "")) return false;
      if (
        !matchText(
          p.width_cm && p.height_cm ? `${p.width_cm}×${p.height_cm}` : "",
          colFilters.size ?? "",
        )
      )
        return false;
      if (!matchNum(p.qty, colFilters.qty ?? "")) return false;
      if (!matchNum(p.senzey_price, colFilters.senzey_price ?? "")) return false;
      if (!matchNum(p.site_price, colFilters.site_price ?? "")) return false;
      if (!matchNum(priceGap(p), colFilters.price_gap ?? "")) return false;
      if (!matchNum(p.final_price, colFilters.final_price ?? "")) return false;
      if (!matchNum(curveByProduct[p.id]?.suggested ?? null, colFilters.curve_price ?? "")) return false;
      if (
        !matchNum(
          curveByProduct[p.id] ? Math.round(curveByProduct[p.id]!.dev) : null,
          colFilters.curve_dev ?? "",
        )
      )
        return false;
      if (!matchNum(floorByProduct[p.id]?.hasCost ? floorByProduct[p.id]!.floor : null, colFilters.cost_floor ?? ""))
        return false;
      if (colFilters.outsource === "yes" && !floorByProduct[p.id]?.aboveThreshold) return false;
      if (colFilters.outsource === "no" && floorByProduct[p.id]?.aboveThreshold) return false;
      if (!matchNum(p.competitor_price, colFilters.competitor_price ?? "")) return false;
      if (!matchNum(p.proposed_price, colFilters.proposed_price ?? "")) return false;
      if (colFilters.senzey_status && p.senzey_status !== colFilters.senzey_status) return false;
      if (colFilters.site_status && p.site_status !== colFilters.site_status) return false;
      if (colFilters.site_url === "yes" && !(p.site_url ?? "").trim()) return false;
      if (colFilters.site_url === "no" && (p.site_url ?? "").trim()) return false;
      if (!matchText(noteTextOf(p.id), colFilters.notes ?? "")) return false;

      if (colFilters.verified === "yes" && !p.verified) return false;
      if (colFilters.verified === "no" && p.verified) return false;
      if (colFilters.is_anchor === "yes" && !p.is_anchor) return false;
      if (colFilters.is_anchor === "no" && p.is_anchor) return false;
      return true;
    });

    const get = SORT_VALUE[sort.key];
    const dir = sort.dir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "he") * dir;
    });
    return out;
  }, [
    products,
    notesByProduct,
    q,
    selectedFamilies,
    senzeyStatus,
    siteStatus,
    onlyGap,
    onlyDup,

    onlyBelowCost,
    onlyOutsource,
    floorByProduct,

    onlyNew,
    onlyProposed,
    onlyCurveOut,
    curveByProduct,
    showClosed,
    isAdmin,
    group,
    category,
    presence,
    colFilters,
    sort,
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

  function resetFilters() {
    setQ("");
    setSelectedFamilies(new Set());
    setSenzeyStatus("");
    setSiteStatus("");
    setOnlyGap(false);
    setOnlyDup(false);
    setOnlyNew(false);
    setOnlyProposed(false);
    setOnlyCurveOut(false);
    setShowClosed(false);
    setGroup("");
    setCategory("");
    setPresence("");
    setColFilters({});
    setSort({ key: "size", dir: "asc" });
    setSelected(new Set());
    setLimit(200);
    navigate({ to: ".", search: {} });
  }


  async function exportRows(kind: "xlsx" | "csv") {
    if (!rows.length) {
      toast.error("אין שורות לייצוא");
      return;
    }

    // original (pre-change) prices = earliest recorded old_value per product+field
    const priceFields = ["senzey_price", "site_price", "final_price"] as const;
    const originals: Record<string, Partial<Record<(typeof priceFields)[number], string>>> = {};
    {
      const page = 1000;
      for (let from = 0; ; from += page) {
        const { data, error } = await supabase
          .from("product_history")
          .select("product_id,field,old_value,changed_at")
          .in("field", priceFields as unknown as string[])
          .order("changed_at", { ascending: true })
          .range(from, from + page - 1);
        if (error) {
          toast.error(error.message);
          break;
        }
        for (const h of data ?? []) {
          const key = h.product_id as string;
          const f = h.field as (typeof priceFields)[number];
          originals[key] ??= {};
          if (originals[key]![f] === undefined) originals[key]![f] = (h.old_value ?? "") as string;
        }
        if (!data || data.length < page) break;
      }
    }
    const orig = (p: Product, f: (typeof priceFields)[number], current: number | null) => {
      const v = originals[p.id]?.[f];
      if (v === undefined) return current ?? "";
      return v === "" || v === null ? "" : Number(v);
    };

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
      "מחיר סנזיי מקורי": orig(p, "senzey_price", p.senzey_price),
      "כפילויות סנזיי": p.senzey_dup_count ?? 0,
      "קיים באתר": p.site_exists ? "כן" : "לא",
      "קישור": p.site_url ?? "",
      "מחיר אתר": p.site_price ?? "",
      "מחיר אתר מקורי": orig(p, "site_price", p.site_price),
      "פער אתר-סנזיי": priceGap(p) ?? "",
      "מחיר סופי": p.final_price ?? "",
      "מחיר סופי מקורי": orig(p, "final_price", p.final_price),

      "מחיר לפי עקומה": curveByProduct[p.id]?.suggested ?? "",
      "סטייה מהעקומה %": curveByProduct[p.id] ? Math.round(curveByProduct[p.id]!.dev) : "",
      "רצפת מחיר": floorByProduct[p.id]?.hasCost ? floorByProduct[p.id]!.floor : "",
      "מיקור חוץ": floorByProduct[p.id]?.aboveThreshold ? "כן" : "",
      "סטטוס סנזיי": STATUS_LABEL[p.senzey_status] ?? p.senzey_status,
      "סטטוס אתר": STATUS_LABEL[p.site_status] ?? p.site_status,
      "אומת": p.verified ? "כן" : "לא",
      "עוגן": p.is_anchor ? "כן" : "",
      "הערות": (notesByProduct[p.id] ?? []).map((n) => n.body).join(" | "),

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

      <div className="mb-4 space-y-3">
        {/* Simple filters — visible to all users */}
        <div className="flex flex-wrap items-center gap-3 border-2 border-[var(--ink)] bg-card p-3">
          <input
            placeholder="חיפוש לפי תת-מחרוזת (שם, משפחה, קבוצה, קטגוריה, הערות…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`${inputCls} min-w-[260px] flex-1`}
          />
          <div className="min-w-[220px] flex-1">
            <FamilyMultiPicker
              selected={selectedFamilies}
              families={families}
              onChange={(next) => {
                setSelectedFamilies(next);
                const qs = [...next].join(",");
                navigate({ to: ".", search: { families: qs || undefined, senzey_group: groupParam, site_category: categoryParam } });
              }}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded border-2 border-[var(--ink)] bg-card px-3 py-2 text-sm font-semibold shadow-[2px_2px_0_0_var(--ink)] hover:bg-[var(--surface-deep)]">
            <Switch
              checked={onlyGap}
              onCheckedChange={(v) => setOnlyGap(v)}
              aria-label="רק פערי מחיר"
            />
            רק פערי מחיר
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded border-2 border-[var(--ink)] bg-card px-3 py-2 text-sm font-semibold shadow-[2px_2px_0_0_var(--ink)] hover:bg-[var(--surface-deep)]">
            <Switch
              checked={colorRows}
              onCheckedChange={(v) => setColorRows(v)}
              aria-label="צביעת שורות"
            />
            צביעת שורות
          </label>
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1.5 bg-[var(--accent-raw)] px-3 py-2 text-sm font-bold text-white shadow-[2px_2px_0_0_var(--ink)] hover:brightness-110"
          >
            <RotateCcw className="size-4" />
            איפוס סינון
          </button>
        </div>

        {/* Advanced filters — admin only */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-3 border-2 border-dashed border-[var(--ink)] bg-card p-3">
            <span className="text-xs font-bold text-muted-foreground">סינון מתקדם:</span>
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
              <input type="checkbox" checked={onlyDup} onChange={(e) => setOnlyDup(e.target.checked)} />
              רק כפילויות
            </label>
            <label className="flex items-center gap-1 text-sm font-semibold">
              <input
                type="checkbox"
                checked={onlyBelowCost}
                onChange={(e) => setOnlyBelowCost(e.target.checked)}
              />
              רק מתחת לעלות
            </label>
            <label className="flex items-center gap-1 text-sm font-semibold">
              <input
                type="checkbox"
                checked={onlyOutsource}
                onChange={(e) => setOnlyOutsource(e.target.checked)}
              />
              רק מיקור חוץ
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
            <label className="flex items-center gap-1 text-sm font-semibold">
              <input
                type="checkbox"
                checked={onlyCurveOut}
                onChange={(e) => setOnlyCurveOut(e.target.checked)}
              />
              רק חריגים מהעקומה
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded border-2 border-[var(--ink)] bg-card px-3 py-2 text-sm font-semibold shadow-[2px_2px_0_0_var(--ink)] hover:bg-[var(--surface-deep)]">
              <Switch
                checked={showClosed}
                onCheckedChange={(v) => setShowClosed(v)}
                aria-label="הצג גם פריטים נמחקים או לא רלוונטים"
              />
              הצג גם נמחקים / לא רלוונטים
            </label>
          </div>
        )}
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

      {isAdmin && (
        <div className="mb-2 flex flex-wrap items-center gap-3 text-sm">
          <button
            onClick={() => setShowColFilters((v) => !v)}
            className="border-2 border-[var(--ink)] px-3 py-1 font-bold hover:bg-[var(--surface-deep)]"
          >
            {showColFilters ? "הסתר סינון עמודות" : "סינון לפי עמודה"}
            {activeColFilters > 0 && ` (${activeColFilters})`}
          </button>
          <ColumnChooser visible={visibleCols} onChange={setVisibleCols} />
          {(activeColFilters > 0 || sort.key !== "size" || sort.dir !== "asc") && (
            <button
              onClick={() => {
                setColFilters({});
                setSort({ key: "size", dir: "asc" });
              }}
              className="underline"
            >
              ניקוי סינון עמודות ומיון
            </button>
          )}
          <span className="text-xs text-muted-foreground">
            מספרים: ‎&gt;100‎ · ‎&lt;=50‎ · ‎10-30‎ · ‎-‎ ריק · ‎*‎ לא ריק
          </span>
        </div>
      )}


      {isLoading ? (
        <p className="text-muted-foreground">טוען…</p>
      ) : (
        <div className="overflow-hidden border-2 border-[var(--ink)] bg-card">
          <table className="w-full table-fixed text-sm">
            <thead className="bg-[var(--ink)] text-white">
              <tr className="text-right">
                <th className="w-[32px] px-2 py-2"></th>
                {visibleCols.senzey_ids && (
                  <th style={{ width: scaledWidths.senzey_ids }} className="px-2 py-2">
                    <SortHead k="senzey_ids" label="מס׳ סנזיי" />
                  </th>
                )}
                {visibleCols.name && (
                  <th style={{ width: scaledWidths.name }} className="px-2 py-2">
                    <SortHead k="name" label="שם" />
                  </th>
                )}
                {visibleCols.family && (
                  <th style={{ width: scaledWidths.family }} className="px-2 py-2">
                    <SortHead k="family" label="משפחה" />
                  </th>
                )}
                {visibleCols.senzey_group && (
                  <th style={{ width: scaledWidths.senzey_group }} className="px-2 py-2">
                    <SortHead k="senzey_group" label="קבוצה בסנזיי" />
                  </th>
                )}
                {visibleCols.site_category && (
                  <th style={{ width: scaledWidths.site_category }} className="px-2 py-2">
                    <SortHead k="site_category" label="קטגוריה באתר" />
                  </th>
                )}
                {visibleCols.size && (
                  <th style={{ width: scaledWidths.size }} className="px-2 py-2">
                    <SortHead k="size" label="מידה" />
                  </th>
                )}
                {visibleCols.qty && (
                  <th style={{ width: scaledWidths.qty }} className="px-2 py-2">
                    <SortHead k="qty" label="כמות" />
                  </th>
                )}
                {visibleCols.senzey_price && (
                  <th style={{ width: scaledWidths.senzey_price }} className="px-2 py-2">
                    <SortHead k="senzey_price" label="סנזיי" />
                  </th>
                )}
                {visibleCols.site_price && (
                  <th style={{ width: scaledWidths.site_price }} className="px-2 py-2">
                    <SortHead k="site_price" label="אתר" />
                  </th>
                )}
                {visibleCols.price_gap && (
                  <th style={{ width: scaledWidths.price_gap }} className="px-2 py-2">
                    <SortHead k="price_gap" label="פער" />
                  </th>
                )}
                {visibleCols.final_price && (
                  <th style={{ width: scaledWidths.final_price }} className="px-2 py-2">
                    <SortHead k="final_price" label="מחיר סופי" />
                  </th>
                )}
                {visibleCols.curve_price && (
                  <th style={{ width: scaledWidths.curve_price }} className="px-2 py-2">
                    <SortHead k="curve_price" label="לפי עקומה" />
                  </th>
                )}
                {visibleCols.cost_floor && (
                  <th style={{ width: scaledWidths.cost_floor }} className="px-2 py-2">
                    <SortHead k="cost_floor" label="רצפת מחיר" />
                  </th>
                )}
                {visibleCols.outsource && (
                  <th style={{ width: scaledWidths.outsource }} className="px-2 py-2">
                    <SortHead k="outsource" label="מיקור חוץ" />
                  </th>
                )}
                {visibleCols.curve_dev && (
                  <th style={{ width: scaledWidths.curve_dev }} className="px-2 py-2">
                    <SortHead k="curve_dev" label="סטייה %" />
                  </th>
                )}
                {visibleCols.competitor_price && (
                  <th style={{ width: scaledWidths.competitor_price }} className="px-2 py-2">
                    <SortHead k="competitor_price" label="מחיר מתחרה" />
                  </th>
                )}
                {visibleCols.proposed_price && (
                  <th style={{ width: scaledWidths.proposed_price }} className="px-2 py-2">
                    <SortHead k="proposed_price" label="מחיר מוצע" />
                  </th>
                )}
                {visibleCols.senzey_status && (
                  <th style={{ width: scaledWidths.senzey_status }} className="px-2 py-2">
                    <SortHead k="senzey_status" label="סט׳ סנזיי" />
                  </th>
                )}
                {visibleCols.site_status && (
                  <th style={{ width: scaledWidths.site_status }} className="px-2 py-2">
                    <SortHead k="site_status" label="סט׳ אתר" />
                  </th>
                )}
                {visibleCols.site_url && (
                  <th style={{ width: scaledWidths.site_url }} className="px-2 py-2 font-semibold">
                    קישור
                  </th>
                )}
                {visibleCols.notes && (
                  <th style={{ width: scaledWidths.notes }} className="px-2 py-2">
                    <SortHead k="notes" label="הערות" />
                  </th>
                )}

                {visibleCols.verified && (
                  <th style={{ width: scaledWidths.verified }} className="px-2 py-2 text-center">
                    <SortHead k="verified" label="אומת" className="mx-auto" />
                  </th>
                )}
                {visibleCols.is_anchor && (
                  <th style={{ width: scaledWidths.is_anchor }} className="px-2 py-2 text-center">
                    <SortHead k="is_anchor" label="עוגן" className="mx-auto" />
                  </th>
                )}
                <th className="w-10 px-2 py-2"></th>
              </tr>
              {isAdmin && showColFilters && (
                <tr className="bg-[var(--ink)] text-right align-top">
                  <th className="px-2 pb-2"></th>
                  {visibleCols.senzey_ids && (
                    <th style={{ width: scaledWidths.senzey_ids }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("senzey_ids")}
                        onChange={(e) => setCf("senzey_ids", e.target.value)}
                        placeholder="מספר…"
                      />
                    </th>
                  )}
                  {visibleCols.name && (
                    <th style={{ width: scaledWidths.name }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("name")}
                        onChange={(e) => setCf("name", e.target.value)}
                        placeholder="שם…"
                      />
                    </th>
                  )}
                  {visibleCols.family && (
                    <th style={{ width: scaledWidths.family }} className="px-2 pb-2">
                      <select
                        className={colInput}
                        value={cf("family")}
                        onChange={(e) => setCf("family", e.target.value)}
                      >
                        <option value="">הכל</option>
                        {families.map((f) => (
                          <option key={f.family} value={f.family}>
                            {f.family}
                          </option>
                        ))}
                      </select>
                    </th>
                  )}
                  {visibleCols.senzey_group && (
                    <th style={{ width: scaledWidths.senzey_group }} className="px-2 pb-2">
                      <select
                        className={colInput}
                        value={cf("senzey_group")}
                        onChange={(e) => setCf("senzey_group", e.target.value)}
                      >
                        <option value="">הכל</option>
                        <option value="-">ריק</option>
                        {groupOptions.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </th>
                  )}
                  {visibleCols.site_category && (
                    <th style={{ width: scaledWidths.site_category }} className="px-2 pb-2">
                      <select
                        className={colInput}
                        value={cf("site_category")}
                        onChange={(e) => setCf("site_category", e.target.value)}
                      >
                        <option value="">הכל</option>
                        <option value="-">ריק</option>
                        {categoryOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </th>
                  )}
                  {visibleCols.size && (
                    <th style={{ width: scaledWidths.size }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("size")}
                        onChange={(e) => setCf("size", e.target.value)}
                        placeholder="70×100"
                      />
                    </th>
                  )}
                  {visibleCols.qty && (
                    <th style={{ width: scaledWidths.qty }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("qty")}
                        onChange={(e) => setCf("qty", e.target.value)}
                        placeholder=">1"
                      />
                    </th>
                  )}
                  {visibleCols.senzey_price && (
                    <th style={{ width: scaledWidths.senzey_price }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("senzey_price")}
                        onChange={(e) => setCf("senzey_price", e.target.value)}
                        placeholder=">100"
                      />
                    </th>
                  )}
                  {visibleCols.site_price && (
                    <th style={{ width: scaledWidths.site_price }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("site_price")}
                        onChange={(e) => setCf("site_price", e.target.value)}
                        placeholder=">100"
                      />
                    </th>
                  )}
                  {visibleCols.price_gap && (
                    <th style={{ width: scaledWidths.price_gap }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("price_gap")}
                        onChange={(e) => setCf("price_gap", e.target.value)}
                        placeholder=">0"
                      />
                    </th>
                  )}
                  {visibleCols.final_price && (
                    <th style={{ width: scaledWidths.final_price }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("final_price")}
                        onChange={(e) => setCf("final_price", e.target.value)}
                        placeholder="-"
                      />
                    </th>
                  )}
                  {visibleCols.curve_price && (
                    <th style={{ width: scaledWidths.curve_price }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("curve_price")}
                        onChange={(e) => setCf("curve_price", e.target.value)}
                        placeholder="-"
                      />
                    </th>
                  )}
                  {visibleCols.cost_floor && (
                    <th style={{ width: scaledWidths.cost_floor }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("cost_floor")}
                        onChange={(e) => setCf("cost_floor", e.target.value)}
                        placeholder="-"
                      />
                    </th>
                  )}
                  {visibleCols.outsource && (
                    <th style={{ width: scaledWidths.outsource }} className="px-2 pb-2">
                      <select
                        className={colInput}
                        value={cf("outsource")}
                        onChange={(e) => setCf("outsource", e.target.value)}
                      >
                        <option value="">הכל</option>
                        <option value="yes">מעל הסף</option>
                        <option value="no">מתחת לסף</option>
                      </select>
                    </th>
                  )}
                  {visibleCols.curve_dev && (
                    <th style={{ width: scaledWidths.curve_dev }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("curve_dev")}
                        onChange={(e) => setCf("curve_dev", e.target.value)}
                        placeholder=">20"
                      />
                    </th>
                  )}
                  {visibleCols.competitor_price && (
                    <th style={{ width: scaledWidths.competitor_price }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("competitor_price")}
                        onChange={(e) => setCf("competitor_price", e.target.value)}
                        placeholder="*"
                      />
                    </th>
                  )}
                  {visibleCols.proposed_price && (
                    <th style={{ width: scaledWidths.proposed_price }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("proposed_price")}
                        onChange={(e) => setCf("proposed_price", e.target.value)}
                        placeholder="*"
                      />
                    </th>
                  )}
                  {visibleCols.senzey_status && (
                    <th style={{ width: scaledWidths.senzey_status }} className="px-2 pb-2">
                      <select
                        className={colInput}
                        value={cf("senzey_status")}
                        onChange={(e) => setCf("senzey_status", e.target.value)}
                      >
                        <option value="">הכל</option>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </th>
                  )}
                  {visibleCols.site_status && (
                    <th style={{ width: scaledWidths.site_status }} className="px-2 pb-2">
                      <select
                        className={colInput}
                        value={cf("site_status")}
                        onChange={(e) => setCf("site_status", e.target.value)}
                      >
                        <option value="">הכל</option>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </th>
                  )}
                  {visibleCols.site_url && (
                    <th style={{ width: scaledWidths.site_url }} className="px-2 pb-2">
                      <select
                        className={colInput}
                        value={cf("site_url")}
                        onChange={(e) => setCf("site_url", e.target.value)}
                      >
                        <option value="">הכל</option>
                        <option value="yes">יש</option>
                        <option value="no">אין</option>
                      </select>
                    </th>
                  )}
                  {visibleCols.notes && (
                    <th style={{ width: scaledWidths.notes }} className="px-2 pb-2">
                      <input
                        className={colInput}
                        value={cf("notes")}
                        onChange={(e) => setCf("notes", e.target.value)}
                        placeholder="הערה…"
                      />
                    </th>
                  )}

                  {visibleCols.verified && (
                    <th style={{ width: scaledWidths.verified }} className="px-2 pb-2">
                      <select
                        className={colInput}
                        value={cf("verified")}
                        onChange={(e) => setCf("verified", e.target.value)}
                      >
                        <option value="">הכל</option>
                        <option value="yes">אומת</option>
                        <option value="no">לא</option>
                      </select>
                    </th>
                  )}
                  {visibleCols.is_anchor && (
                    <th style={{ width: scaledWidths.is_anchor }} className="px-2 pb-2">
                      <select
                        className={colInput}
                        value={cf("is_anchor")}
                        onChange={(e) => setCf("is_anchor", e.target.value)}
                      >
                        <option value="">הכל</option>
                        <option value="yes">עוגן</option>
                        <option value="no">לא</option>
                      </select>
                    </th>
                  )}
                  <th className="w-10 px-2 pb-2"></th>
                </tr>
              )}
            </thead>
            <tbody>
              {visible.map((p, i) => {
                const closedOut = isClosedOut(p);
                const verified = p.verified;
                const overThreshold = floorByProduct[p.id]?.aboveThreshold ?? false;
                return (
                  <tr
                    key={p.id}
                    onClick={() => setDrawer(p)}
                    className={`cursor-pointer border-t border-border hover:bg-[oklch(0.95_0.03_250)] ${
                      colorRows && overThreshold
                        ? "border-s-4 border-s-[oklch(0.65_0.16_55)]"
                        : ""
                    } ${
                      colorRows && closedOut
                        ? "bg-[oklch(0.92_0_0)]"
                        : colorRows && verified
                          ? "bg-[oklch(0.95_0.05_145)]"
                          : i % 2
                            ? "bg-[var(--surface-deep)]"
                            : ""
                    }`}
                  >
                  <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                  </td>
                  {visibleCols.senzey_ids && (
                    <td
                      style={{ width: scaledWidths.senzey_ids }}
                      className="truncate px-2 py-1 font-mono text-xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="flex w-full items-center gap-1">
                        <span className="min-w-0 flex-1">
                          <InlineEdit
                            key={`sid-${p.id}-${p.senzey_ids ?? ""}`}
                            value={p.senzey_ids}
                            className="font-mono text-xs"
                            onSave={(v) => update.mutate({ ids: [p.id], patch: { senzey_ids: v || null } })}
                          />
                        </span>
                        {p.senzey_ids?.trim() && (
                          <button
                            title="העתק מספר סנזיי"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(p.senzey_ids!).then(() => toast.success("מספר סנזיי הועתק"));
                            }}
                            className="inline-flex shrink-0 items-center text-muted-foreground hover:text-[var(--accent-raw)]"
                          >
                            <Copy className="size-3" />
                          </button>
                        )}
                      </span>

                    </td>
                  )}
                  {visibleCols.name && (
                    <td style={{ width: scaledWidths.name }} className="min-w-0 whitespace-normal break-words px-2 py-1 font-semibold" dir="rtl" onClick={(e) => e.stopPropagation()}>
                      <span className="flex w-full items-start gap-1.5">
                        <span className="min-w-0 flex-1">
                          <InlineEdit
                            key={`nm-${p.id}-${p.name}`}
                            value={p.name}
                            className="whitespace-normal break-words leading-tight"
                            onSave={(v) => v && update.mutate({ ids: [p.id], patch: { name: v } })}
                          />
                        </span>
                        <button
                          title="העתק שם"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(p.name).then(() => toast.success("השם הועתק"));
                          }}
                          className="inline-flex shrink-0 items-center text-muted-foreground hover:text-[var(--accent-raw)]"
                        >
                          <Copy className="size-3.5" />
                        </button>
                      </span>
                    </td>
                  )}
                  {visibleCols.family && (
                    <td style={{ width: scaledWidths.family }} className="truncate px-2 py-1 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        {p.family && (
                          <span
                            className="inline-block size-2.5 shrink-0 rounded-full"
                            style={{ background: familyColor(p.family) }}
                            title={p.family}
                          />
                        )}
                        <InlineEdit
                          key={`fam-${p.id}-${p.family ?? ""}`}
                          value={p.family}
                          onSave={(v) => update.mutate({ ids: [p.id], patch: { family: v || null } })}
                        />
                      </div>
                    </td>
                  )}

                  {visibleCols.senzey_group && (
                    <td
                      style={{ width: scaledWidths.senzey_group }}
                      className="truncate px-2 py-1 text-muted-foreground"
                      title={p.senzey_group ?? ""}
                    >
                      {p.senzey_group?.trim() || "—"}
                    </td>
                  )}
                  {visibleCols.site_category && (
                    <td
                      style={{ width: scaledWidths.site_category }}
                      className="truncate px-2 py-1 text-muted-foreground"
                      title={p.site_category ?? ""}
                    >
                      {p.site_category?.trim() || "—"}
                    </td>
                  )}
                  {visibleCols.size && (
                    <td style={{ width: scaledWidths.size }} className="num px-2 py-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <span className="flex items-center gap-0.5" dir="ltr">
                        <InlineEdit
                          key={`w-${p.id}-${p.width_cm ?? ""}`}
                          value={p.width_cm}
                          numeric
                          fit
                          className="num"
                          onSave={(v) =>
                            update.mutate({ ids: [p.id], patch: { width_cm: v === "" ? null : Number(v) } })
                          }
                        />
                        <span className="text-muted-foreground">×</span>
                        <InlineEdit
                          key={`h-${p.id}-${p.height_cm ?? ""}`}
                          value={p.height_cm}
                          numeric
                          fit
                          className="num"
                          onSave={(v) =>
                            update.mutate({ ids: [p.id], patch: { height_cm: v === "" ? null : Number(v) } })
                          }
                        />
                      </span>
                    </td>
                  )}
                  {visibleCols.qty && (
                    <td style={{ width: scaledWidths.qty }} className="num truncate px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <InlineEdit
                        key={`q-${p.id}-${p.qty ?? ""}`}
                        value={p.qty ?? 1}
                        numeric
                        className="num"
                        onSave={(v) => update.mutate({ ids: [p.id], patch: { qty: v === "" ? null : Number(v) } })}
                      />
                    </td>
                  )}
                  {visibleCols.senzey_price && (
                    <td style={{ width: scaledWidths.senzey_price }} className="num truncate px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <InlineEdit
                        key={`sp-${p.id}-${p.senzey_price ?? ""}`}
                        value={p.senzey_price}
                        numeric
                        className="num"
                        onSave={(v) =>
                          update.mutate({ ids: [p.id], patch: { senzey_price: v === "" ? null : Number(v) } })
                        }
                      />
                    </td>
                  )}
                  {visibleCols.site_price && (
                    <td style={{ width: scaledWidths.site_price }} className="num truncate px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <InlineEdit
                        key={`wp-${p.id}-${p.site_price ?? ""}`}
                        value={p.site_price}
                        numeric
                        className="num"
                        onSave={(v) =>
                          update.mutate({ ids: [p.id], patch: { site_price: v === "" ? null : Number(v) } })
                        }
                      />
                    </td>
                  )}
                  {visibleCols.price_gap && (
                    <td style={{ width: scaledWidths.price_gap }} className="num truncate px-2 py-1">
                      {(() => {
                        const g = priceGap(p);
                        return (
                          <span
                            className={`font-bold ${
                              g === null
                                ? "text-muted-foreground"
                                : g > 0
                                  ? "text-[oklch(0.45_0.14_150)]"
                                  : g < 0
                                    ? "text-[oklch(0.5_0.19_28)]"
                                    : "text-muted-foreground"
                            }`}
                            title="מחיר אתר פחות מחיר סנזיי"
                          >
                            {g === null ? "—" : `${g > 0 ? "+" : ""}${shekel(g)}`}
                          </span>
                        );
                      })()}
                    </td>
                  )}
                  {visibleCols.final_price && (
                    <td style={{ width: scaledWidths.final_price }} className="truncate px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        defaultValue={p.final_price ?? ""}
                        key={`fp-${p.id}-${p.final_price}`}
                        onBlur={(e) => {
                          const v = e.target.value.trim();
                          const num = v === "" ? null : Number(v);
                          if (num !== (p.final_price ?? null))
                            update.mutate({ ids: [p.id], patch: { final_price: num } });
                        }}
                        className="num w-full border-b border-dashed border-muted-foreground bg-transparent px-1 outline-none focus:border-solid focus:border-[var(--accent-raw)]"
                      />
                    </td>
                  )}
                  {visibleCols.curve_price && (
                    <td
                      style={{ width: scaledWidths.curve_price }}
                      className="num truncate whitespace-nowrap px-2 py-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {(() => {
                        const c = curveByProduct[p.id];
                        if (!c) return <span className="text-muted-foreground">—</span>;
                        const a = Math.abs(c.dev);
                        const cls =
                          a > 20
                            ? "bg-[oklch(0.93_0.06_25)] text-[oklch(0.45_0.16_25)] font-bold"
                            : a > 5
                              ? "bg-[oklch(0.94_0.08_50)] text-[oklch(0.45_0.15_45)] font-semibold"
                              : "text-muted-foreground";
                        return (
                          <>
                            <span className={`px-1 ${cls}`} title={`נוכחי ${shekel(c.current)}`}>
                              {shekel(c.suggested)}
                            </span>


                            {a > 5 && c.suggested !== (p.final_price ?? null) && (
                              <button
                                onClick={() =>
                                  update.mutate({
                                    ids: [p.id],
                                    patch: { final_price: c.suggested },
                                  })
                                }
                                className="ms-2 border border-[var(--accent-raw)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--accent-raw)] hover:bg-[oklch(0.95_0.03_250)]"
                              >
                                אמץ
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </td>
                  )}
                  {visibleCols.cost_floor && (
                    <td
                      style={{ width: scaledWidths.cost_floor }}
                      className="num truncate whitespace-nowrap px-2 py-1"
                    >
                      {(() => {
                        const c = floorByProduct[p.id];
                        if (!c || !c.hasCost)
                          return <span className="text-muted-foreground">—</span>;
                        const tip = `שטח ${c.area.toFixed(2)} מ״ר · ${c.ratePerM2} ₪/מ״ר${
                          c.aboveThreshold ? " (מיקור חוץ)" : ""
                        } · עלות ישירה ${shekel(Math.round(c.directCost))} · ×${overheadFactor} = ${shekel(c.floor)}`;
                        return (
                          <span
                            title={tip}
                            className={
                              c.below
                                ? "bg-[oklch(0.93_0.06_25)] px-1 font-bold text-[oklch(0.45_0.16_25)]"
                                : "text-muted-foreground"
                            }
                          >
                            {shekel(c.floor)}
                          </span>
                        );
                      })()}
                    </td>
                  )}
                  {visibleCols.outsource && (
                    <td
                      style={{ width: scaledWidths.outsource }}
                      className="truncate whitespace-nowrap px-2 py-1"
                    >
                      {(() => {
                        const c = floorByProduct[p.id];
                        if (!c || c.thresholdW == null || c.thresholdH == null)
                          return <span className="text-muted-foreground">—</span>;
                        if (!c.aboveThreshold)
                          return <span className="text-muted-foreground">—</span>;
                        return (
                          <span
                            title={`שטח ${c.area.toFixed(2)} מ״ר · מעל ${c.thresholdW}×${c.thresholdH} ס״מ${
                              c.outsourceRate ? ` · הדפסה בחוץ ${c.outsourceRate} ₪/מ״ר` : ""
                            }`}
                            className="border border-[oklch(0.6_0.16_55)] bg-[oklch(0.94_0.08_60)] px-1 text-[11px] font-bold text-[oklch(0.45_0.15_45)]"
                          >
                            מיקור חוץ
                          </span>
                        );
                      })()}
                    </td>
                  )}
                  {visibleCols.curve_dev && (
                    <td
                      style={{ width: scaledWidths.curve_dev }}
                      className="num truncate whitespace-nowrap px-2 py-1"
                    >
                      {curveByProduct[p.id] ? (
                        <span
                          className={
                            Math.abs(curveByProduct[p.id]!.dev) > 20
                              ? "font-bold text-[oklch(0.45_0.16_25)]"
                              : "text-muted-foreground"
                          }
                        >
                          {curveByProduct[p.id]!.dev > 0 ? "+" : ""}
                          {Math.round(curveByProduct[p.id]!.dev)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                  {visibleCols.competitor_price && (
                    <td style={{ width: scaledWidths.competitor_price }} className="num truncate whitespace-nowrap px-2 py-1">
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
                  )}
                  {visibleCols.proposed_price && (
                    <td style={{ width: scaledWidths.proposed_price }} className="num truncate whitespace-nowrap px-2 py-1" onClick={(e) => e.stopPropagation()}>
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
                  )}
                  {visibleCols.senzey_status && (
                    <td style={{ width: scaledWidths.senzey_status }} className="truncate px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <StatusSelect
                        value={p.senzey_status}
                        onChange={(v) => update.mutate({ ids: [p.id], patch: { senzey_status: v } })}
                      />
                    </td>
                  )}
                  {visibleCols.site_status && (
                    <td style={{ width: scaledWidths.site_status }} className="truncate px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      <StatusSelect
                        value={p.site_status}
                        onChange={(v) => update.mutate({ ids: [p.id], patch: { site_status: v } })}
                      />
                    </td>
                  )}
                  {visibleCols.site_url && (
                    <td style={{ width: scaledWidths.site_url }} className="truncate px-2 py-1" onClick={(e) => e.stopPropagation()}>
                      {p.site_url ? (
                        <a href={p.site_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4 text-[var(--accent-raw)]" />
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  )}
                  {visibleCols.notes && (

                    <td
                      style={{ width: scaledWidths.notes }}
                      className="px-2 py-1 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <NoteIndicator notes={(notesByProduct[p.id] ?? []).map((n) => n.body)} onClick={() => setDrawer(p)} />
                    </td>
                  )}
                  {visibleCols.verified && (
                    <td style={{ width: scaledWidths.verified }} className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
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
                  )}
                  {visibleCols.is_anchor && (
                    <td
                      style={{ width: scaledWidths.is_anchor }}
                      className="px-2 py-1 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        title={p.is_anchor ? "עוגן עקומה — לחץ להסרה" : "סמן כעוגן עקומה למשפחה"}
                        onClick={() =>
                          update.mutate({ ids: [p.id], patch: { is_anchor: !p.is_anchor } })
                        }
                        className={
                          p.is_anchor
                            ? "text-[var(--accent-raw)]"
                            : "text-muted-foreground/40 hover:text-[var(--accent-raw)]"
                        }
                      >
                        <Anchor className="size-4" fill={p.is_anchor ? "currentColor" : "none"} />
                      </button>
                    </td>
                  )}
                  <td className="px-2 py-1 text-center" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          title="פעולות"
                          className="inline-flex items-center text-muted-foreground/60 hover:text-[var(--accent-raw)]"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => duplicate.mutate(p)}
                          className="cursor-pointer"
                        >
                          <Copy className="size-4" />
                          שכפל שורה
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setDeleteCandidate(p);
                            const ok = window.confirm(`למחוק את המוצר "${p.name}"?\nפעולה זו אינה הפיכה ותמחק גם את ההערות וההיסטוריה שלו.`);
                            if (ok) {
                              deleteProduct.mutate(p);
                            } else {
                              setDeleteCandidate(null);
                            }
                          }}
                          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                          <Trash2 className="size-4" />
                          מחק פריט
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                  </tr>
                );
              })}
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
          <h2 className="text-xl font-black break-words whitespace-normal">{product.name}</h2>
          <button onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <Field label="שם" full>
            <AutoTextArea
              className={inputCls}
              value={f.name}
              onChange={(e) => set("name", e.target.value)}
            />
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
          <Field label="קבוצה בסנזיי">
            <input
              className={inputCls}
              value={f.senzey_group ?? ""}
              onChange={(e) => set("senzey_group", e.target.value)}
            />
          </Field>

          <Field label="קטגוריה באתר">
            <input
              className={inputCls}
              value={f.site_category ?? ""}
              onChange={(e) => set("site_category", e.target.value)}
            />
          </Field>
          <Field label="מחיר מתחרה">
            <input
              className={`${inputCls} num`}
              value={f.competitor_price ?? ""}
              onChange={(e) => set("competitor_price", num(e.target.value))}
            />
          </Field>
          <Field label="מחיר מוצע">
            <input
              className={`${inputCls} num`}
              value={f.proposed_price ?? ""}
              onChange={(e) => set("proposed_price", num(e.target.value))}
            />
          </Field>
          <Field label="מקור מחיר מתחרה" full>
            <input
              className={inputCls}
              value={f.competitor_ref ?? ""}
              onChange={(e) => set("competitor_ref", e.target.value)}
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
              // Only send statuses that were actually touched, so a price-only
              // save lets the system derive them automatically.
              ...(f.senzey_status !== product.senzey_status
                ? { senzey_status: f.senzey_status }
                : {}),
              ...(f.site_status !== product.site_status ? { site_status: f.site_status } : {}),
              site_url: f.site_url,
              senzey_group: f.senzey_group ?? null,
              site_category: f.site_category ?? null,

              competitor_price: f.competitor_price ?? null,
              competitor_ref: f.competitor_ref ?? null,
              proposed_price: f.proposed_price ?? null,
            })
          }
          className="mt-6 w-full bg-[var(--accent-raw)] py-3 font-bold text-white"
        >
          שמירה
        </button>
        <NotesPanel productId={product.id} />
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


function AutoTextArea({
  className,
  value,
  onChange,
  rows = 1,
}: {
  className?: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      className={cn("resize-none overflow-hidden", className)}
      value={value}
      rows={rows}
      onChange={onChange}
    />
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

const COLUMN_LABEL: Record<ColKey, string> = {
  senzey_ids: "מספר סנזיי",
  name: "שם",
  family: "משפחה",
  senzey_group: "קבוצה בסנזיי",
  site_category: "קטגוריה באתר",
  size: "מידה",
  qty: "כמות",
  senzey_price: "מחיר סנזיי",
  site_price: "מחיר אתר",
  price_gap: "פער",
  final_price: "מחיר סופי",
  curve_price: "מחיר לפי עקומה",
  curve_dev: "סטייה מהעקומה",
  cost_floor: "רצפת מחיר",
  outsource: "מיקור חוץ",
  competitor_price: "מחיר מתחרה",
  proposed_price: "מחיר מוצע",
  senzey_status: "סטטוס סנזיי",
  site_status: "סטטוס אתר",
  site_url: "קישור",
  notes: "הערות",
  verified: "אומת",
  is_anchor: "עוגן",
};


function ColumnChooser({
  visible,
  onChange,
}: {
  visible: Record<ColKey, boolean>;
  onChange: (v: Record<ColKey, boolean>) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = Object.values(visible).filter(Boolean).length;
  const toggle = (k: ColKey) => onChange({ ...visible, [k]: !visible[k] });
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 border-2 border-[var(--ink)] px-3 py-1 font-bold hover:bg-[var(--surface-deep)]"
      >
        <Columns className="size-4" />
        עמודות {count > 0 && `(${count})`}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-56 border-2 border-[var(--ink)] bg-card p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted-foreground">
              <span>בחר עמודות</span>
              <button
                onClick={() =>
                  onChange({
                    senzey_ids: true,
                    name: true,
                    family: true,
                    senzey_group: false,
                    site_category: false,
                    size: true,
                    qty: true,
                    senzey_price: true,
                    site_price: true,
                    price_gap: true,
                    final_price: true,
                    curve_price: true,
                    curve_dev: false,
                    cost_floor: true,
                    outsource: true,
                    competitor_price: false,
                    proposed_price: false,
                    senzey_status: true,
                    site_status: true,
                    site_url: true,
                    notes: true,
                    verified: true,
                    is_anchor: true,
                  })

                }
                className="underline"
              >
                ברירת מחדל
              </button>
            </div>
            <div className="grid grid-cols-1 gap-2 text-sm">
              {(Object.keys(COLUMN_LABEL) as ColKey[]).map((k) => (
                <label key={k} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visible[k]}
                    onChange={() => toggle(k)}
                  />
                  <span>{COLUMN_LABEL[k]}</span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InlineEdit({
  value,
  onSave,
  numeric,
  placeholder = "—",
  className = "",
  fit,
}: {
  value: string | number | null | undefined;
  onSave: (v: string) => void;
  numeric?: boolean;
  placeholder?: string;
  className?: string;
  /** size to content instead of filling the cell (used by the size column) */
  fit?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const initial = value == null || value === "" ? "" : String(value);
  const [draft, setDraft] = useState(initial);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setDraft(initial);
          setEditing(true);
        }}
        title="לחץ לעריכה"
        className={`${fit ? "w-auto shrink-0 whitespace-nowrap" : "w-full truncate"} cursor-text border-b border-dashed border-transparent text-start hover:border-muted-foreground ${className}`}
      >
        {initial || <span className="text-muted-foreground">{placeholder}</span>}
      </button>
    );
  }

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== initial.trim()) onSave(draft.trim());
  };

  return (
    <input
      autoFocus
      value={draft}
      inputMode={numeric ? "decimal" : undefined}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLInputElement).blur();
        }
        if (e.key === "Escape") {
          setDraft(initial);
          setEditing(false);
        }
      }}
      className={`w-full border-b border-[var(--accent-raw)] bg-transparent px-1 outline-none ${className}`}
    />
  );
}
