import { describe, expect, it } from "bun:test";
import { priceJob, type JobOptions, type JobPrice } from "./mdvd";
import { famFixture, type FamFixture } from "./pricing-fixtures";

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
/* מנוע `catalog_surface`: base(שטח) × mult(כמות), שניהם נקראים מהשורות
   המאושרות בקטלוג. השורות מגיעות מ-reports/dry-run-2026-08-25.csv דרך
   famFixture, ולכן הבדיקות נמדדות מול מחירון הלקוח ולא מול מספרים בקוד. */
describe("מדבקות (catalog_surface, base(area) × mult(qty))", () => {
  const fix = famFixture("מדבקות");

  it("every approved catalog row quotes its own price", () => {
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
      [17, 17, 80, 270],
      [30, 20, 1, 95],
    ] as [number, number, number, number][])
      expect({ w, h, qty, total: job(fix, w, h, qty).total }).toEqual({ w, h, qty, total: price });
  });

  it("price grows with area at a fixed quantity", () => {
    const at = (w: number, h: number) => job(fix, w, h, 10).total;
    /* 10×10 → 17×17 → 20×30 (large format) → 100×100 */
    expect(at(10, 10)).toBeLessThan(at(17, 17));
    expect(at(17, 17)).toBeLessThan(at(20, 30));
    expect(at(20, 30)).toBeLessThan(at(100, 100));
  });

  it("a size between two approved rows is priced between them", () => {
    /* 100×80 = 0.80 מ״ר, between 80×60 (₪105) and 120×80 (₪120) */
    const mid = job(fix, 100, 80, 1).total;
    expect(mid).toBeGreaterThan(job(fix, 80, 60, 1).total);
    expect(mid).toBeLessThan(job(fix, 120, 80, 1).total);
  });

  it("14×11 × 22 → ₪145 (short-run ramp off the surface)", () => {
    expect(job(fix, 14, 11, 22).total).toBe(145);
  });
  it("11×14 × 22 → ₪145 (orientation-insensitive)", () => {
    expect(job(fix, 11, 14, 22).total).toBe(145);
  });

  /* the LIVE config carries מינימום הזמנה 10 (kept per the 2026-08-25 review);
     the ramp math below 10 is verified on a min-free variant of the same seed */
  const rampFix = famFixture("מדבקות", { minOrderQty: 0 });

  it("qty below the live minimum (10) → מינימום הזמנה, no quote", () => {
    const j = job(fix, 3, 3, 5);
    expect(j.belowMinOrder).toBe(true);
    expect(j.total).toBe(0);
    expect(j.label).toContain("מינימום הזמנה");
  });

  it("short run never runs backwards (bug #2): qty10 ≥ qty1", () => {
    for (const [w, h] of [
      [3, 3],
      [5, 5],
      [3, 10],
    ] as [number, number][])
      expect(job(rampFix, w, h, 10).total).toBeGreaterThanOrEqual(job(rampFix, w, h, 1).total);
  });

  it("the short-run ramp reaches the reference price at the reference quantity", () => {
    /* 100 יח׳ is the reference — the ramp must land on the surface price */
    expect(job(rampFix, 5, 5, 100).total).toBe(job(fix, 5, 5, 100).total);
  });
});


/* ================================ שמשונית ================================ */
describe("שמשונית (per_m2 + approved anchors)", () => {
  const fix = famFixture("שמשונית");

  it("60×40 → ₪65 (job minimum up to 1 m²), binding rule package_min", () => {
    const j = job(fix, 60, 40, 1);
    expect(j.total).toBe(65);
    expect(j.bindingRule).toBe("package_min");
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
  it("400×200 → ₪840 outsourced (70 × 8 m² × 1.5), ≥ ₪830", () => {
    const j = job(fix, 400, 200, 1);
    expect(j.bindingRule).toBe("outsourced");
    expect(j.total).toBe(840);
    expect(j.total).toBeGreaterThanOrEqual(830);
  });
  it("400×200 with seam (ריתוך בבית) → NOT outsourced", () => {
    const j = job(fix, 400, 200, 1, { withSeam: true });
    expect(j.bindingRule).not.toBe("outsourced");
    expect(j.total).toBeGreaterThan(0);
  });
  it("120×80 × 10 → ₪470 (approved 10-pack qty tier)", () => {
    const j = job(fix, 120, 80, 10);
    expect(j.total).toBe(470);
    expect(j.bindingRule).toBe("tier");
  });
  it("200×140 (short side 140 < 150) → NOT outsourced", () => {
    const j = job(fix, 200, 140, 1);
    expect(j.bindingRule).not.toBe("outsourced");
    expect(j.total).toBeGreaterThan(0);
  });
});

/* ================================ שלטי PVC ================================ */
describe("שלטי PVC (size_ladder)", () => {
  const fix = famFixture("שלטי PVC");

  it("30×90 → ₪90 (ladder point, verbatim)", () => {
    expect(job(fix, 30, 90, 1).total).toBe(90);
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
describe("פוליגל (size_ladder + approved packs)", () => {
  const fix = famFixture("פוליגל");

  it("40×40 → ₪55", () => {
    expect(job(fix, 40, 40, 1).total).toBe(55);
  });
  it("120×80 → ₪85", () => {
    expect(job(fix, 120, 80, 1).total).toBe(85);
  });
  it("120×80 × 10 → ₪470 (approved pack)", () => {
    expect(job(fix, 120, 80, 10).total).toBe(470);
  });
  it("40×40 × 10 → ₪295 (approved pack)", () => {
    expect(job(fix, 40, 40, 10).total).toBe(295);
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
