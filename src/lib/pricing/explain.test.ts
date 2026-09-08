import { describe, expect, it } from "bun:test";
import { prepareFamily } from "../mdvd";
import { famFixture } from "../pricing-fixtures";
import { SPEC_FAMILY_CONFIGS } from "../pricing-defaults";
import { explainFamily } from "./explain";
import { resolvePlan } from "./plan";

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
    ).toContain("שטח");
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
    /* מדבקות does use it */
    expect(
      explain("מדבקות")
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
    expect(s).toContain("10 יחידות");
  });
});
