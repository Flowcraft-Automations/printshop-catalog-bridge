import { describe, expect, it } from "bun:test";
import { prepareFamily, priceJob, readFamilyPricing, writeFamilyPricing } from "../mdvd";
import { famFixture, familyRow, specSeed } from "../pricing-fixtures";
import { planFromLegacyConfig, resolvePlan, validatePlan } from "./plan";

/* ------------------------------------------------------------------ *
 *  The pipeline: gates → overrides → source → modifiers → finish.
 *
 *  What these guard is the property the refactor was for — a family
 *  declares only what the legacy config cannot express, and a new
 *  capability costs a rule, not a field on every family.
 * ------------------------------------------------------------------ */

describe("pricing plan", () => {
  it("derives a plan from every seeded family's config", () => {
    for (const name of ["מדבקות", "שמשונית", "פליירים", "קאפה", "חשבוניות"]) {
      const cfg = famFixture(name).cfg;
      const plan = planFromLegacyConfig(cfg);
      expect(plan.source.kind).toBe(cfg.engine);
      expect(plan.gates.some((g) => g.kind === "machine_limit")).toBe(true);
      expect(validatePlan(plan)).toEqual([]);
    }
  });

  it("a family's override adds to the derived plan instead of replacing it", () => {
    const cfg = famFixture("מדבקות", { minOrderQty: 10 }).cfg;
    const plan = resolvePlan(cfg, { modifiers: [{ kind: "cost_floor" }] });
    /* the minimum-order gate is still derived — declaring it twice is what
       would let cfg.minOrderQty and the plan drift apart */
    expect(plan.gates.some((g) => g.kind === "min_order_qty")).toBe(true);
    expect(plan.source.kind).toBe("two_machine_sheet");
    expect(plan.modifiers.some((m) => m.kind === "cost_floor")).toBe(true);
    expect(plan.modifiers.some((m) => m.kind === "size_floor")).toBe(true);
  });

  it("min order stays tied to the config field, not restated in the plan", () => {
    /* famFixture's `over` changes cfg.minOrderQty only; if the plan had its
       own copy the two would disagree and this would quote 0 */
    const free = famFixture("מדבקות", { minOrderQty: 0 });
    const j = priceJob(free.cfg, free.anchors, 5, 5, 1, free.validated)!;
    expect(j.belowMinOrder).toBe(false);
    expect(j.total).toBeGreaterThan(0);
  });

  it("the plan survives the database round-trip", () => {
    const seed = specSeed("קאפה");
    const read = readFamilyPricing(familyRow("קאפה", seed));
    expect(read.plan).toEqual(seed.plan ?? null);
    expect(JSON.stringify(writeFamilyPricing(read))).toContain("cost_floor");
  });

  it("validatePlan rejects a cost_plus source with no markup", () => {
    expect(
      validatePlan({
        gates: [],
        source: { kind: "cost_plus", paper: {}, click: {}, markup: 0 },
        modifiers: [],
      }).join(" "),
    ).toContain("עלות-פלוס");
  });
});

describe("quote_only gate (פרספקס — a family added as data, no engine code)", () => {
  const fix = famFixture("פרספקס");
  const prepared = prepareFamily(fix.cfg, fix.anchors, fix.validated);
  const q = (w: number, h: number, qty: number) =>
    priceJob(fix.cfg, fix.anchors, w, h, qty, fix.validated, { prepared })!;

  it("never returns a number, at any size or quantity", () => {
    for (const [w, h, qty] of [
      [20, 30, 1],
      [200, 100, 5],
      [115, 8, 1000],
    ] as [number, number, number][]) {
      const j = q(w, h, qty);
      expect(j.noQuote).toBe(true);
      expect(j.total).toBe(0);
      expect(j.label).toContain("הצעת מחיר");
    }
  });

  it("carries the client TODO so the gap is visible in the app", () => {
    expect(fix.cfg.todos.join(" ")).toContain("פרספקס");
  });
});

describe("over-limit = פיצול לחלקים (מדבקות — 120 ס״מ vinyl printer)", () => {
  const fix = famFixture("מדבקות");
  const prepared = prepareFamily(fix.cfg, fix.anchors, fix.validated);
  const q = (w: number, h: number) =>
    priceJob(fix.cfg, fix.anchors, w, h, 1, fix.validated, { prepared })!;

  it("is the admin's choice, not an assumption from the family type", () => {
    expect(fix.cfg.overLimit).toBe("weld");
    /* the same family with 'block' chosen refuses instead of splitting */
    const blocking = famFixture("מדבקות", { overLimit: "block" });
    const j = priceJob(blocking.cfg, blocking.anchors, 130, 130, 1, blocking.validated)!;
    expect(j.overMachine).toBe(true);
    expect(j.panels).toBe(1);
  });

  it("splits only when the short side exceeds the printer width", () => {
    expect(q(100, 100).panels).toBe(1);
    expect(q(130, 130).panels).toBe(2);
    expect(q(140, 140).panels).toBe(2);
  });

  it("splitting does not change the price — same material, same ₪", () => {
    /* 130×130 = 1.69 m² on the roll → ₪92/m² = ₪155 (the catalog single is
       also ₪155); delivery in 2 parts must not reprice it */
    const j = q(130, 130);
    expect(j.total).toBe(155);
    expect(j.machineNote).toContain("מסופק ב-2 חלקים");
  });

  it("oversize is split, never declined — 130×130 and 140×140 are sold", () => {
    for (const [w, h] of [
      [130, 130],
      [140, 140],
    ] as [number, number][]) {
      expect(q(w, h).overMachine).toBe(false);
      expect(q(w, h).total).toBeGreaterThan(0);
    }
  });
});

/* ------------------------------------------------------------------ *
 *  Floors. A floor that only WARNS next to a different price reads as
 *  "the real price is X" — so when a family declares one, it binds.
 * ------------------------------------------------------------------ */

describe("size_floor — never below an approved row that both dimensions dominate", () => {
  const fix = famFixture("קנבס");
  const approved = (w: number, h: number, price: number) => ({
    id: `${w}x${h}`,
    name: `${w}/${h}`,
    w,
    h,
    area: (w * h) / 10000,
    qty: 1,
    price,
  });

  it("a dominated approved size sets the floor", () => {
    /* 60×60 approved at ₪300 is smaller in BOTH dimensions than 90×90 */
    const V = [...fix.validated, approved(60, 60, 300)];
    const j = priceJob(fix.cfg, fix.anchors, 90, 90, 1, V, {
      prepared: prepareFamily(fix.cfg, fix.anchors, V),
    })!;
    expect(j.bindingRule).toBe("size_floor");
    expect(j.total).toBe(300);
    expect(j.detail).toContain("60×60");
  });

  it("area alone is not dominance — a 160×40 does not floor a 90×90", () => {
    /* less area, but 160 > 90: a different shape that legitimately costs
       more on a 150 cm roll. The old warning compared area only. */
    const V = [...fix.validated, approved(160, 40, 256)];
    const j = priceJob(fix.cfg, fix.anchors, 90, 90, 1, V, {
      prepared: prepareFamily(fix.cfg, fix.anchors, V),
    })!;
    expect(j.bindingRule).not.toBe("size_floor");
    expect(j.smallerViolation).toBeNull();
  });

  it("is on for every family by default", () => {
    for (const name of ["מדבקות", "שמשונית", "קנבס", "קאפה"])
      expect(
        resolvePlan(famFixture(name).cfg, famFixture(name).cfg.plan).modifiers.some(
          (m) => m.kind === "size_floor",
        ),
      ).toBe(true);
  });
});

describe("cost_floor — binds only where the cost figure is confirmed", () => {
  it("קאפה: the floor becomes the price, labelled as such", () => {
    const fix = famFixture("קאפה");
    const j = priceJob(fix.cfg, fix.anchors, 70, 70, 1, fix.validated)!;
    expect(j.bindingRule).toBe("cost_floor");
    expect(j.total).toBeGreaterThanOrEqual(Math.floor(j.costFloorValue));
    expect(j.belowCost).toBe(false);
    expect(j.label).toContain("רצפת עלות");
  });

  it("מדבקות: OFF — ₪6 is stored in cost_per_m2 but multiplied by sheets, a 7× ambiguity", () => {
    const fix = famFixture("מדבקות");
    expect(resolvePlan(fix.cfg, fix.cfg.plan).modifiers.some((m) => m.kind === "cost_floor")).toBe(
      false,
    );
    const j = priceJob(fix.cfg, fix.anchors, 16, 7, 500, fix.validated)!;
    /* the shop's own price stands; the cost note is a diagnostic, not a price */
    expect(j.total).toBe(345);
    expect(j.bindingRule).not.toBe("cost_floor");
  });
});
