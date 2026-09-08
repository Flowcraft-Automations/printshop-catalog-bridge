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
    const cfg = famFixture("מדבקות").cfg;
    const plan = resolvePlan(cfg, { modifiers: [{ kind: "panel_split", maxWidthCm: 120 }] });
    /* the minimum-order gate is still derived — declaring it twice is what
       would let cfg.minOrderQty and the plan drift apart */
    expect(plan.gates.some((g) => g.kind === "min_order_qty")).toBe(true);
    expect(plan.source.kind).toBe("catalog_surface");
    expect(plan.modifiers.some((m) => m.kind === "panel_split")).toBe(true);
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
    const seed = specSeed("מדבקות");
    const read = readFamilyPricing(familyRow("מדבקות", seed));
    expect(read.plan).toEqual(seed.plan ?? null);
    expect(JSON.stringify(writeFamilyPricing(read))).toContain("panel_split");
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

describe("panel_split (מדבקות — 120 ס״מ vinyl printer)", () => {
  const fix = famFixture("מדבקות");
  const prepared = prepareFamily(fix.cfg, fix.anchors, fix.validated);
  const q = (w: number, h: number) =>
    priceJob(fix.cfg, fix.anchors, w, h, 1, fix.validated, { prepared })!;

  it("splits only when the short side exceeds the printer width", () => {
    expect(q(100, 100).panels).toBe(1);
    expect(q(130, 130).panels).toBe(2);
    expect(q(140, 140).panels).toBe(2);
  });

  it("splitting does not change the price — same material, same ₪", () => {
    /* 130×130 is an approved catalog row at ₪155; delivery in 2 parts must
       not reprice it */
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
