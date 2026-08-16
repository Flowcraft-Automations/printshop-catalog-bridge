import { describe, expect, it } from "vitest";
import { priceJob, type PricingConfig } from "./pricing";

const shimshonit: PricingConfig = {
  tiers: [
    { name: "סרט", match: { max_h: 50 }, method: "per_running_meter", params: { rate: 55, min: 35 }, cost: { cost_per_m2: 20 } },
    { name: "יריעה אחת", match: { max_h: 160 }, method: "area_linear", params: { base: 20, rate_m2: 52, min: 40 }, cost: { cost_per_m2: 20 } },
    { name: "שתי יריעות", match: {}, method: "area_linear", params: { base: 0, rate_m2: 100, min: 0 }, cost: { cost_per_m2: 40 } },
  ],
  qty_model: { type: "tiers", tiers: [{ min_qty: 10, mult: 0.85 }, { min_qty: 20, mult: 0.75 }] },
  rounding: { step: 5, direction: "up" },
  cost: { overhead_mult: 1.3 },
};

const stickers: PricingConfig = {
  tiers: [
    {
      name: "קטנות",
      match: { max_w: 19.9, max_h: 19.9 },
      method: "per_sheet",
      params: {
        sheet_w: 45, sheet_h: 32, gap_cm: 0.5, setup_fee: 94, sheet_rate: 8, sheet_cost: 4,
        units_overrides: { "5x5": 30 },
      },
    },
    { name: "גדולות", match: {}, method: "reference", params: { family: "שמשונית", overrides: { min: 70 } } },
  ],
  qty_model: { type: "tiers", tiers: [{ min_qty: 10, mult: 0.85 }, { min_qty: 20, mult: 0.75 }] },
  rounding: { step: 5, direction: "up" },
  cost: { overhead_mult: 1.3 },
};

const configs = { "שמשונית": shimshonit, "מדבקות": stickers };
const price = (family: string, w: number, h: number, qty: number) =>
  priceJob({ family, w, h, qty, configs });

describe("pricing engine", () => {
  it("prices the sticker sheet ladder", () => {
    expect(price("מדבקות", 5, 5, 100).price).toBe(126);
    expect(price("מדבקות", 5, 5, 150).price).toBe(134);
    expect(price("מדבקות", 5, 5, 500).price).toBe(230);
  });

  it("prices large stickers through the שמשונית reference with a ₪70 floor", () => {
    const r = price("מדבקות", 30, 30, 1);
    expect(r.price).toBe(70);
    expect(r.tierPath).toEqual(["מדבקות", "שמשונית"]);
  });

  it("prices שמשונית tiers", () => {
    expect(price("שמשונית", 120, 80, 1).price).toBe(70);
    expect(price("שמשונית", 400, 200, 1).price).toBe(800);
    expect(price("שמשונית", 200, 40, 1).price).toBe(110);
  });

  it("refuses to price an empty size", () => {
    const r = price("שמשונית", 0, 0, 1);
    expect(r.ok).toBe(false);
    expect(r.price).toBeNull();
    expect(r.error).toBe("הזינו מידות");
  });

  it("requires a quantity for sheet tiers", () => {
    expect(price("מדבקות", 5, 5, 0).error).toBe("הזינו כמות");
  });

  it("prefers an exact catalog match within 2% area", () => {
    const r = priceJob({
      family: "שמשונית", w: 120, h: 80, qty: 1, configs,
      catalog: [{ family: "שמשונית", width_cm: 120, height_cm: 80, qty: 1, price: 90 }],
    });
    expect(r.price).toBe(90);
    expect(r.label).toBe("מחיר קטלוג");
  });

  it("attaches a cost floor from the tier", () => {
    const r = price("שמשונית", 120, 80, 1);
    expect(r.directCost).toBeCloseTo(19.2, 2);
    expect(r.costFloor).toBeCloseTo(24.96, 2);
  });
});
