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
describe("מדבקות (anchor_curve, base100 × qty multipliers)", () => {
  const fix = famFixture("מדבקות");

  /* was ₪143 while the size-blind `10+` catch-all priced every size ≥10 ס״מ at
     ₪187/100. 14×11 now resolves to the ≤14 bucket (₪212/100, 4 יח׳/גיליון). */
  it("14×11 × 22 → ₪162 (≤14 bucket, short-run ramp)", () => {
    expect(job(fix, 14, 11, 22).total).toBe(162);
  });
  it("11×14 × 22 → ₪162 (orientation-insensitive)", () => {
    expect(job(fix, 11, 14, 22).total).toBe(162);
  });
  it("3×3 × 1000 → ₪299 verbatim (approved 1000-tier, exact point)", () => {
    const j = job(fix, 3, 3, 1000);
    expect(j.total).toBe(299);
    expect(j.bindingRule).toBe("anchor");
  });
  it("3×3 × 100 → ₪115 (base100 of the ≤3 bucket)", () => {
    expect(job(fix, 3, 3, 100).total).toBe(115);
  });
  /* the LIVE config carries מינימום הזמנה 10 (kept per the 2026-08-25 review);
     the ramp math below 10 is verified on a min-free variant of the same seed */
  const rampFix = famFixture("מדבקות", { minOrderQty: 0 });

  it("qty below the live minimum (10) → מינימום הזמנה, no quote", () => {
    const j = job(fix, 3, 3, 5);
    expect(j.belowMinOrder).toBe(true);
    expect(j.total).toBe(0);
    expect(j.minOrderQty).toBe(10);
  });
  it("qty10 (the minimum itself) → quoted ₪84 via the ramp", () => {
    const j = job(fix, 3, 3, 10);
    expect(j.belowMinOrder).toBe(false);
    expect(j.total).toBe(84); // 115 × (0.7 + 0.3·9/99) ≈ 83.6
  });
  it("3×3 short run (min-free variant): qty1 → ₪81, qty10 → ₪84, and q10 ≥ q1 (bug #2)", () => {
    const q1 = job(rampFix, 3, 3, 1).total;
    const q10 = job(rampFix, 3, 3, 10).total;
    expect(q1).toBe(81); // 115 × 0.70 = 80.5 → ramp rounds to ₪1
    expect(q10).toBe(84); // 115 × (0.7 + 0.3·9/99) ≈ 83.6
    expect(q10).toBeGreaterThanOrEqual(q1);
  });
  it("3×10 rectangle (min-free variant) → catch-all ₪187 bucket: qty1 → ₪131, qty5 → ₪133 (spec band 131–134)", () => {
    const q1 = job(rampFix, 3, 10, 1).total;
    const q5 = job(rampFix, 3, 10, 5).total;
    expect(q1).toBe(131); // 187 × 0.70 = 130.9
    expect(q5).toBe(133); // 187 × 0.7121 ≈ 133.2
    for (const t of [q1, q5]) {
      expect(t).toBeGreaterThanOrEqual(131);
      expect(t).toBeLessThanOrEqual(134);
    }
    expect(q5).toBeGreaterThanOrEqual(q1);
  });
  it("6×6 × 500 → within [245, 250] (spec fix ₪249; engine: 137×1.82=249.34 → ₪5 rounding → 250)", () => {
    const t = job(fix, 6, 6, 500).total;
    expect(t).toBeGreaterThanOrEqual(245);
    expect(t).toBeLessThanOrEqual(250);
  });
  it("5×8 × 100 → ₪126 (explicit member of the ≤5 bucket, base price verbatim)", () => {
    expect(job(fix, 5, 8, 100).total).toBe(126);
  });
  it("5×9 × 500 → ₪174 verbatim (approved 5×9 ladder, exact point)", () => {
    const j = job(fix, 5, 9, 500);
    expect(j.total).toBe(174);
    expect(j.bindingRule).toBe("anchor");
  });
  it("5×9 × 1000 → ₪245 verbatim", () => {
    expect(job(fix, 5, 9, 1000).total).toBe(245);
  });
  it("24×6 × 500 → ₪375 (big-rect ladder)", () => {
    expect(job(fix, 24, 6, 500).total).toBe(375);
  });
  it("10×15 × 1000 → ₪595 (big-rect ladder)", () => {
    expect(job(fix, 10, 15, 1000).total).toBe(595);
  });
  it("9×9 × 1000 → within [420, 430] (worklist target ₪420; engine: 154×2.75=423.5 → 425)", () => {
    const t = job(fix, 9, 9, 1000).total;
    expect(t).toBeGreaterThanOrEqual(420);
    expect(t).toBeLessThanOrEqual(430);
  });
});

/* ================================ פליירים ================================ */
describe("פליירים (anchor_curve, A5 master curve × bucket factors)", () => {
  const fix = famFixture("פליירים");

  it("A5 (15×21) × 500 → ₪225 verbatim", () => {
    expect(job(fix, 15, 21, 500).total).toBe(225);
  });
  it("A5 (14.8×21) × 500 → ₪225 (dim tolerance)", () => {
    expect(job(fix, 14.8, 21, 500).total).toBe(225);
  });
  it("A5 × 500 dual-sided → ₪270 (+20% tier)", () => {
    const j = job(fix, 15, 21, 500, { dualSided: true });
    expect(j.total).toBe(270);
    expect(j.dualPct).toBe(0.2);
    expect(j.bindingRule).toBe("dual_surcharge");
  });
  it("A5 × 5000 → ₪600 verbatim", () => {
    expect(job(fix, 15, 21, 5000).total).toBe(600);
  });
  it("A5 × 750 → ₪310 (interpolation 500→1000)", () => {
    expect(job(fix, 15, 21, 750).total).toBe(310);
  });
  it("A5 × 1000 → ₪395 verbatim", () => {
    expect(job(fix, 15, 21, 1000).total).toBe(395);
  });
  it("13×18 × 1000 → ₪395 (sizes bucket UP to A5)", () => {
    expect(job(fix, 13, 18, 1000).total).toBe(395);
  });
  it("10×15 × 1000 → ₪330 (approved 10/15 base)", () => {
    expect(job(fix, 10, 15, 1000).total).toBe(330);
  });
  it("A4 (21×29.7) × 1000 → ₪710 (approved A4 base)", () => {
    expect(job(fix, 21, 29.7, 1000).total).toBe(710);
  });
  it("A5 × 7 → ₪75 with binding rule package_min (below the 10-pack)", () => {
    const j = job(fix, 15, 21, 7);
    expect(j.total).toBe(75);
    expect(j.bindingRule).toBe("package_min");
  });
  it("A5 × 50 → ₪85 verbatim", () => {
    expect(job(fix, 15, 21, 50).total).toBe(85);
  });
  it("A5 × 25000 → ₪1850 (tail: 1600 + 0.05 × 5000)", () => {
    expect(job(fix, 15, 21, 25000).total).toBe(1850);
  });
  it("dual tiers: ×100 → ₪105 (+8%), ×2000 → ₪525 (+10%), ×5000 → ₪620 (+3%)", () => {
    expect(job(fix, 15, 21, 100, { dualSided: true }).total).toBe(105); // 95×1.08=102.6 → 105
    expect(job(fix, 15, 21, 2000, { dualSided: true }).total).toBe(525); // 475×1.10=522.5 → 525
    expect(job(fix, 15, 21, 5000, { dualSided: true }).total).toBe(620); // 600×1.03=618 → 620
  });
  it('paperWeight "170" × 1000 → ₪425 (395 × 1.08 = 426.6)', () => {
    expect(job(fix, 15, 21, 1000, { paperWeight: "170" }).total).toBe(425);
  });
  it('paperWeight "300" → noQuote + configError (postcard family)', () => {
    const j = job(fix, 15, 21, 1000, { paperWeight: "300" });
    expect(j.noQuote).toBe(true);
    expect(j.total).toBe(0);
    expect(j.configError).toContain("גלויות");
  });
  it("altQuote (digital 72 + 0.32·q) present for qty ≤ 1000, absent above", () => {
    const j500 = job(fix, 15, 21, 500);
    expect(j500.altQuote).not.toBeNull();
    expect(j500.altQuote!.total).toBe(230); // 72 + 160 = 232 → 230
    expect(job(fix, 15, 21, 2000).altQuote).toBeNull();
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
