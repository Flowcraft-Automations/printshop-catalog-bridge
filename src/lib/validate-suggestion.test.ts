import { describe, expect, it } from "bun:test";
import { validateSuggestion, type JobAnchor } from "./mdvd";
import { baseFamilyPricing } from "./pricing-defaults";
import { mkAnchor } from "./pricing-fixtures";

/* ------------------------------------------------------------------ *
 *  bug #7 — אמץ sanity checks: a suggestion may only be adopted when
 *  it keeps the family's anchor set monotone (qty and size).
 * ------------------------------------------------------------------ */

const HEBREW = /[֐-׿]/;

/** Simple healthy anchor-curve family with a small anchor set. */
const cfg = baseFamilyPricing({ engine: "anchor_curve" });
const anchors: JobAnchor[] = [
  mkAnchor(10, 10, 100, 100),
  mkAnchor(10, 10, 300, 348),
  mkAnchor(10, 10, 500, 400),
  mkAnchor(5, 5, 100, 60),
];

const check = (over: Partial<Parameters<typeof validateSuggestion>[0]> = {}) =>
  validateSuggestion({ w: 10, h: 10, qty: 200, suggested: 200, cfg, anchors, ...over });

describe("validateSuggestion", () => {
  it("accepts an in-curve suggestion", () => {
    /* ₪200 at qty 200 sits between 100=₪100 and 300=₪348 */
    expect(check().ok).toBe(true);
  });

  it("rejects NaN / Infinity / 0 / negative suggestions", () => {
    for (const bad of [NaN, Infinity, -Infinity, 0, -5]) {
      const r = check({ suggested: bad });
      expect(r.ok).toBe(false);
      expect(r.reason).toBeTruthy();
    }
  });

  it("rejects a qty-monotonicity break (₪200 at qty 500 vs anchor 300 = ₪348)", () => {
    const r = validateSuggestion({
      w: 10,
      h: 10,
      qty: 500,
      suggested: 200,
      cfg,
      anchors: [mkAnchor(10, 10, 300, 348)],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("מונוטוניות כמות");
  });

  it("rejects the reverse break (₪500 at qty 100 vs anchor 500 = ₪348)", () => {
    const r = validateSuggestion({
      w: 10,
      h: 10,
      qty: 100,
      suggested: 500,
      cfg,
      anchors: [mkAnchor(10, 10, 500, 348)],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("מונוטוניות כמות");
  });

  it("rejects a size break at equal qty (dominated smaller anchor more expensive)", () => {
    const r = validateSuggestion({
      w: 10,
      h: 10,
      qty: 100,
      suggested: 100,
      cfg,
      anchors: [mkAnchor(5, 5, 100, 300)], // smaller size, same qty, ₪300 > ₪100
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("מונוטוניות גודל");
  });

  it("rejects any suggestion under a per_m2 config with qty anchors above 500", () => {
    const bad = baseFamilyPricing({ engine: "per_m2" });
    const r = validateSuggestion({
      w: 10,
      h: 10,
      qty: 100,
      suggested: 100,
      cfg: bad,
      anchors: [mkAnchor(10, 10, 1000, 500)],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("לפי מ״ר");
  });

  it("rejects a legacy (pre-v3) config", () => {
    const legacy = baseFamilyPricing({ legacy: true });
    const r = validateSuggestion({
      w: 10,
      h: 10,
      qty: 100,
      suggested: 100,
      cfg: legacy,
      anchors: [],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("ישנה");
  });

  it("epsilon boundary: a bigger-qty suggestion at the SAME price as a smaller anchor is accepted", () => {
    const r = validateSuggestion({
      w: 10,
      h: 10,
      qty: 500,
      suggested: 348,
      cfg,
      anchors: [mkAnchor(10, 10, 300, 348)],
    });
    expect(r.ok).toBe(true);
  });

  it("proposed-price path (no job) is validated identically", () => {
    const withJob = validateSuggestion({
      w: 10,
      h: 10,
      qty: 500,
      suggested: 200,
      job: null,
      cfg,
      anchors: [mkAnchor(10, 10, 300, 348)],
    });
    const noJob = validateSuggestion({
      w: 10,
      h: 10,
      qty: 500,
      suggested: 200,
      cfg,
      anchors: [mkAnchor(10, 10, 300, 348)],
    });
    expect(withJob).toEqual(noJob);
    expect(noJob.ok).toBe(false);
  });

  it("validated catalog prices participate in the monotonicity pool", () => {
    const r = validateSuggestion({
      w: 10,
      h: 10,
      qty: 500,
      suggested: 200,
      cfg,
      anchors: [],
      validated: [mkAnchor(10, 10, 300, 348)],
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain("מונוטוניות כמות");
  });

  it("every rejection reason is a non-empty Hebrew string", () => {
    const rejected = [
      check({ suggested: NaN }),
      check({ suggested: 0 }),
      validateSuggestion({
        w: 10,
        h: 10,
        qty: 500,
        suggested: 200,
        cfg,
        anchors: [mkAnchor(10, 10, 300, 348)],
      }),
      validateSuggestion({
        w: 10,
        h: 10,
        qty: 100,
        suggested: 100,
        cfg,
        anchors: [mkAnchor(5, 5, 100, 300)],
      }),
      validateSuggestion({
        w: 10,
        h: 10,
        qty: 100,
        suggested: 100,
        cfg: baseFamilyPricing({ legacy: true }),
        anchors: [],
      }),
      validateSuggestion({
        w: 10,
        h: 10,
        qty: 100,
        suggested: 100,
        cfg: baseFamilyPricing({ engine: "per_m2" }),
        anchors: [mkAnchor(10, 10, 1000, 500)],
      }),
    ];
    for (const r of rejected) {
      expect(r.ok).toBe(false);
      expect(typeof r.reason).toBe("string");
      expect(r.reason!.length).toBeGreaterThan(0);
      expect(HEBREW.test(r.reason!)).toBe(true);
    }
  });
});
