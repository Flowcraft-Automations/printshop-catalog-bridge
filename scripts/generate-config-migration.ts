/* ------------------------------------------------------------------ *
 *  generate-config-migration — renders the pricing_config v3 SQL
 *  migration from src/lib/pricing-defaults.ts.
 *
 *  Usage:
 *    bun run scripts/generate-config-migration.ts           # print SQL
 *    bun run scripts/generate-config-migration.ts --write   # + write file
 *
 *  Output file: supabase/migrations/20260825000000_pricing_config_v3.sql
 *  Deterministic by construction — no dates, no randomness — so re-running
 *  it against unchanged pricing-defaults produces a byte-identical file.
 *  Never touches any database.
 * ------------------------------------------------------------------ */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { writeFamilyPricing, type FamilyPricing } from "../src/lib/mdvd";
import {
  SPEC_FAMILY_CONFIGS,
  OPTIONAL_FAMILY_CONFIGS,
  SPEC_ANCHORS,
} from "../src/lib/pricing-defaults";

const OUT_FILE = resolve(
  import.meta.dir,
  "../supabase/migrations/20260825000000_pricing_config_v3.sql",
);

const sqlStr = (s: string) => `'${s.replace(/'/g, "''")}'`;
const slug = (s: string) => s.trim().replace(/\s+/g, "-");

/**
 * v3 keys where LIVE tuning wins over the seed on existing rows — the
 * operational settings users set in the app (machine limits, sheet layout,
 * mounts, minimum order). Engine/curve data always comes from the seed.
 * qty_tiers is deliberately NOT preserved: the seeded שמשונית 120x80 tier
 * supersedes the live one (approved in the 2026-08-25 review).
 */
const LIVE_WINS_KEYS = [
  "min_order_qty",
  "min_order_value",
  "sheet_units",
  "sheet_w",
  "sheet_h",
  "sheet_margin",
  "sheet_gap",
  "max_print_w",
  "max_print_l",
  "cap_w",
  "cap_l",
  "over_limit",
  "mount_cost_m2",
  "mount_cost_unit",
  "whole_board",
  "board_w",
  "board_h",
];

/** Scalar `families` columns a seed sets alongside pricing_config. */
function scalarColumns(cfg: FamilyPricing): [string, number | null][] {
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

function familyUpsert(family: string, cfg: FamilyPricing): string {
  const json = JSON.stringify(writeFamilyPricing(cfg));
  if (json.includes("$cfg$")) throw new Error("dollar-quote collision in config JSON");
  const scalars = scalarColumns(cfg);
  const cols = ["family", "pricing_config", ...scalars.map(([c]) => c)];
  const vals = [sqlStr(family), `$cfg$${json}$cfg$::jsonb`, ...scalars.map(([, v]) => String(v))];
  const keyArray = LIVE_WINS_KEYS.map((k) => `'${k}'`).join(",");
  const sets = [
    /* Existing rows: other top-level keys (legacy `customer`) kept; the v3
       block comes from the seed, with the LIVE operational keys layered on
       top so tuning done in the app survives re-running the migration. */
    `pricing_config = (COALESCE(public.families.pricing_config,'{}'::jsonb) - 'v3')
    || jsonb_build_object('v3',
         (EXCLUDED.pricing_config -> 'v3')
         || COALESCE((SELECT jsonb_object_agg(key, value)
                      FROM jsonb_each(COALESCE(public.families.pricing_config->'v3','{}'::jsonb))
                      WHERE key = ANY (ARRAY[${keyArray}])),
                     '{}'::jsonb))`,
    ...scalars.map(([c, v]) => `${c} = ${v}`),
  ];
  return [
    `INSERT INTO public.families (${cols.join(", ")})`,
    `VALUES (${vals.join(", ")})`,
    `ON CONFLICT (family) DO UPDATE SET`,
    `  ${sets.join(",\n  ")};`,
  ].join("\n");
}

function anchorStatements(): string {
  const parts: string[] = [];
  for (const a of SPEC_ANCHORS) {
    const rowKey = `anchor-${slug(a.family)}-${a.w}x${a.h}-${a.qty}`;
    const name = `${a.family} ${a.w}/${a.h} — עוגן מאושר`;
    parts.push(
      [
        `-- ${a.family} ${a.w}×${a.h} × ${a.qty} = ₪${a.price}`,
        `INSERT INTO public.products`,
        `  (row_key, name, family, width_cm, height_cm, qty, final_price, is_anchor, verified, source, senzey_status, site_status)`,
        `SELECT ${sqlStr(rowKey)}, ${sqlStr(name)}, ${sqlStr(a.family)}, ${a.w}, ${a.h}, ${a.qty}, ${a.price}, true, true, 'migration', 'not_relevant', 'not_relevant'`,
        `WHERE NOT EXISTS (SELECT 1 FROM public.products WHERE row_key = ${sqlStr(rowKey)});`,
        ``,
        `UPDATE public.products`,
        `SET is_anchor = true, verified = true, final_price = ${a.price}`,
        `WHERE row_key = ${sqlStr(rowKey)};`,
      ].join("\n"),
    );
  }
  return parts.join("\n\n");
}

function generate(): string {
  const lines: string[] = [];
  lines.push(`-- ================================================================
-- pricing_config v3 — approved family pricing configuration
--
-- GENERATED by scripts/generate-config-migration.ts from
-- src/lib/pricing-defaults.ts. Do NOT hand-edit this file — change the
-- defaults and regenerate:
--     bun run scripts/generate-config-migration.ts --write
--
-- Idempotent: safe to run more than once. Apply through Lovable (repo
-- sync) or paste into the Supabase SQL editor.
-- ================================================================

-- The pricing_config column was added out-of-band on the remote DB and
-- has no creating migration — guard every column we touch.
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS pricing_config jsonb;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS cost_per_m2 numeric;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS outsource_cost_per_m2 numeric;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS outsource_width_cm numeric;
ALTER TABLE public.families ADD COLUMN IF NOT EXISTS outsource_height_cm numeric;
`);

  lines.push(`-- ----------------------------------------------------------------
-- Family configurations. On existing rows: engine/curve data comes from
-- the seed, LIVE operational tuning (machine limits, sheet layout,
-- mounts, minimum order) is preserved, and other top-level keys of
-- pricing_config — e.g. the legacy "customer" block — are kept.
-- ----------------------------------------------------------------`);
  for (const [family, cfg] of Object.entries(SPEC_FAMILY_CONFIGS)) {
    lines.push(`\n-- ${family}`);
    lines.push(familyUpsert(family, cfg));
  }

  lines.push(`\n-- ----------------------------------------------------------------
-- Approved catalog anchors (SPEC_ANCHORS) — verified anchor products
-- for points the engine formula alone cannot reproduce. The cleanup
-- worklist marks the real catalog rows as anchors too; these seeded
-- rows are a fallback so the curve holds even before cleanup runs.
-- ----------------------------------------------------------------
`);
  lines.push(anchorStatements());

  lines.push(`\n-- ----------------------------------------------------------------
-- אופציונלי: מדבקה בטחונית — הסירו הערה רק באישור הלקוח
-- (optional family — uncomment only with explicit client approval)
-- ----------------------------------------------------------------`);
  for (const [family, cfg] of Object.entries(OPTIONAL_FAMILY_CONFIGS)) {
    const commented = familyUpsert(family, cfg)
      .split("\n")
      .map((l) => `-- ${l}`)
      .join("\n");
    lines.push(`\n-- ${family}`);
    lines.push(commented);
  }

  return lines.join("\n") + "\n";
}

const sql = generate();
console.log(sql);
if (process.argv.includes("--write")) {
  writeFileSync(OUT_FILE, sql, "utf8");
  console.error(`written: ${OUT_FILE}`);
}
