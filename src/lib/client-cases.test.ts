import { describe, expect, it } from "bun:test";
import { CLIENT_CASES } from "./client-cases";
import { prepareFamily, priceJob, type PreparedFamily } from "./mdvd";
import { liveFixture, type FamFixture } from "./pricing-fixtures";

/* ------------------------------------------------------------------ *
 *  The client's own cases (see client-cases.ts) against the seeds and the
 *  live catalog rows — exactly what the app prices with once the
 *  families migration is applied.
 * ------------------------------------------------------------------ */

const fixtures = new Map<string, { fix: FamFixture; prepared: PreparedFamily }>();
function fixtureFor(family: string) {
  let f = fixtures.get(family);
  if (!f) {
    const fix = liveFixture(family);
    f = { fix, prepared: prepareFamily(fix.cfg, fix.anchors, fix.validated) };
    fixtures.set(family, f);
  }
  return f;
}

describe("client cases (2026-09-22)", () => {
  for (const c of CLIENT_CASES) {
    const label = `${c.family} ${c.w}×${c.h} ×${c.qty}${c.opts ? " " + JSON.stringify(c.opts) : ""} → ${
      typeof c.want === "number" ? "₪" + c.want : c.want
    }${c.rule ? ` (${c.rule})` : ""}`;
    it(label, () => {
      const { fix, prepared } = fixtureFor(c.family);
      const j = priceJob(fix.cfg, fix.anchors, c.w, c.h, c.qty, fix.validated, {
        ...(c.opts ?? {}),
        prepared,
      });
      expect(j).not.toBeNull();
      if (!j) return;
      if (c.want === "blocked") {
        expect({ overMachine: j.overMachine, total: j.total }).toEqual({ overMachine: true, total: 0 });
        return;
      }
      if (c.want === "quote") {
        expect({ noQuote: j.noQuote, total: j.total }).toEqual({ noQuote: true, total: 0 });
        return;
      }
      const got = { total: j.total, rule: c.rule ? j.bindingRule : undefined, mono: j.monotoneViolation };
      expect(got).toEqual({ total: c.want, rule: c.rule, mono: false });
    });
  }
});
