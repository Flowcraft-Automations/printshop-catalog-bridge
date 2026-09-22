/* ------------------------------------------------------------------ *
 *  config-drift — is the live `families` table what pricing-defaults.ts
 *  says it should be? The seed is the source of truth; an admin-form edit
 *  that was not mirrored into the seed shows up here (and would be
 *  overwritten by the next migration). Only `sheet_units` may differ.
 *
 *      bun run scripts/config-drift.ts --json supabase/snapshots/2026-09-22/families.json
 *      bun run scripts/config-drift.ts --live       # SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *
 *  Exit 1 on drift. Read-only.
 * ------------------------------------------------------------------ */
import { writeFamilyPricing } from "../src/lib/mdvd";
import { SPEC_FAMILY_CONFIGS } from "../src/lib/pricing-defaults";
import { LIVE_WINS_KEYS, loadFamiliesJson, loadFamiliesLive, parseArgs, scalarColumns } from "./lib/config-seed";

const args = parseArgs(process.argv.slice(2));
const rows = args.live
  ? await loadFamiliesLive()
  : args.json
    ? loadFamiliesJson(args.json)
    : (() => {
        console.error("usage: --json <families export> | --live");
        process.exit(2);
      })();

const byName = new Map(rows.map((r) => [r.family, r]));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
let drift = 0;
for (const [name, seed] of Object.entries(SPEC_FAMILY_CONFIGS)) {
  const live = byName.get(name);
  if (!live) {
    console.log(`✗ ${name}: missing in live families`);
    drift++;
    continue;
  }
  const want = (writeFamilyPricing(seed) as { v3: Record<string, unknown> }).v3;
  const have = ((live.pricing_config as Record<string, unknown> | null)?.["v3"] ?? {}) as Record<string, unknown>;
  const diffs: string[] = [];
  for (const key of new Set([...Object.keys(want), ...Object.keys(have)])) {
    if (LIVE_WINS_KEYS.includes(key)) continue;
    if (!same(want[key], have[key]))
      diffs.push(`  v3.${key}: seed ${JSON.stringify(want[key])} · live ${JSON.stringify(have[key])}`);
  }
  for (const [col, v] of scalarColumns(seed)) {
    const liveV = (live as unknown as Record<string, unknown>)[col];
    const a = v === null ? null : Number(v);
    const b = liveV == null ? null : Number(liveV);
    if (a !== b) diffs.push(`  ${col}: seed ${a} · live ${b}`);
  }
  if (diffs.length) {
    drift++;
    console.log(`✗ ${name}: ${diffs.length} difference(s)`);
    for (const d of diffs) console.log(d);
  } else console.log(`✓ ${name}`);
}
const legacy = rows.filter((r) => !(r.family in SPEC_FAMILY_CONFIGS));
console.log(
  `\n${legacy.length} live families without a seed (legacy — quote only): ${legacy.map((r) => r.family).join(", ")}`,
);
console.log(drift ? `\n${drift} family(ies) drift from the seed` : "\nno drift — live config matches pricing-defaults.ts");
process.exit(drift ? 1 : 0);
