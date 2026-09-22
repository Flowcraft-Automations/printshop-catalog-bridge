import { describe, expect, it } from "bun:test";
import { prepareFamily } from "../mdvd";
import { famFixture } from "../pricing-fixtures";
import { SPEC_FAMILY_CONFIGS } from "../pricing-defaults";
import { explainFamily } from "./explain";
import { resolvePlan, type GateSpec, type ModifierSpec, type SourceSpec } from "./plan";
import { baseFamilyPricing } from "../pricing-defaults";

/* ------------------------------------------------------------------ *
 *  The explanation is generated from the same plan the engine prices
 *  from. These guard the property that makes it trustworthy: it must
 *  describe THIS family, and must not mention a setting the family's
 *  engine never reads.
 * ------------------------------------------------------------------ */

const explain = (name: string) => {
  const fix = famFixture(name);
  const prepared = prepareFamily(fix.cfg, fix.anchors, fix.validated);
  return { cfg: fix.cfg, ...explainFamily(fix.cfg, resolvePlan(fix.cfg, fix.cfg.plan), prepared) };
};

describe("family explanation", () => {
  it("every seeded family gets Hebrew and English for every line", () => {
    for (const name of Object.keys(SPEC_FAMILY_CONFIGS)) {
      const e = explain(name);
      expect(e.steps.length).toBeGreaterThan(0);
      for (const line of [...e.steps, ...e.settings]) {
        expect(line.he.trim().length).toBeGreaterThan(0);
        expect(line.en.trim().length).toBeGreaterThan(0);
        expect(line.he).not.toBe(line.en);
      }
    }
  });

  it("describes the family's own engine, not a generic one", () => {
    expect(
      explain("מדבקות")
        .steps.map((l) => l.he)
        .join(" "),
    ).toContain("גיליון");
    expect(
      explain("שמשונית")
        .steps.map((l) => l.he)
        .join(" "),
    ).toContain("מ״ר");
    expect(
      explain("קאפה")
        .steps.map((l) => l.he)
        .join(" "),
    ).toContain("גיליון");
    expect(
      explain("שלטי PVC")
        .steps.map((l) => l.he)
        .join(" "),
    ).toContain("סולם");
  });

  it("never lists a setting the engine does not read", () => {
    /* שמשונית is per_m2 — it has a shortRunPct value in config that no
       per-m² code path consumes, so it must not be presented as in force */
    const shim = explain("שמשונית");
    expect(shim.cfg.shortRunPct).toBeGreaterThan(0);
    expect(shim.settings.map((s) => s.he).join(" ")).not.toContain("ריצה קצרה");
    /* the two-machine sticker engine does not read it either */
    expect(
      explain("מדבקות")
        .settings.map((s) => s.he)
        .join(" "),
    ).not.toContain("ריצה קצרה");
    /* an anchor-curve family with a real ramp does */
    const fix = famFixture("פליירים", { shortRunPct: 0.7 });
    const prepared = prepareFamily(fix.cfg, fix.anchors, fix.validated);
    expect(
      explainFamily(fix.cfg, resolvePlan(fix.cfg, fix.cfg.plan), prepared)
        .settings.map((s) => s.he)
        .join(" "),
    ).toContain("ריצה קצרה");
  });

  it("a quote-only family explains that and stops", () => {
    const e = explain("פרספקס");
    expect(e.steps).toHaveLength(1);
    expect(e.steps[0]!.he).toContain("הצעת מחיר");
    expect(e.settings).toEqual([]);
    expect(e.todos.join(" ")).toContain("פרספקס");
  });

  it("reports the family's real machine limits and minimum order", () => {
    const s = explain("מדבקות")
      .steps.map((l) => l.he)
      .join(" ");
    expect(s).toContain("120");
    expect(s).toContain("150");
    const fix = famFixture("מדבקות", { minOrderQty: 10 });
    const prepared = prepareFamily(fix.cfg, fix.anchors, fix.validated);
    expect(
      explainFamily(fix.cfg, resolvePlan(fix.cfg, fix.cfg.plan), prepared)
        .steps.map((l) => l.he)
        .join(" "),
    ).toContain("10 יחידות");
  });

  it("describes the over-limit behaviour the admin chose", () => {
    const he = (n: string) =>
      explain(n)
        .steps.map((l) => l.he)
        .join(" ");
    expect(he("מדבקות")).toContain("בכמה חלקים");
    expect(he("קאפה")).toContain("מודבקת על לוח");
    expect(he("קנבס")).toContain("אינה מיוצרת");
    expect(he("שמשונית")).toContain("ייצור חוץ");
    expect(he("שמשונית")).toContain("80");
  });
});

/* Every rule kind must produce a line. Without this, adding a rule and
   forgetting to describe it would silently drop it from the explanation —
   the calculator would then price by a rule it never mentions. */
describe("explanation covers every rule kind", () => {
  const cfg = baseFamilyPricing({ maxPrintW: 100, minOrderValue: 250 });
  const prepared = prepareFamily(cfg, [], []);
  const say = (plan: { gates: GateSpec[]; source: SourceSpec; modifiers: ModifierSpec[] }) =>
    explainFamily(cfg, plan, prepared)
      .steps.map((l) => l.he + " " + l.en)
      .join(" || ");

  const SOURCES: SourceSpec[] = [
    { kind: "catalog_surface" },
    { kind: "anchor_curve" },
    { kind: "per_m2" },
    { kind: "size_ladder" },
    { kind: "sheet_yield" },
    { kind: "unit_floor" },
    { kind: "two_machine_sheet" },
    { kind: "cost_plus", paper: {}, click: {}, markup: 2 },
  ];
  const MODIFIERS: ModifierSpec[] = [
    { kind: "paper_weight", pct: { "170": 0.08 } },
    { kind: "dual_sided", tiers: [{ maxQty: null, pct: 0.1 }] },
    { kind: "size_floor" },
    { kind: "cost_floor" },
    { kind: "min_order_value", value: 250 },
    { kind: "material_surcharge", pct: { diecut_vinyl: 0.25 } },
  ];

  it("describes every price source", () => {
    for (const source of SOURCES) {
      const text = say({ gates: [], source, modifiers: [] });
      expect({ kind: source.kind, described: text.length > 120 }).toEqual({
        kind: source.kind,
        described: true,
      });
    }
  });

  it("describes every modifier", () => {
    for (const m of MODIFIERS) {
      const base = say({ gates: [], source: { kind: "per_m2" }, modifiers: [] });
      const withRule = say({ gates: [], source: { kind: "per_m2" }, modifiers: [m] });
      expect({ kind: m.kind, added: withRule.length > base.length }).toEqual({
        kind: m.kind,
        added: true,
      });
    }
  });

  it("describes every gate", () => {
    const gates: GateSpec[] = [
      { kind: "machine_limit" },
      { kind: "min_order_qty", qty: 25, exemptLargeFormat: false },
    ];
    for (const g of gates) {
      const base = say({ gates: [], source: { kind: "per_m2" }, modifiers: [] });
      const withRule = say({ gates: [g], source: { kind: "per_m2" }, modifiers: [] });
      expect({ kind: g.kind, added: withRule.length > base.length }).toEqual({
        kind: g.kind,
        added: true,
      });
    }
    /* quote_only replaces the whole narrative rather than adding to it */
    const q = say({ gates: [{ kind: "quote_only" }], source: { kind: "per_m2" }, modifiers: [] });
    expect(q).toContain("הצעת מחיר");
  });
});
