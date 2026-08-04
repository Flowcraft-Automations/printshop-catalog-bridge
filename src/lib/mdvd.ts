export type Product = {
  id: string;
  row_key: string;
  name: string;
  family: string | null;
  width_cm: number | null;
  height_cm: number | null;
  qty: number | null;
  senzey_exists: boolean | null;
  senzey_ids: string | null;
  senzey_price: number | null;
  senzey_dup_count: number | null;
  site_exists: boolean | null;
  site_url: string | null;
  site_price: number | null;
  final_price: number | null;
  senzey_status: string;
  site_status: string;
  anomaly: string | null;
  notes: string | null;
  source: string | null;
  verified?: boolean;
  verified_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type QtyDiscount = { min: number; mult: number };

export type Family = {
  family: string;
  items_count: number | null;
  rate_m2: number | null;
  min_charge: number | null;
  qty_discounts: QtyDiscount[] | null;
  notes: string | null;
};

export const STATUSES = [
  "exists",
  "to_review",
  "to_add",
  "in_progress",
  "done",
  "not_relevant",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  exists: "קיים",
  to_review: "לבחינה",
  to_add: "להוספה",
  in_progress: "בתהליך",
  done: "בוצע",
  not_relevant: "לא רלוונטי",
};

export const STATUS_CLASS: Record<string, string> = {
  exists: "bg-[oklch(0.93_0.005_250)] text-[oklch(0.42_0.01_250)] border-[oklch(0.86_0.008_250)]",
  to_review: "bg-[oklch(0.94_0.09_95)] text-[oklch(0.42_0.09_75)] border-[oklch(0.86_0.11_92)]",
  to_add: "bg-[oklch(0.93_0.05_250)] text-[oklch(0.42_0.11_255)] border-[oklch(0.85_0.07_252)]",
  in_progress: "bg-[oklch(0.93_0.08_60)] text-[oklch(0.47_0.14_50)] border-[oklch(0.85_0.11_58)]",
  done: "bg-[oklch(0.93_0.07_155)] text-[oklch(0.42_0.1_155)] border-[oklch(0.84_0.09_155)]",
  not_relevant: "bg-[oklch(0.95_0_0)] text-[oklch(0.6_0_0)] border-[oklch(0.9_0_0)]",
};

export function shekel(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return "₪" + Number(n).toLocaleString("he-IL", { maximumFractionDigits: 2 });
}

export function slugify(s: string) {
  return s.trim().replace(/\s+/g, "-").slice(0, 60);
}

export function computePrice(
  family: Family | undefined,
  w: number,
  h: number,
  qty: number,
) {
  const rate = family?.rate_m2 ?? 0;
  const min = family?.min_charge ?? 0;
  const area = (w * h) / 10000;
  const raw = rate * area;
  const beforeDiscount = Math.max(raw, min);
  const tiers = (family?.qty_discounts ?? [])
    .filter((t) => qty >= t.min)
    .sort((a, b) => b.min - a.min);
  const mult = tiers[0]?.mult ?? 1;
  const unit = Math.round(beforeDiscount * mult);
  return {
    area,
    raw,
    min,
    beforeDiscount,
    mult,
    unit,
    total: unit * qty,
    tier: tiers[0] ?? null,
  };
}
