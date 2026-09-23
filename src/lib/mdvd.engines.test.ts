import { describe, expect, it } from "bun:test";
import { priceJob, type JobOptions, type JobPrice } from "./mdvd";
import { famFixture, liveFixture, type FamFixture } from "./pricing-fixtures";

/* ------------------------------------------------------------------ *
 *  Acceptance suite — the client-approved spec points, verbatim.
 *  Exact where the spec is exact; bands where instructed.
 * ------------------------------------------------------------------ */

function job(fix: FamFixture, w: number, h: number, qty: number, opts: JobOptions = {}): JobPrice {
  const j = priceJob(fix.cfg, fix.anchors, w, h, qty, fix.validated, opts);
  expect(j).not.toBeNull();
  return j!;
}

/* ================================ מדבקות ================================ */
/* מנוע `two_machine_sheet`: גיליון קטן (₪20 לגיליון, לא יותר מחבילת 100)
   או גליל (לפי מ״ר על השטח בפועל, מינימום ₪95). liveFixture מספק את שורות
   הקטלוג המאומתות; במדיניות "packs" רק שורות מ-100 יח׳ ומעלה קובעות. */
describe("מדבקות (two_machine_sheet — small sheet or roll)", () => {
  const fix = liveFixture("מדבקות");

  it("every website pack (≥100) still quotes its catalog price", () => {
    for (const [w, h, qty, price] of [
      [3, 3, 100, 115],
      [3, 3, 1000, 315],
      [5, 5, 100, 126],
      [5, 8, 100, 126],
      [6, 6, 500, 270],
      [9, 9, 1000, 505],
      [5, 9, 500, 280],
      [5, 9, 1000, 420],
      [24, 6, 500, 340],
      [15, 10, 1000, 590],
      [16, 6, 100, 187],
      [10, 10, 100, 187],
    ] as [number, number, number, number][])
      expect({ w, h, qty, total: job(fix, w, h, qty).total }).toEqual({ w, h, qty, total: price });
  });

  it("the old catalog singles no longer bind: 30×20 × 1 is one sheet = ₪20", () => {
    const j = job(fix, 30, 20, 1);
    expect(j.total).toBe(20);
    expect(j.bindingRule).toBe("sheet");
    /* the same family with the old policy still quotes the catalog row */
    const old = liveFixture("מדבקות", { catalogBinds: "all" });
    expect(job(old, 30, 20, 1).total).toBe(95);
  });

  it("17×17 × 80 is capped at the 100-pack price", () => {
    const j = job(fix, 17, 17, 80);
    expect(j.bindingRule).toBe("package_min");
    expect(j.total).toBe(job(fix, 17, 17, 100).total);
  });

  it("price grows with area at a fixed quantity", () => {
    const at = (w: number, h: number) => job(fix, w, h, 10).total;
    /* 10×10 (2 sheets) → 17×17 (5 sheets) → 20×30 (5 sheets) → 100×100 (roll) */
    expect(at(10, 10)).toBeLessThan(at(17, 17));
    expect(at(17, 17)).toBeLessThanOrEqual(at(20, 30));
    expect(at(20, 30)).toBeLessThan(at(100, 100));
  });

  it("approved roll-size singles bind; a size between them is floored by the smaller one", () => {
    /* 80×60 = ₪105 and 120×80 = ₪120 are approved catalog rows; 100×80 has none */
    expect(job(fix, 80, 60, 1).total).toBe(105);
    expect(job(fix, 100, 100, 1).total).toBe(120);
    expect(job(fix, 120, 80, 1).total).toBe(120);
    const mid = job(fix, 100, 80, 1).total;
    expect(mid).toBeGreaterThanOrEqual(job(fix, 80, 60, 1).total);
    expect(mid).toBeLessThanOrEqual(job(fix, 120, 80, 1).total);
  });

  it("14×11 × 22 → ₪60 (8 per sheet, 3 sheets)", () => {
    expect(job(fix, 14, 11, 22).total).toBe(60);
  });
  it("11×14 × 22 → ₪60 (orientation-insensitive)", () => {
    expect(job(fix, 11, 14, 22).total).toBe(60);
  });

  it("there is no minimum order — but a family that sets one still refuses sheet work below it", () => {
    expect(job(fix, 3, 3, 5).belowMinOrder).toBe(false);
    const withMin = liveFixture("מדבקות", { minOrderQty: 10 });
    const j = job(withMin, 3, 3, 5);
    expect(j.belowMinOrder).toBe(true);
    expect(j.total).toBe(0);
    expect(j.label).toContain("מינימום הזמנה");
    /* the roll is not sheet work — exempt */
    expect(job(withMin, 17, 56, 1).belowMinOrder).toBe(false);
  });

  it("quantity never runs backwards (bug #2): qty10 ≥ qty1, and 99 ≤ 100", () => {
    for (const [w, h] of [
      [3, 3],
      [5, 5],
      [3, 10],
    ] as [number, number][])
      expect(job(fix, w, h, 10).total).toBeGreaterThanOrEqual(job(fix, w, h, 1).total);
    expect(job(fix, 5, 5, 99).total).toBeLessThanOrEqual(job(fix, 5, 5, 100).total);
  });
});

/* ================================ שמשונית ================================ */
describe("שמשונית (per_m2 + approved anchors)", () => {
  /* live rows: only is_anchor rows bind (catalog_binds = anchors) */
  const fix = liveFixture("שמשונית");

  it("120×10 → ₪70 (job minimum), binding rule package_min", () => {
    const j = job(fix, 120, 10, 1);
    expect(j.total).toBe(70);
    expect(j.bindingRule).toBe("package_min");
  });
  it("60×40 → ₪70 (approved anchor = the minimum)", () => {
    expect(job(fix, 60, 40, 1).total).toBe(70);
  });
  it("120×100 → ₪105 (approved anchor, verbatim)", () => {
    expect(job(fix, 120, 100, 1).total).toBe(105);
  });
  it("200×100 → ₪150 (approved anchor)", () => {
    expect(job(fix, 200, 100, 1).total).toBe(150);
  });
  it("120×80 → ₪90 (approved anchor)", () => {
    expect(job(fix, 120, 80, 1).total).toBe(90);
  });
  it("100×90 (0.9 m²) → 85 ₪/m² formula, within [75, 80]", () => {
    const t = job(fix, 100, 90, 1).total; // max(65, 85×0.9=76.5) → ₪77
    expect(t).toBeGreaterThanOrEqual(75);
    expect(t).toBeLessThanOrEqual(80);
  });
  it("outsourced above 150: flat ₪80/m² — 160×160 → 205, 200×200 → 320, 300×200 → 480, 400×200 → 640", () => {
    for (const [w, h, want] of [
      [160, 160, 205],
      [200, 200, 320],
      [300, 200, 480],
      [400, 200, 640],
    ] as [number, number, number][]) {
      const j = job(fix, w, h, 1);
      expect({ w, h, total: j.total, rule: j.bindingRule }).toEqual({ w, h, total: want, rule: "outsourced" });
    }
  });
  it("the old outsourced catalog rows (≈₪104/m²) no longer bind: 200×200 was ₪416", () => {
    expect(fix.validated.some((a) => a.w === 200 && a.h === 200 && a.price === 416)).toBe(true);
    expect(job(fix, 200, 200, 1).total).toBe(320);
  });
  it("400×200 with seam (ריתוך בבית) → welded in-house on the tiers, 8 m² × 72 = ₪575", () => {
    const j = job(fix, 400, 200, 1, { withSeam: true });
    expect(j.bindingRule).not.toBe("outsourced");
    expect(j.total).toBe(575);
    expect(j.panels).toBe(2);
  });
  it("120×80 × 10 → ₪815 (the ₪470 10-pack belongs to פוליגל; no tier here)", () => {
    const j = job(fix, 120, 80, 10);
    expect(j.total).toBe(815);
    expect(j.bindingRule).toBe("curve");
  });
  it("200×140 (short side 140 < 150) → NOT outsourced", () => {
    const j = job(fix, 200, 140, 1);
    expect(j.bindingRule).not.toBe("outsourced");
    expect(j.total).toBeGreaterThan(0);
  });
});

/* ================================ שלטי PVC ================================ */
describe("שלטי PVC (size_ladder)", () => {
  const fix = liveFixture("שלטי PVC");

  it("the client's 8/19 price list: 20×30 = 35 · 30×60 = 60 · 30×80 = 80 · 40×60 = 70", () => {
    for (const [w, h, want] of [
      [20, 30, 35],
      [30, 60, 60],
      [30, 80, 80],
      [40, 60, 70],
    ] as [number, number, number][])
      expect({ w, h, total: job(fix, w, h, 1).total }).toEqual({ w, h, total: want });
  });
  it("30×90 → ₪90 (ladder point, verbatim)", () => {
    expect(job(fix, 30, 90, 1).total).toBe(90);
  });
  it("above the assumed 150×300 cap there is no price", () => {
    expect(job(fix, 160, 200, 1).overMachine).toBe(true);
  });
  it("80×200 → ₪350 (ladder top)", () => {
    expect(job(fix, 80, 200, 1).total).toBe(350);
  });
  it("90×30 → ₪90 (orientation-insensitive)", () => {
    expect(job(fix, 90, 30, 1).total).toBe(90);
  });
  it("60×100 (0.6 m²) → interpolated between 60×90 (₪150) and 100×70 (₪155)", () => {
    const t = job(fix, 60, 100, 1).total;
    expect(t).toBeGreaterThanOrEqual(150);
    expect(t).toBeLessThanOrEqual(155);
  });
});

/* ================================ פוליגל ================================ */
describe("פוליגל (per_m2 ₪80 with a ₪90 single + approved packs)", () => {
  /* live rows carry the rejected ₪55–70 singles; catalog_binds = none */
  const fix = liveFixture("פוליגל");

  it("singles are ₪90 — 40×40, 60×40 and 120×80 alike (8/18)", () => {
    for (const [w, h] of [
      [40, 40],
      [60, 40],
      [120, 80],
    ] as [number, number][]) {
      const j = job(fix, w, h, 1);
      expect({ w, h, total: j.total, rule: j.bindingRule }).toEqual({ w, h, total: 90, rule: "package_min" });
    }
  });
  it("bigger in-house sizes grow with area: 150×100 → 120, 200×100 → 160", () => {
    expect(job(fix, 150, 100, 1).total).toBe(120);
    expect(job(fix, 200, 100, 1).total).toBe(160);
  });
  it("120×80 × 10 → ₪470 and 40×40 × 10 → ₪295 (approved packs)", () => {
    expect(job(fix, 120, 80, 10).total).toBe(470);
    expect(job(fix, 40, 40, 10).total).toBe(295);
  });
  it("a smaller sign in the same pack quantity gets the pack rate: 100×80 × 10 → ₪470", () => {
    const j = job(fix, 100, 80, 10);
    expect(j.total).toBe(470);
    expect(j.bindingRule).toBe("tier");
  });
  it("2–9 units ramp linearly from the single to the pack: 120×80 × 5 → ₪259", () => {
    const j = job(fix, 120, 80, 5);
    expect(j.total).toBe(259);
    expect(j.bindingRule).toBe("short_run");
    let prev = 0;
    for (let n = 1; n <= 12; n++) {
      const t = job(fix, 120, 80, n).total;
      expect(t).toBeGreaterThanOrEqual(prev);
      prev = t;
    }
  });
  it("above 150 wide → outsourced at ₪80/m²: 160×160 → ₪205", () => {
    const j = job(fix, 160, 160, 1);
    expect(j.bindingRule).toBe("outsourced");
    expect(j.total).toBe(205);
  });
});

/* ================================ קנבס ================================ */
describe("קנבס (size_ladder + panoramic + machine cap)", () => {
  const fix = famFixture("קנבס");

  it("20×20 → ₪59", () => {
    expect(job(fix, 20, 20, 1).total).toBe(59);
  });
  it("70×140 → ₪281 and 140×70 → ₪281 (merged, orientation-insensitive)", () => {
    expect(job(fix, 70, 140, 1).total).toBe(281);
    expect(job(fix, 140, 70, 1).total).toBe(281);
  });
  it("60×180 → ₪365 verbatim — panoramic surcharge must NOT touch ladder points", () => {
    /* aspect 3 ≥ 2.4, but 60×180 is an exact ladder point → ₪365, not ×1.10 */
    expect(job(fix, 60, 180, 1).total).toBe(365);
  });
  it("panoramic 50×125 (aspect 2.5) ≥ similar-area non-panoramic 55×115 (aspect 2.09)", () => {
    const pano = job(fix, 50, 125, 1).total; // 0.625 m², interpolated ×1.10
    const flat = job(fix, 55, 115, 1).total; // 0.6325 m², no surcharge
    expect(pano).toBeGreaterThanOrEqual(flat);
    expect(pano).toBeGreaterThan(0);
  });
  it("160×210 (over the 150×200 cap) → machine-blocked, total 0", () => {
    const j = job(fix, 160, 210, 1);
    expect(j.overMachine).toBe(true);
    expect(j.total).toBe(0);
  });
});

/* ================================ קאפה ================================ */
describe("קאפה (sheet_yield 240×120)", () => {
  const fix = famFixture("קאפה");

  it("90×90 ≡ 120×120 at qty 1 — both 2/sheet, identical totals", () => {
    const a = job(fix, 90, 90, 1);
    const b = job(fix, 120, 120, 1);
    expect(a.unitsPerSheet).toBe(2);
    expect(b.unitsPerSheet).toBe(2);
    expect(a.total).toBe(b.total);
    expect(a.total).toBeGreaterThan(0);
  });
  it("100×100 × 1 bills a whole board — same total as 120×120 × 1 (live whole_board rule)", () => {
    const a = job(fix, 100, 100, 1);
    const b = job(fix, 120, 120, 1);
    expect(a.unitsPerSheet).toBe(2);
    expect(a.total).toBe(b.total);
    expect(fix.cfg.wholeBoard).toBe(true);
    expect(fix.cfg.boardW).toBe(240);
    expect(fix.cfg.boardH).toBe(120);
  });
  it("50×70 (within direct-print 60/90) → not mounted", () => {
    expect(job(fix, 50, 70, 1).mounted).toBe(false);
  });
  it("empty yield table → TODO surfaced on the job", () => {
    const j = job(fix, 90, 90, 1);
    expect(j.todos.some((t) => t.includes("טבלת תפוקה"))).toBe(true);
  });
});

/* ================================ זכוכית ================================ */
describe("זכוכית (size_ladder)", () => {
  const fix = famFixture("זכוכית");

  it("20×30 → ₪160", () => {
    expect(job(fix, 20, 30, 1).total).toBe(160);
  });
  it("120×80 → ₪1035 (market top, kept)", () => {
    expect(job(fix, 120, 80, 1).total).toBe(1035);
  });
  it("100×70 → ₪675 (approved 650–700 target, middle)", () => {
    expect(job(fix, 100, 70, 1).total).toBe(675);
  });
});

/* ============================ חשבוניות / פנקסים ============================ */
describe("חשבוניות / פנקסים (unit_floor format prices)", () => {
  const fix = famFixture("חשבוניות");

  it("A5 (14.8×21) × 10 → ₪320 verbatim", () => {
    expect(job(fix, 14.8, 21, 10).total).toBe(320);
  });
  it("15×21 × 10 → ₪320 (dim tolerance)", () => {
    expect(job(fix, 15, 21, 10).total).toBe(320);
  });
  it("A4 (21×29.7) × 10 → ₪418", () => {
    expect(job(fix, 21, 29.7, 10).total).toBe(418);
  });
  it("A4 × 20 → ₪858", () => {
    expect(job(fix, 21, 29.7, 20).total).toBe(858);
  });
  it("A4 × 15 → noQuote (pack prices are non-linear — never invented)", () => {
    const j = job(fix, 21, 29.7, 15);
    expect(j.noQuote).toBe(true);
    expect(j.total).toBe(0);
  });
  it("פנקסים shares the config → A5 × 10 → ₪320", () => {
    const pads = famFixture("פנקסים");
    expect(job(pads, 14.8, 21, 10).total).toBe(320);
  });
});

/* ============================ מדבקה בטחונית ============================ */
describe("מדבקה בטחונית (unit_floor, min order ₪250)", () => {
  const fix = famFixture("מדבקה בטחונית");

  it("any size/qty → ₪250 with binding rule min_order_value", () => {
    for (const [w, h, qty] of [
      [10, 10, 50],
      [30, 40, 1],
      [5, 5, 500],
    ] as const) {
      const j = job(fix, w, h, qty);
      expect(j.total).toBe(250);
      expect(j.bindingRule).toBe("min_order_value");
    }
  });
});
