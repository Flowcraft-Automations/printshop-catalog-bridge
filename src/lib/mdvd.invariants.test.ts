import { describe, expect, it } from "bun:test";
import {
  BINDING_LABEL,
  prepareFamily,
  priceJob,
  resolveBucket,
  roundPrice,
  validateFamilyPricing,
  type BindingRule,
  type FamilyPricing,
} from "./mdvd";
import { baseFamilyPricing, SPEC_FAMILY_CONFIGS, VAT_FACTOR } from "./pricing-defaults";
import { famFixture, mkAnchor } from "./pricing-fixtures";

/* ------------------------------------------------------------------ *
 *  Engine invariants over every seeded family (Appendix A):
 *  - curves are quantity-monotone after prepareFamily
 *  - totals never decrease with quantity (approved qty-tier packs are
 *    the one sanctioned exception — they reset the running max)
 *  - the runtime monotonicity assertion never fires
 *  - every quoted job names a known binding rule
 * ------------------------------------------------------------------ */

const QTY_GRID = [
  1, 5, 10, 22, 50, 99, 100, 101, 150, 250, 499, 500, 501, 750, 1000, 2000, 5000, 10000,
];

/** Representative sizes per family (valid for that family's config). */
const SWEEP_SIZES: Record<string, [number, number][]> = {
  פליירים: [
    [15, 21],
    [10, 15],
    [21, 29.7],
  ],
  מדבקות: [
    [3, 3],
    [5, 9],
    [14, 11],
    [17, 17],
    [20, 30],
    [115, 8],
    [100, 100],
  ],
  /* 120×80 carries the approved 10-pack qty tier */
  שמשונית: [
    [60, 40],
    [100, 90],
    [120, 80],
  ],
  "שלטי PVC": [
    [30, 90],
    [60, 100],
    [80, 200],
  ],
  /* 40×40 and 120×80 carry the approved 10-pack qty tiers */
  פוליגל: [
    [40, 40],
    [100, 80],
    [120, 80],
  ],
  קנבס: [
    [20, 20],
    [70, 140],
    [50, 125],
  ],
  זכוכית: [
    [20, 30],
    [100, 70],
    [120, 80],
  ],
  קאפה: [
    [50, 70],
    [90, 90],
    [120, 120],
  ],
  /* unit_floor: most quantities are noQuote by design */
  חשבוניות: [
    [14.8, 21],
    [21, 29.7],
  ],
  פנקסים: [[14.8, 21]],
};

/** the size resolves to an includes-only bucket — a separately approved ladder */
function isException(cfg: FamilyPricing, w: number, h: number): boolean {
  const b = resolveBucket(cfg.sizeBuckets, w, h);
  return !!b && b.maxW <= 0 && b.maxH <= 0 && b.includes.length > 0;
}

for (const name of Object.keys(SPEC_FAMILY_CONFIGS)) {
  describe(`invariants · ${name}`, () => {
    const { cfg, anchors, validated } = famFixture(name);
    const prepared = prepareFamily(cfg, anchors);

    it("prepareFamily: every bucket curve is nondecreasing in qty", () => {
      for (const [, pts] of prepared.byBucket) {
        for (let i = 1; i < pts.length; i++) {
          expect(pts[i]!.qty).toBeGreaterThan(pts[i - 1]!.qty);
          expect(pts[i]!.price).toBeGreaterThanOrEqual(pts[i - 1]!.price);
        }
      }
    });

    /* Size monotonicity: if BOTH dimensions of size B are ≥ size A, B may never
       quote below A at the same quantity. Sizes are only partially ordered
       (100×70 is not "bigger" than 90×90), so only dominated pairs are
       compared. This is the invariant the מדבקות `10+` catch-all broke —
       every size from 10 ס״מ to the production cap quoted the same number. */
    it("size sweep: a dominated size never costs more than the size containing it", () => {
      const sizes = SWEEP_SIZES[name] ?? [];
      for (const qty of [10, 100, 1000]) {
        for (const [aw, ah] of sizes) {
          for (const [bw, bh] of sizes) {
            const dominated =
              Math.max(aw, ah) <= Math.max(bw, bh) && Math.min(aw, ah) <= Math.min(bw, bh);
            if (!dominated || (aw === bw && ah === bh)) continue;
            const a = priceJob(cfg, anchors, aw, ah, qty, validated, { prepared });
            const b = priceJob(cfg, anchors, bw, bh, qty, validated, { prepared });
            if (!a || !b) continue;
            if (a.noQuote || a.belowMinOrder || a.overMachine || a.total === 0) continue;
            if (b.noQuote || b.belowMinOrder || b.overMachine || b.total === 0) continue;
            /* an approved qty-tier pack is priced per size, not per area */
            if (a.bindingRule === "tier" || b.bindingRule === "tier") continue;
            /* includes-only buckets are separately approved ladders for a
               different product (מדבקות 5×9 is not comparable to the circles);
               prepareFamily's size floor exempts them for the same reason. */
            if (
              [
                [aw, ah],
                [bw, bh],
              ].some(([pw, ph]) => isException(cfg, pw, ph))
            )
              continue;
            expect({ size: `${bw}×${bh}`, qty, total: b.total }).toEqual({
              size: `${bw}×${bh}`,
              qty,
              total: Math.max(a.total, b.total),
            });
          }
        }
      }
    });

    for (const [w, h] of SWEEP_SIZES[name] ?? []) {
      it(`qty sweep @ ${w}×${h}: totals nondecreasing, no monotone violations, binding rule labeled`, () => {
        const quoted: { qty: number; total: number; rule: BindingRule }[] = [];
        for (const qty of QTY_GRID) {
          const job = priceJob(cfg, anchors, w, h, qty, validated, { prepared });
          expect(job).not.toBeNull();
          if (!job) continue;
          if (job.noQuote || job.belowMinOrder || job.overMachine || job.total === 0) continue;
          expect(job.monotoneViolation).toBe(false);
          expect(Object.keys(BINDING_LABEL)).toContain(job.bindingRule);
          expect(job.label.startsWith(BINDING_LABEL[job.bindingRule])).toBe(true);
          quoted.push({ qty, total: job.total, rule: job.bindingRule });
        }
        /* monotone across quoted points; an approved qty-tier pack (e.g.
           שמשונית/פוליגל ×10 = ₪470) may legally undercut the per-unit
           price just below it, so a tier point resets the running max. */
        let running = 0;
        for (const p of quoted) {
          if (p.rule === "tier") {
            running = p.total;
            continue;
          }
          expect(p.total).toBeGreaterThanOrEqual(running);
          running = Math.max(running, p.total);
        }
      });
    }
  });
}

/* ------------------------------------------------------------------ *
 *  Non-quoted jobs carry custom labels and total 0
 * ------------------------------------------------------------------ */

describe("blocked / min-order / no-quote jobs", () => {
  it("קנבס over the 150×200 cap → machine-blocked, total 0", () => {
    const { cfg, anchors, validated } = famFixture("קנבס");
    const job = priceJob(cfg, anchors, 160, 210, 1, validated)!;
    expect(job.overMachine).toBe(true);
    expect(job.total).toBe(0);
    expect(job.label).toContain("לא ניתן לייצור");
  });

  it("below minOrderQty → total 0 with a custom min-order label", () => {
    const cfg = baseFamilyPricing({
      engine: "size_ladder",
      minOrderQty: 10,
      sizeLadder: [{ w: 10, h: 10, price: 50 }],
    });
    const job = priceJob(cfg, [], 10, 10, 5, [])!;
    expect(job.belowMinOrder).toBe(true);
    expect(job.total).toBe(0);
    expect(job.label).toContain("מינימום הזמנה");
  });

  it("unit_floor with no matching format → noQuote, total 0", () => {
    const { cfg, anchors, validated } = famFixture("חשבוניות");
    const job = priceJob(cfg, anchors, 21, 29.7, 15, validated)!;
    expect(job.noQuote).toBe(true);
    expect(job.total).toBe(0);
  });
});

/* ------------------------------------------------------------------ *
 *  per_m2 guard: qty anchors above 500 make the config invalid
 * ------------------------------------------------------------------ */

describe("per_m2 guard", () => {
  it("per_m2 + a qty-1000 anchor → validateFamilyPricing error + priceJob configError", () => {
    const { cfg } = famFixture("שמשונית");
    const badAnchors = [mkAnchor(100, 100, 1000, 500)];
    const errors = validateFamilyPricing(cfg, badAnchors);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("לפי מ״ר");

    const job = priceJob(cfg, badAnchors, 60, 40, 1, [])!;
    expect(job.configError).toBeTruthy();
    expect(job.configError).toContain("לפי מ״ר");
  });
});

/* ------------------------------------------------------------------ *
 *  Tiered rounding
 * ------------------------------------------------------------------ */

describe("roundPrice", () => {
  const CASES: [number, BindingRule | undefined, number][] = [
    [17.3, undefined, 17.5], // < ₪20 → nearest 0.5
    [19.74, undefined, 19.5],
    [99.4, undefined, 99], // < ₪100 → nearest ₪1
    [101, undefined, 100], // ≥ ₪100 → nearest ₪5
    [102.6, undefined, 105],
    [142.8, "short_run", 143], // short-run ramp → nearest ₪1
    [0, undefined, 0],
  ];
  for (const [v, rule, expected] of CASES) {
    it(`${v}${rule ? ` (${rule})` : ""} → ${expected}`, () => {
      expect(roundPrice(v, rule)).toBe(expected);
    });
  }
});

/* ------------------------------------------------------------------ *
 *  VAT comparison helper
 * ------------------------------------------------------------------ */

describe("VAT", () => {
  it("VAT_FACTOR is 1.18", () => {
    expect(VAT_FACTOR).toBe(1.18);
  });
  it("ex-VAT competitor price × 1.18 (365 → ≈430.7)", () => {
    expect(365 * VAT_FACTOR).toBeCloseTo(430.7, 1);
  });
});
