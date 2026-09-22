import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { priceJob, prepareFamily, type JobOptions } from "../mdvd";
import { liveFixture } from "../pricing-fixtures";
import { GOLDEN_OPTS, GOLDEN_QTY, GOLDEN_SIZES, signature } from "./golden-grid";

/* ------------------------------------------------------------------ *
 *  Differential (characterization) test.
 *
 *  This is the safety net for the pipeline refactor: 26,136 priced jobs
 *  across every family, captured before any restructuring. The refactor
 *  is only allowed to change HOW a price is computed, never WHAT it is,
 *  so any drift fails here with the exact job that moved.
 *
 *  A deliberate price change means regenerating the snapshot in the same
 *  commit, so the diff shows every price that moved and why.
 * ------------------------------------------------------------------ */

type Row = { w: number; h: number; qty: number; sigs: string[] };

function loadGolden(): Map<string, Row[]> {
  const text = readFileSync(join(process.cwd(), "src/lib/pricing/golden-prices.txt"), "utf8");
  const byFamily = new Map<string, Row[]>();
  let current: Row[] | null = null;
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    if (line.startsWith("# ")) {
      current = [];
      byFamily.set(line.slice(2).trim(), current);
      continue;
    }
    const [head, ...sigs] = line.split("|");
    const [w, h, qty] = head!.split(",").map(Number);
    current!.push({ w: w!, h: h!, qty: qty!, sigs });
  }
  return byFamily;
}

describe("golden prices — the refactor must not move a single price", () => {
  const golden = loadGolden();

  it("covers every seeded family and the whole grid", () => {
    expect(golden.size).toBeGreaterThanOrEqual(10);
    for (const rows of golden.values())
      expect(rows.length).toBe(GOLDEN_SIZES.length * GOLDEN_QTY.length);
  });

  for (const [name, rows] of golden) {
    it(`${name}: every quote matches the snapshot`, () => {
      const fix = liveFixture(name);
      const prepared = prepareFamily(fix.cfg, fix.anchors, fix.validated);
      const drift: string[] = [];
      for (const { w, h, qty, sigs } of rows) {
        for (let o = 0; o < GOLDEN_OPTS.length; o++) {
          /* a single stored signature means every option variant matched it */
          const want = sigs.length === 1 ? sigs[0]! : sigs[o]!;
          const got = signature(
            priceJob(fix.cfg, fix.anchors, w, h, qty, fix.validated, {
              ...(GOLDEN_OPTS[o] as JobOptions),
              prepared,
            }),
          );
          if (got !== want) drift.push(`${w}×${h} ×${qty} opt${o}: ${want} → ${got}`);
        }
      }
      expect(drift.slice(0, 10)).toEqual([]);
    });
  }
});
