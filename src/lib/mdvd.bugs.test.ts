import { describe, expect, it } from "bun:test";
import {
  prepareFamily,
  priceJob,
  validateFamilyPricing,
  validateSuggestion,
  type FamilyPricing,
} from "./mdvd";
import { baseFamilyPricing } from "./pricing-defaults";
import { famFixture, mkAnchor } from "./pricing-fixtures";
import { parseNumber } from "./parse";

/* ------------------------------------------------------------------ *
 *  Named regressions — the seven spec bugs (Appendix A) must never
 *  come back.
 * ------------------------------------------------------------------ */

describe("bug1_flyers_never_per_m2", () => {
  const fix = famFixture("פליירים");

  it("flyers run the anchor-curve engine, not per-m²", () => {
    expect(fix.cfg.engine).toBe("anchor_curve");
  });

  it("10×15 × 5000 prices off the curve (~₪500), not ₪2,652", () => {
    const t = priceJob(fix.cfg, fix.anchors, 10, 15, 5000, fix.validated)!.total;
    expect(t).toBeGreaterThanOrEqual(500);
    expect(t).toBeLessThanOrEqual(700);
  });

  it("A5 × 50 → ₪85 (was ₪8 under the per-m² formula)", () => {
    expect(priceJob(fix.cfg, fix.anchors, 15, 21, 50, fix.validated)!.total).toBe(85);
  });

  it("a flyers config mutated back to per_m2 is rejected by validateFamilyPricing", () => {
    const bad: FamilyPricing = { ...fix.cfg, engine: "per_m2" };
    /* the curve carries qty anchors up to 20,000 — per_m2 is forbidden */
    expect(validateFamilyPricing(bad, []).length).toBeGreaterThan(0);
  });
});

describe("bug2_no_backward_extrapolation", () => {
  it("stickers 5×5: qty10 never cheaper than qty1 (min-free variant of the seed)", () => {
    const fix = famFixture("מדבקות", { minOrderQty: 0 });
    const q1 = priceJob(fix.cfg, fix.anchors, 5, 5, 1, fix.validated)!.total;
    const q10 = priceJob(fix.cfg, fix.anchors, 5, 5, 10, fix.validated)!.total;
    expect(q10).toBeGreaterThanOrEqual(q1);
    expect(q1).toBeGreaterThan(0);
  });

  it("curve starting at qty 500: short-run base is P(100) via flat-below-first, not P(500) scaled backwards", () => {
    const cfg = baseFamilyPricing({
      engine: "anchor_curve",
      shortRunPct: 0.7,
      shortRunRefQty: 100,
      sizeBuckets: [
        {
          id: "B",
          maxW: 10,
          maxH: 10,
          factor: null,
          base100: null,
          quoteOnly: false,
          includes: [],
        },
      ],
      curveAnchors: [
        { size: "B", qty: 500, price: 1000 },
        { size: "B", qty: 1000, price: 1500 },
      ],
    });
    const t = (q: number) => priceJob(cfg, [], 5, 5, q, [])!.total;
    expect(t(10)).toBeGreaterThanOrEqual(t(1));
    /* flat-below-first: P(100) = 1000, so t(1) = 0.7 × 1000 = 700 */
    expect(t(1)).toBe(700);
    /* the whole ramp stays below the first explicit curve point */
    expect(t(99)).toBe(997);
    expect(t(99)).toBeLessThan(1000);
  });
});

describe("bug3_cummax_closes_wide_gap", () => {
  const cfg = baseFamilyPricing({
    engine: "anchor_curve",
    sizeBuckets: [
      { id: "B", maxW: 10, maxH: 10, factor: null, base100: null, quoteOnly: false, includes: [] },
    ],
    curveAnchors: [
      { size: "B", qty: 300, price: 348 },
      { size: "B", qty: 500, price: 220 }, // wide-gap inversion (the 300=₪348 / 500=₪220 case)
      { size: "B", qty: 1000, price: 500 },
    ],
  });

  it("prepareFamily raises 500 → ₪348 and records a qty_cummax adjustment", () => {
    const prepared = prepareFamily(cfg, []);
    const adj = prepared.adjustments.find(
      (a) => a.reason === "qty_cummax" && a.bucket === "B" && a.qty === 500,
    );
    expect(adj).toBeDefined();
    expect(adj!.from).toBe(220);
    expect(adj!.to).toBe(348);
    const pts = prepared.byBucket.get("B")!;
    expect(pts.find((p) => p.qty === 500)!.price).toBe(348);
  });

  it("priceJob(qty 500) ≥ priceJob(qty 300)", () => {
    const t300 = priceJob(cfg, [], 5, 5, 300, [])!.total;
    const t500 = priceJob(cfg, [], 5, 5, 500, [])!.total;
    expect(t500).toBeGreaterThanOrEqual(t300);
  });
});

describe("bug4_ramp_ref_is_100", () => {
  /* smallest explicit point at qty 500 — the old code stretched the
     short-run floor across 1–499 off that anchor; the fix references
     qty 100 (flat-below-first ⇒ P(100) = P(500) = 1000). */
  const cfg = baseFamilyPricing({
    engine: "anchor_curve",
    shortRunPct: 0.7,
    shortRunRefQty: 100,
    sizeBuckets: [
      { id: "B", maxW: 10, maxH: 10, factor: null, base100: null, quoteOnly: false, includes: [] },
    ],
    curveAnchors: [
      { size: "B", qty: 500, price: 1000 },
      { size: "B", qty: 1000, price: 1400 },
    ],
  });
  const t = (q: number) => priceJob(cfg, [], 5, 5, q, [])!.total;

  it("qty1 = round(1000 × 0.7) = ₪700", () => {
    expect(t(1)).toBe(700);
  });

  it("qty50 rides the 1…100 ramp (≈0.848 × 1000 = ₪848), not a 1…499 stretch (≈₪729)", () => {
    const q50 = t(50);
    /* new: 0.7 + 0.3 × 49/99 = 0.8485 → ₪848; old bug: 0.7 + 0.3 × 49/499 ≈ 0.729 → ₪729 */
    expect(q50).toBe(848);
    expect(q50).toBeGreaterThanOrEqual(700);
    expect(q50).toBeLessThanOrEqual(1000);
  });
});

describe("bug5_floor_precedence (size-floor first, qty-cummax last)", () => {
  /* nested buckets: B (10×10) dominates A (5×5). B is cheaper than A at
     qty 100/200 (size inversions) AND has its own qty inversion at 300. */
  const cfg = baseFamilyPricing({
    engine: "anchor_curve",
    sizeBuckets: [
      { id: "A", maxW: 5, maxH: 5, factor: null, base100: null, quoteOnly: false, includes: [] },
      { id: "B", maxW: 10, maxH: 10, factor: null, base100: null, quoteOnly: false, includes: [] },
    ],
    curveAnchors: [
      { size: "A", qty: 100, price: 100 },
      { size: "A", qty: 200, price: 150 },
      { size: "B", qty: 100, price: 90 }, // below A@100 → size_floor
      { size: "B", qty: 200, price: 140 }, // below A@200 → size_floor
      { size: "B", qty: 300, price: 120 }, // qty inversion → qty_cummax (after the floor)
    ],
  });

  it("size_floor adjustments exist for B, then qty_cummax ran after", () => {
    const prepared = prepareFamily(cfg, []);
    const floor100 = prepared.adjustments.find(
      (a) => a.reason === "size_floor" && a.bucket === "B" && a.qty === 100,
    );
    const floor200 = prepared.adjustments.find(
      (a) => a.reason === "size_floor" && a.bucket === "B" && a.qty === 200,
    );
    const cummax300 = prepared.adjustments.find(
      (a) => a.reason === "qty_cummax" && a.bucket === "B" && a.qty === 300,
    );
    expect(floor100).toBeDefined();
    expect(floor100!.from).toBe(90);
    expect(floor100!.to).toBe(100);
    expect(floor200).toBeDefined();
    expect(floor200!.from).toBe(140);
    expect(floor200!.to).toBe(150);
    /* cummax runs LAST — it lifts 120 to the already-floored 150, not to 140 */
    expect(cummax300).toBeDefined();
    expect(cummax300!.from).toBe(120);
    expect(cummax300!.to).toBe(150);
  });

  it("final curves are monotone both ways (qty within bucket, size across buckets)", () => {
    const prepared = prepareFamily(cfg, []);
    for (const [, pts] of prepared.byBucket) {
      for (let i = 1; i < pts.length; i++)
        expect(pts[i]!.price).toBeGreaterThanOrEqual(pts[i - 1]!.price);
    }
    const a = prepared.byBucket.get("A")!;
    const b = prepared.byBucket.get("B")!;
    for (const pa of a) {
      const pb = b.find((p) => p.qty === pa.qty);
      if (pb) expect(pb.price).toBeGreaterThanOrEqual(pa.price);
    }
  });
});

describe("bug6_quantity_parsing (Senzey comma/dot thousands)", () => {
  it('"10.000" / "10,000" / "15.000" all parse as thousands', () => {
    expect(parseNumber("10.000")).toBe(10000);
    expect(parseNumber("10,000")).toBe(10000);
    expect(parseNumber("15.000")).toBe(15000);
  });
  it("the Senzey fixture quantities (ids 92 / 1050 / 1051 / 585 name forms)", () => {
    expect(parseNumber("20.000")).toBe(20000); // senzey 322
    expect(parseNumber("10,000")).toBe(10000); // senzey 1061
    expect(parseNumber("2.000")).toBe(2000); // senzey 585 → 2000-tier
  });
});

describe("bug7_adopt_validation (pointer — full coverage in validate-suggestion.test.ts)", () => {
  it("validateSuggestion rejects a suggestion that undercuts a bigger-quantity anchor", () => {
    const cfg = baseFamilyPricing({ engine: "anchor_curve" });
    const anchors = [mkAnchor(10, 10, 300, 348)];
    /* adopting ₪200 for 500 units would undercut 300 units at ₪348 */
    const check = validateSuggestion({ w: 10, h: 10, qty: 500, suggested: 200, cfg, anchors });
    expect(check.ok).toBe(false);
    expect(check.reason).toContain("מונוטוניות כמות");
  });
});

/* ------------------------------------------------------------------ *
 *  bug8 — מדבקות priced size-blind above 9 ס״מ.
 *  Reported from the calculator: 115×8 ס״מ × 10 יח׳ quoted ₪136
 *  (₪13.60/unit) because every size ≥10 ס״מ fell into the `10+` catch-all
 *  bucket at ₪187/100 יח׳, while the verified catalog sells a single
 *  17×56 for ₪95. The unit does not fit the 42×29 printable sheet at all,
 *  so the cost estimate was ₪0 and the below-cost guard could never fire.
 * ------------------------------------------------------------------ */

describe("bug8_stickers_price_must_follow_size", () => {
  const fix = famFixture("מדבקות");
  const q = (w: number, h: number, qty: number) =>
    priceJob(fix.cfg, fix.anchors, w, h, qty, fix.validated)!;

  it("the reported job is priced per m², not from the catch-all bucket", () => {
    const j = q(115, 8, 10);
    expect(j.bindingRule).toBe("large_format");
    /* ₪94.50 per unit × the 0.9 quantity exponent (10^0.9 = ×7.94) */
    expect(j.total).toBe(750);
    expect(j.total).not.toBe(136);
  });

  it("a unit that does not fit the sheet still gets a real production cost", () => {
    const j = q(115, 8, 10);
    expect(j.unitsPerSheet).toBe(0);
    expect(j.cost).toBeGreaterThan(0);
    expect(j.costFloorValue).toBeGreaterThan(0);
  });

  it("large format is exempt from the 10-unit minimum and matches the catalog", () => {
    const j = q(17, 56, 1);
    expect(j.belowMinOrder).toBe(false);
    /* verified catalog rows 17×56 / 20×70 / 50×70 are all ₪95–100 at qty 1
       (20×30 fits the sheet, so it stays on the min-order-10 sheet path) */
    expect(j.total).toBe(95);
  });

  /* --- מקדם כמות (qty_exponent) on the large-format path ----------------- */

  it("the quantity exponent discounts a run without touching a single unit", () => {
    expect(fix.cfg.qtyExponentPinned).toBe(true);
    expect(fix.cfg.qtyExponent).toBe(0.9);
    /* 1^e = 1 — this is why an exponent was chosen over a flat percentage:
       every verified qty-1 catalog row keeps matching at any exponent. */
    for (const [w, h] of [
      [17, 56],
      [20, 70],
      [50, 70],
    ] as [number, number][]) {
      expect(q(w, h, 1).total).toBe(95);
      expect(q(w, h, 1).qtyFactor).toBe(1);
    }
    const ten = q(115, 8, 10);
    expect(ten.qtyFactor).toBeCloseTo(10 ** 0.9, 6);
    expect(ten.total).toBeLessThan(10 * q(115, 8, 1).total);
  });

  it("totals still rise strictly with quantity under the exponent", () => {
    let prev = 0;
    for (const qty of [1, 5, 10, 25, 100]) {
      const j = q(115, 8, qty);
      expect(j.monotoneViolation).toBe(false);
      expect(j.total).toBeGreaterThan(prev);
      prev = j.total;
    }
  });

  it("an unpinned family stays linear", () => {
    const linear = famFixture("מדבקות", { qtyExponentPinned: false, qtyExponent: 1 });
    const ten = priceJob(linear.cfg, linear.anchors, 115, 8, 10, linear.validated)!;
    /* qtyFactor reports the multiplier actually applied to the per-unit price,
       so an unpinned family bills the full 10 units — ₪94.50 × 10 = ₪945.
       (Rounding lands on the total, so this is not 10 × the rounded ₪95.) */
    expect(ten.qtyFactor).toBe(10);
    expect(ten.total).toBe(945);
    expect(ten.unit).toBeCloseTo(94.5, 6);
    /* and the seeded 0.9 exponent must actually undercut that */
    expect(q(115, 8, 10).total).toBeLessThan(ten.total);
  });

  it("the sheet path is untouched by the exponent", () => {
    /* qty_multipliers already carry the quantity discount there — applying the
       exponent on top would discount twice. */
    expect(q(3, 3, 100).qtyFactor).toBe(1);
    expect(q(3, 3, 100).total).toBe(115);
    expect(q(24, 6, 500).total).toBe(375);
  });

  it("a pinned exponent outside 0.2–1.0 is a config error", () => {
    const typo = famFixture("מדבקות", { qtyExponentPinned: true, qtyExponent: 9 });
    expect(validateFamilyPricing(typo.cfg, []).join(" ")).toContain("מקדם כמות");
    expect(validateFamilyPricing(fix.cfg, [])).toEqual([]);
  });

  it("the 10-unit minimum still applies to sheet-printable sizes", () => {
    expect(q(5, 5, 5).belowMinOrder).toBe(true);
  });

  it("sizes above 9 ס״מ no longer collide on one price", () => {
    const totals = [q(10, 10, 10), q(17, 17, 10), q(20, 30, 10), q(100, 100, 10)].map(
      (j) => j.total,
    );
    expect(new Set(totals).size).toBe(totals.length);
    for (let i = 1; i < totals.length; i++) expect(totals[i]!).toBeGreaterThan(totals[i - 1]!);
  });

  it("17×17 × 80 reproduces the verified catalog row", () => {
    expect(q(17, 17, 80).total).toBe(270);
  });

  it("the approved small and big-rect ladders are untouched", () => {
    expect(q(3, 3, 100).total).toBe(115);
    expect(q(5, 5, 100).total).toBe(126);
    expect(q(9, 9, 100).total).toBe(154);
    expect(q(24, 6, 500).total).toBe(375);
    expect(q(15, 10, 1000).total).toBe(595);
  });

  it("an unbounded catch-all bucket is now a config error", () => {
    const cfg: FamilyPricing = baseFamilyPricing({
      engine: "anchor_curve",
      sizeBuckets: [
        { id: "9", maxW: 9, maxH: 9, factor: null, base100: 154, quoteOnly: false, includes: [] },
        { id: "10+", maxW: 0, maxH: 0, factor: null, base100: 187, quoteOnly: false, includes: [] },
      ],
    });
    expect(validateFamilyPricing(cfg, []).join(" ")).toContain("דלי הסל");
    expect(validateFamilyPricing(fix.cfg, [])).toEqual([]);
  });
});
