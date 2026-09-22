/* ------------------------------------------------------------------ *
 *  golden-regenerate — rewrites src/lib/pricing/golden-prices.txt from the
 *  seeds in pricing-defaults.ts (via famFixture) over the characterization
 *  grid in golden-grid.ts.
 *
 *  Run it ONLY when a price change is intended and reviewed, and commit the
 *  regenerated file together with the change that moves the prices:
 *
 *      bun run scripts/golden-regenerate.ts
 *      git diff --stat src/lib/pricing/golden-prices.txt
 *
 *  Run from the repo root: famFixture reads reports/dry-run-2026-08-25.csv
 *  through process.cwd(), exactly like `bun test src`.
 * ------------------------------------------------------------------ */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { priceJob, prepareFamily, type JobOptions } from "../src/lib/mdvd";
import { OPTIONAL_FAMILY_CONFIGS, SPEC_FAMILY_CONFIGS } from "../src/lib/pricing-defaults";
import { famFixture } from "../src/lib/pricing-fixtures";
import { GOLDEN_OPTS, GOLDEN_QTY, GOLDEN_SIZES, signature } from "../src/lib/pricing/golden-grid";

const OUT = resolve(import.meta.dir, "../src/lib/pricing/golden-prices.txt");
const lines: string[] = [];
for (const name of Object.keys({ ...SPEC_FAMILY_CONFIGS, ...OPTIONAL_FAMILY_CONFIGS })) {
  const fix = famFixture(name);
  const prepared = prepareFamily(fix.cfg, fix.anchors, fix.validated);
  lines.push(`# ${name}`);
  for (const [w, h] of GOLDEN_SIZES) {
    for (const qty of GOLDEN_QTY) {
      const sigs = GOLDEN_OPTS.map((o) =>
        signature(
          priceJob(fix.cfg, fix.anchors, w, h, qty, fix.validated, {
            ...(o as JobOptions),
            prepared,
          }),
        ),
      );
      /* a single stored signature means every option variant matched it
         (the reader's rule in golden.test.ts) */
      const compact = sigs.every((s) => s === sigs[0]) ? [sigs[0]!] : sigs;
      lines.push(`${w},${h},${qty}|${compact.join("|")}`);
    }
  }
}
writeFileSync(OUT, lines.join("\n") + "\n");
console.log(`wrote ${lines.length} lines → ${OUT}`);
