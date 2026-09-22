/* ------------------------------------------------------------------ *
 *  repro — prints the client acceptance table (src/lib/client-cases.ts)
 *  as the engine prices it today, against the seeds + the live catalog
 *  rows snapshot. Same numbers as `bun test src/lib/client-cases.test.ts`,
 *  laid out for a human.
 *
 *      bun run scripts/repro/run.ts            # all families
 *      bun run scripts/repro/run.ts מדבקות     # one family
 * ------------------------------------------------------------------ */
import { CLIENT_CASES } from "../../src/lib/client-cases";
import { prepareFamily, priceJob, shekel, type PreparedFamily } from "../../src/lib/mdvd";
import { liveFixture, type FamFixture } from "../../src/lib/pricing-fixtures";

const only = process.argv[2];
const fixtures = new Map<string, { fix: FamFixture; prepared: PreparedFamily }>();
const pad = (s: unknown, n: number) => String(s).padEnd(n);
let last = "";
let mismatches = 0;
for (const c of CLIENT_CASES) {
  if (only && c.family !== only) continue;
  let f = fixtures.get(c.family);
  if (!f) {
    const fix = liveFixture(c.family);
    f = { fix, prepared: prepareFamily(fix.cfg, fix.anchors, fix.validated) };
    fixtures.set(c.family, f);
  }
  if (c.family !== last) {
    console.log(`\n# ${c.family}  (engine ${f.fix.cfg.engine} · catalog_binds ${f.fix.cfg.catalogBinds} · ${f.fix.validated.length} verified rows, ${f.fix.anchors.length} anchors)`);
    last = c.family;
  }
  const j = priceJob(f.fix.cfg, f.fix.anchors, c.w, c.h, c.qty, f.fix.validated, {
    ...(c.opts ?? {}),
    prepared: f.prepared,
  });
  const got = !j
    ? "null"
    : j.overMachine
      ? "blocked"
      : j.noQuote
        ? "quote"
        : j.belowMinOrder
          ? `min ${j.minOrderQty}`
          : shekel(j.total);
  const want = typeof c.want === "number" ? shekel(c.want) : c.want;
  const ok = got === want && (!c.rule || j?.bindingRule === c.rule);
  if (!ok) mismatches++;
  console.log(
    `${ok ? "  " : "✗ "}${pad(`${c.w}×${c.h} ×${c.qty}${c.opts ? " " + JSON.stringify(c.opts) : ""}`, 30)} want ${pad(want, 9)} got ${pad(got, 9)} ${pad(j?.bindingRule ?? "-", 13)} ${c.source}${
      j?.machineNote ? ` | ${j.machineNote}` : ""
    }`,
  );
}
console.log(`\n${mismatches === 0 ? "all cases match" : `${mismatches} mismatch(es)`}`);
process.exit(mismatches === 0 ? 0 : 1);
