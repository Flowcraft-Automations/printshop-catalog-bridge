/* ------------------------------------------------------------------ *
 *  config-seed — what the seed (src/lib/pricing-defaults.ts) means for a
 *  `families` row: the scalar columns it sets, the v3 keys that stay
 *  live-only, and loaders for a families export / the live project.
 *  Shared by generate-config-migration.ts and config-drift.ts.
 * ------------------------------------------------------------------ */
import { readFileSync } from "node:fs";
import type { Family, FamilyPricing } from "../../src/lib/mdvd";

/**
 * v3 keys where the LIVE value wins over the seed on existing rows.
 * Since 2026-09-22 the seed is authoritative for everything the client has
 * decided (minimum order, sheet size, machine limits, over-limit policy);
 * only the per-size nesting overrides entered in the app stay live-only.
 * scripts/config-drift.ts ignores the same keys.
 */
export const LIVE_WINS_KEYS = ["sheet_units"];

/** Scalar `families` columns a seed sets alongside pricing_config. */
export function scalarColumns(cfg: FamilyPricing): [string, number | null][] {
  const out: [string, number | null][] = [];
  if (cfg.cost > 0) out.push(["cost_per_m2", cfg.cost]);
  if (cfg.outsourceCost > 0) out.push(["outsource_cost_per_m2", cfg.outsourceCost]);
  if (cfg.engine === "per_m2" && cfg.maxPrintW > 0) {
    /* per_m2 outsourcing keys on the narrow side only — height unbounded */
    out.push(["outsource_width_cm", cfg.maxPrintW]);
    out.push(["outsource_height_cm", 99999]);
  } else {
    /* every other engine ignores the threshold pair — clear it so the config
       screen cannot show a rule that no pricing path reads */
    out.push(["outsource_width_cm", null]);
    out.push(["outsource_height_cm", null]);
  }
  return out;
}

/** `families` rows from a JSON export (e.g. supabase/snapshots/…/families.json). */
export function loadFamiliesJson(path: string): Family[] {
  const raw = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>[];
  return raw.map((r) => ({
    family: String(r["family"] ?? "").trim(),
    items_count: r["items_count"] == null ? null : Number(r["items_count"]),
    notes: r["notes"] == null ? null : String(r["notes"]),
    cost_per_m2: Number(r["cost_per_m2"] ?? 0),
    outsource_cost_per_m2: r["outsource_cost_per_m2"] == null ? null : Number(r["outsource_cost_per_m2"]),
    outsource_width_cm: r["outsource_width_cm"] == null ? null : Number(r["outsource_width_cm"]),
    outsource_height_cm: r["outsource_height_cm"] == null ? null : Number(r["outsource_height_cm"]),
    pricing_config: (r["pricing_config"] ?? {}) as Family["pricing_config"],
  }));
}

/**
 * `families` rows from the live project. Needs SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in the environment (RLS hides pricing from the
 * anon key). Never commit the key; read it from a local .env.local.
 */
export async function loadFamiliesLive(): Promise<Family[]> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --live");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.from("families").select("*");
  if (error) throw new Error(error.message);
  return (data ?? []) as Family[];
}

/** Verified `products` rows from the live project (same credentials). */
export async function loadProductsLive(): Promise<Record<string, unknown>[]> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --live");
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false } });
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from("products")
      .select("id,row_key,name,family,width_cm,height_cm,qty,senzey_price,site_price,final_price,verified,is_anchor")
      .eq("verified", true)
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** CLI helper: `--json <path>` or `--live`; anything else is a positional. */
export function parseArgs(argv: string[]): { json: string | null; live: boolean; rest: string[] } {
  let json: string | null = null;
  let live = false;
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--json") json = argv[++i] ?? null;
    else if (a === "--live") live = true;
    else rest.push(a);
  }
  return { json, live, rest };
}
