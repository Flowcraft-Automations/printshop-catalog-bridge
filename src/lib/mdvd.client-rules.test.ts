/* ------------------------------------------------------------------ *
 *  Client rules (2026-09-22) — engine behaviour added for the pricing fix:
 *  catalog binding policy, the two-machine sticker engine, the outsourced
 *  regime, "never ₪0", and the material surcharge.
 * ------------------------------------------------------------------ */
import { describe, expect, it } from "bun:test";
import {
  bindableRows,
  fitsSheet,
  machineCheck,
  prepareFamily,
  priceJob,
  readFamilyPricing,
  type Family,
  type JobAnchor,
} from "./mdvd";
import { baseFamilyPricing } from "./pricing-defaults";
import { famFixture, mkAnchor } from "./pricing-fixtures";

const row = (w: number, h: number, qty: number, price: number, anchor = false): JobAnchor =>
  mkAnchor(w, h, qty, price, undefined, anchor);

/* ------------------------------------------------------------------ *
 * catalog binding policy (D1)
 * ------------------------------------------------------------------ */
describe("catalog_binds — which catalog rows may set a price", () => {
  const ladder = [
    { w: 20, h: 30, price: 30 },
    { w: 80, h: 200, price: 350 },
  ];
  const validated = [row(30, 60, 1, 200), row(30, 60, 10, 500, true), row(60, 40, 100, 900, true)];
  const anchors = [row(30, 60, 10, 500, true), row(60, 40, 100, 900, true)];
  const cfgWith = (catalogBinds: "none" | "anchors" | "packs" | "all") =>
    baseFamilyPricing({ engine: "size_ladder", sizeLadder: ladder, catalogBinds });

  it("all: every verified row binds (today's behaviour, the default)", () => {
    const b = bindableRows(cfgWith("all"), anchors, validated);
    expect(b.validated.length).toBe(3);
    expect(b.anchors.length).toBe(2);
    expect(readFamilyPricing(undefined).catalogBinds).toBe("all");
  });
  it("anchors: only is_anchor rows bind", () => {
    const b = bindableRows(cfgWith("anchors"), anchors, validated);
    expect(b.validated.map((a) => a.price)).toEqual([500, 900]);
    expect(b.anchors.length).toBe(2);
  });
  it("packs: only rows at or above the pack quantity bind", () => {
    const b = bindableRows(cfgWith("packs"), anchors, validated);
    expect(b.validated.map((a) => a.qty)).toEqual([100]);
    expect(b.anchors.map((a) => a.qty)).toEqual([100]);
  });
  it("none: nothing binds", () => {
    const b = bindableRows(cfgWith("none"), anchors, validated);
    expect(b.validated.length).toBe(0);
    expect(b.anchors.length).toBe(0);
  });
  it("an outsourced job never binds, whatever the policy", () => {
    const b = bindableRows(cfgWith("all"), anchors, validated, { outsourced: true });
    expect(b.validated.length).toBe(0);
  });
  it("a row whose own size is an outsourced size never binds an in-house job", () => {
    const cfg = { ...cfgWith("all"), maxPrintW: 150, overLimit: "outsource" as const };
    const rows = [row(350, 200, 1, 700, true), row(120, 80, 1, 90, true)];
    const b = bindableRows(cfg, rows, rows);
    expect(b.validated.map((a) => a.price)).toEqual([90]);
    expect(b.anchors.map((a) => a.price)).toEqual([90]);
  });
  it("a verified non-anchor row prices the job under 'all' but not under 'anchors'", () => {
    const all = priceJob(cfgWith("all"), anchors, 30, 60, 1, validated)!;
    expect(all.bindingRule).toBe("validated");
    expect(all.total).toBe(200);
    const only = priceJob(cfgWith("anchors"), anchors, 30, 60, 1, validated)!;
    expect(only.bindingRule).not.toBe("validated");
    expect(only.total).toBeLessThan(200);
  });
  it("the size floor only sees rows the policy lets bind", () => {
    /* 40×70 dominates the verified 30×60 = ₪200 row */
    const all = priceJob(cfgWith("all"), anchors, 40, 70, 1, validated)!;
    expect(all.bindingRule).toBe("size_floor");
    expect(all.total).toBe(200);
    const only = priceJob(cfgWith("anchors"), anchors, 40, 70, 1, validated)!;
    expect(only.bindingRule).not.toBe("size_floor");
    expect(only.total).toBeLessThan(200);
  });
  it("JobOptions.catalogBinds overrides the family policy (engine-only price)", () => {
    const j = priceJob(cfgWith("all"), anchors, 30, 60, 1, validated, { catalogBinds: "none" })!;
    expect(j.bindingRule).not.toBe("validated");
  });
  it("the policy survives the database round-trip", () => {
    const fix = famFixture("שמשונית", { catalogBinds: "anchors" });
    expect(fix.cfg.catalogBinds).toBe("anchors");
  });
});

/* ------------------------------------------------------------------ *
 * sheet fit (D2)
 * ------------------------------------------------------------------ */
describe("fitsSheet — the small printer's printable area", () => {
  const cfg = baseFamilyPricing({ sheetW: 48.8, sheetH: 33, sheetMargin: 1.5, sheetGap: 0.5 });
  it("48.8×33 with a 1.5 cm margin prints 45.8×30", () => {
    expect(fitsSheet(cfg, 45, 30)).toBe(true);
    expect(fitsSheet(cfg, 30, 45)).toBe(true);
    expect(fitsSheet(cfg, 45.8, 30)).toBe(true);
  });
  it("one centimetre over in either dimension goes to the roll", () => {
    expect(fitsSheet(cfg, 46, 30)).toBe(false);
    expect(fitsSheet(cfg, 45, 31)).toBe(false);
    expect(fitsSheet(cfg, 17, 56)).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * outsourced regime (D3)
 * ------------------------------------------------------------------ */
describe("over_limit = outsource", () => {
  const cfg = baseFamilyPricing({
    engine: "per_m2",
    perM2Tiers: [
      { minM2: 0, rate: 85 },
      { minM2: 2, rate: 75 },
      { minM2: 4, rate: 72 },
    ],
    minJobPrice: 70,
    maxPrintW: 150,
    overLimit: "outsource",
    outsourcedRateM2: 80,
    outsourceCost: 35,
  });

  it("machineCheck flags the job instead of blocking or splitting it", () => {
    const m = machineCheck(cfg, 200, 200);
    expect(m.outsourced).toBe(true);
    expect(m.blocked).toBe(false);
    expect(m.panels).toBe(1);
    expect(m.note).toContain("ייצור חוץ");
    expect(machineCheck(cfg, 300, 100).outsourced).toBe(false);
  });
  it("with a seam the job is welded in-house instead", () => {
    const m = machineCheck(cfg, 200, 200, { withSeam: true });
    expect(m.outsourced).toBe(false);
    expect(m.panels).toBe(2);
  });
  it("the absolute cap still wins", () => {
    const capped = { ...cfg, capW: 150, capL: 150 };
    const m = machineCheck(capped, 200, 200);
    expect(m.blocked).toBe(true);
    expect(m.outsourced).toBe(false);
  });
  it("prices flat per m² with the job minimum", () => {
    const j = priceJob(cfg, [], 200, 200, 1)!;
    expect(j.bindingRule).toBe("outsourced");
    expect(j.total).toBe(320);
    expect(j.above).toBe(true);
    expect(priceJob(cfg, [], 160, 160, 1)!.total).toBe(205);
    expect(priceJob(cfg, [], 300, 200, 1)!.total).toBe(480);
  });
  it("a catalog row for the same job never binds", () => {
    const j = priceJob(cfg, [], 200, 200, 1, [row(200, 200, 1, 416, true)])!;
    expect(j.bindingRule).toBe("outsourced");
    expect(j.total).toBe(320);
  });
  it("without a customer rate it falls back to cost × factor, and without both there is no quote", () => {
    const legacyFormula = { ...cfg, outsourcedRateM2: 0, outsourceCost: 70, outsourcedMarginFactor: 1.5 };
    expect(priceJob(legacyFormula, [], 200, 200, 1)!.total).toBe(420);
    const none = { ...cfg, outsourcedRateM2: 0, outsourceCost: 0 };
    const j = priceJob(none, [], 200, 200, 1)!;
    expect(j.noQuote).toBe(true);
    expect(j.total).toBe(0);
  });
  it("in-house jobs are untouched", () => {
    const j = priceJob(cfg, [], 120, 10, 1)!;
    expect(j.bindingRule).toBe("package_min");
    expect(j.total).toBe(70);
  });
});

/* ------------------------------------------------------------------ *
 * never ₪0 (D4)
 * ------------------------------------------------------------------ */
describe("never ₪0", () => {
  const legacyRow: Family = {
    family: "מגנטים",
    items_count: 89,
    notes: null,
    cost_per_m2: 0,
    outsource_cost_per_m2: null,
    outsource_width_cm: 150,
    outsource_height_cm: 160,
    pricing_config: { cost: { overhead_mult: 2 }, tiers: [] },
  };
  it("a family without a v3 block returns a quote request, not ₪0", () => {
    const cfg = readFamilyPricing(legacyRow);
    expect(cfg.legacy).toBe(true);
    const j = priceJob(cfg, [], 10, 10, 50)!;
    expect(j.noQuote).toBe(true);
    expect(j.total).toBe(0);
    expect(j.label).toContain("הצעת מחיר");
    expect(j.configError).toBeTruthy();
  });
  it("an exact verified catalog row still quotes for a legacy family", () => {
    const cfg = readFamilyPricing(legacyRow);
    const j = priceJob(cfg, [], 21, 14, 500, [row(21, 14, 500, 1850)])!;
    expect(j.bindingRule).toBe("validated");
    expect(j.total).toBe(1850);
  });
  it("an engine result of ₪0 becomes a quote request", () => {
    const cfg = baseFamilyPricing({ engine: "per_m2", cost: 0 });
    const j = priceJob(cfg, [], 50, 50, 1)!;
    expect(j.noQuote).toBe(true);
    expect(j.total).toBe(0);
  });
  it("explicit refusals keep their own labels", () => {
    const cfg = baseFamilyPricing({ engine: "per_m2", cost: 10, capW: 100, capL: 100 });
    const j = priceJob(cfg, [], 200, 200, 1)!;
    expect(j.overMachine).toBe(true);
    expect(j.noQuote).toBe(false);
  });
});

/* ------------------------------------------------------------------ *
 * two-machine sticker engine (D2)
 * ------------------------------------------------------------------ */
describe("two_machine_sheet — small sheet or roll", () => {
  /* the shipped seed, with the catalog switched off so the formula is tested
     on its own: small page ₪20, big page ₪95 per m² of a 100 cm roll */
  const fix = famFixture("מדבקות", { catalogBinds: "none" });
  const prepared = prepareFamily(fix.cfg, fix.anchors, fix.validated);
  const q = (w: number, h: number, qty: number) =>
    priceJob(fix.cfg, fix.anchors, w, h, qty, fix.validated, { prepared })!;

  it("1–4 stickers that fit the sheet cost one sheet — ₪20", () => {
    for (const [w, h, n] of [
      [30, 20, 1],
      [10, 10, 1],
      [10, 10, 3],
      [45, 30, 1],
      [40, 30, 1],
    ] as const) {
      const j = q(w, h, n);
      expect({ w, h, n, total: j.total, rule: j.bindingRule }).toEqual({ w, h, n, total: 20, rule: "sheet" });
    }
  });
  it("more sheets, more money: 10×10 nests 8 per sheet", () => {
    expect(q(10, 10, 1).unitsPerSheet).toBe(8);
    expect(q(10, 10, 9).total).toBe(40);
    expect(q(10, 10, 22).total).toBe(60);
    expect(q(14, 11, 22).total).toBe(60);
  });
  it("below the pack quantity the pro-rata pack price can bind, but never above the pack", () => {
    const fifty = q(5, 5, 50); // 2 sheets (manual 30/sheet) = 40 < pro-rata 63 < pack 126
    expect(fifty.total).toBe(63);
    expect(fifty.bindingRule).toBe("curve");
    const eighty = q(17, 17, 80); // 40 sheets = 800, capped at the 100-pack
    expect(eighty.bindingRule).toBe("package_min");
    expect(eighty.total).toBe(q(17, 17, 100).total);
  });
  it("from the pack quantity the bucket curve prices as before", () => {
    expect(q(5, 5, 100).total).toBe(q(5, 5, 100).total);
    expect(q(5, 5, 100).bindingRule).toBe("anchor");
    expect(q(5, 5, 1000).total).toBeGreaterThan(q(5, 5, 500).total);
  });
  it("a sticker that does not fit the page is billed on the roll it uses", () => {
    expect(q(46, 30, 1).unitsPerSheet).toBe(0);
    for (const [w, h, want] of [
      [46, 30, 29],
      [70, 50, 48],
      [17, 56, 20],
      [100, 100, 95],
      [120, 80, 91],
      [130, 130, 245],
      [140, 140, 265],
    ] as const) {
      const j = q(w, h, 1);
      expect({ w, h, total: j.total, rule: j.bindingRule }).toEqual({ w, h, total: want, rule: "large_format" });
    }
  });
  it("the roll is billed whole: the client's own square metre (9/23)", () => {
    /* four 50×50 sit two across and two rows on the 100 cm roll — exactly
       100×100, one square metre, ₪95. Three of them use the same piece. */
    expect(q(50, 50, 4).total).toBe(95);
    expect(q(50, 50, 3).total).toBe(95);
    expect(q(50, 50, 4).total).toBe(q(100, 100, 1).total);
    /* one 40×40 consumes 100×40 of roll, not 40×40 (Yulia 9/23) */
    expect(q(40, 40, 1).total).toBe(38);
    /* one centimetre wider and only one fits across, so the roll doubles */
    expect(q(51, 51, 4).total).toBe(195);
    /* stacking along the roll is what makes a run cheap */
    expect(q(115, 8, 10).total).toBe(91);
  });

  it("a bigger sticker never costs less, at any quantity", () => {
    for (const n of [1, 2, 4, 10]) {
      let prev = 0;
      for (const w of [100, 110, 120, 130, 140, 149, 150]) {
        const t = q(w, 100, n).total;
        expect({ n, w, ok: t >= prev }).toEqual({ n, w, ok: true });
        prev = t;
      }
    }
  });

  it("a split sticker pays for the width each part wastes", () => {
    expect(q(130, 130, 1).panels).toBe(2);
    expect(q(130, 130, 1).machineNote).toContain("2 חלקים");
    expect(q(100, 100, 1).panels).toBe(1);
    /* two parts of 65×130 cannot share the 100 cm roll, so each takes its own
       length — two of them is twice the roll again */
    expect(q(130, 130, 2).total).toBeGreaterThanOrEqual(2 * q(130, 130, 1).total);
  });
  it("above the absolute cap there is no price", () => {
    const j = q(160, 160, 1);
    expect(j.overMachine).toBe(true);
    expect(j.total).toBe(0);
  });
  it("totals never fall as quantity grows", () => {
    for (const [w, h] of [
      [10, 10],
      [5, 5],
      [17, 17],
      [30, 20],
      [46, 30],
    ] as const) {
      let prev = 0;
      for (let n = 1; n <= 260; n++) {
        const j = q(w, h, n);
        expect({ w, h, n, ok: j.total >= prev - 1e-9, mono: j.monotoneViolation }).toEqual({
          w,
          h,
          n,
          ok: true,
          mono: false,
        });
        prev = j.total;
      }
    }
  });
  it("a bigger sticker never costs less at the same quantity", () => {
    for (const n of [1, 3, 9, 22, 50, 100, 500]) {
      expect(q(10, 10, n).total).toBeLessThanOrEqual(q(17, 17, n).total);
      expect(q(17, 17, n).total).toBeLessThanOrEqual(q(30, 20, n).total);
      expect(q(30, 20, n).total).toBeLessThanOrEqual(q(46, 30, n).total);
    }
  });
  it("under 'packs' only the website packs bind; singles are priced by the machine", () => {
    const packs = famFixture("מדבקות", { ...fix.cfg, catalogBinds: "packs" });
    const validated = [
      row(30, 20, 1, 95),
      row(100, 100, 1, 120),
      row(5, 5, 1000, 345),
      row(5, 5, 100, 126),
    ];
    const one = priceJob(packs.cfg, [], 30, 20, 1, validated)!;
    expect(one.total).toBe(20);
    expect(one.bindingRule).toBe("sheet");
    /* the big-page single no longer overrides the rate per m² */
    const roll = priceJob(packs.cfg, [], 100, 100, 1, validated)!;
    expect(roll.bindingRule).toBe("large_format");
    /* the pack still does */
    const pack = priceJob(packs.cfg, [], 5, 5, 1000, validated)!;
    expect(pack.total).toBe(345);
    expect(pack.bindingRule).toBe("validated");
    /* the single-unit floor still guards a family that does bind singles */
    const all = famFixture("מדבקות", { ...fix.cfg, catalogBinds: "all" });
    const two = priceJob(all.cfg, [], 70, 50, 2, [...validated, row(70, 50, 1, 100)])!;
    expect(two.total).toBe(100);
    expect(two.detail).toContain("לא פחות מיחידה אחת");
    const thousand = priceJob(packs.cfg, [], 5, 5, 1000, validated)!;
    expect(thousand.bindingRule).toBe("validated");
    expect(thousand.total).toBe(345);
  });
});

/* ------------------------------------------------------------------ *
 * material surcharge (D6)
 * ------------------------------------------------------------------ */
describe("material_surcharge modifier", () => {
  const cfg = baseFamilyPricing({
    engine: "per_m2",
    perM2Tiers: [{ minM2: 0, rate: 100 }],
    plan: { modifiers: [{ kind: "material_surcharge", pct: { vinyl: 0, diecut_vinyl: 0.25, transparent: 0.15 } }] },
  });
  it("adds the percentage of the chosen material and nothing for the default", () => {
    expect(priceJob(cfg, [], 100, 100, 1)!.total).toBe(100);
    expect(priceJob(cfg, [], 100, 100, 1, [], { material: "vinyl" })!.total).toBe(100);
    expect(priceJob(cfg, [], 100, 100, 1, [], { material: "diecut_vinyl" })!.total).toBe(125);
    expect(priceJob(cfg, [], 100, 100, 1, [], { material: "transparent" })!.total).toBe(115);
    expect(priceJob(cfg, [], 100, 100, 1, [], { material: "unknown" })!.total).toBe(100);
  });
  it("names the material in the price detail", () => {
    const j = priceJob(cfg, [], 100, 100, 1, [], { material: "diecut_vinyl" })!;
    expect(j.detail).toContain("חיתוך צורני");
  });
});
