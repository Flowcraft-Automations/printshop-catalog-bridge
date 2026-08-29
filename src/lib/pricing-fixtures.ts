/* ------------------------------------------------------------------ *
 *  pricing-fixtures — shared helpers for the pricing test suites.
 *  NOT a test file (name deliberately avoids the *.test.* pattern).
 * ------------------------------------------------------------------ */
import {
  readFamilyPricing,
  writeFamilyPricing,
  type Family,
  type FamilyPricing,
  type JobAnchor,
} from "./mdvd";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { OPTIONAL_FAMILY_CONFIGS, SPEC_ANCHORS, SPEC_FAMILY_CONFIGS } from "./pricing-defaults";

/** The approved seed config for a family (spec or optional). */
export function specSeed(name: string): FamilyPricing {
  const seed = SPEC_FAMILY_CONFIGS[name] ?? OPTIONAL_FAMILY_CONFIGS[name];
  if (!seed) throw new Error(`unknown spec family: ${name}`);
  return seed;
}

/** A families-table row as it would exist after the config migration. */
export function familyRow(name: string, cfg: FamilyPricing): Family {
  return {
    family: name,
    items_count: null,
    notes: null,
    cost_per_m2: cfg.cost,
    outsource_cost_per_m2: cfg.outsourceCost,
    outsource_width_cm: cfg.thresholdW,
    outsource_height_cm: cfg.thresholdH,
    pricing_config: writeFamilyPricing(cfg),
  };
}

export function mkAnchor(
  w: number,
  h: number,
  qty: number,
  price: number,
  name = `${w}x${h}@${qty}`,
): JobAnchor {
  return { id: name, name, w, h, area: (w * h) / 10000, qty, price };
}

/** SPEC_ANCHORS for one family, mapped to JobAnchor. */
export function specAnchorsFor(name: string): JobAnchor[] {
  return SPEC_ANCHORS.filter((a) => a.family === name).map((a) =>
    mkAnchor(a.w, a.h, a.qty, a.price),
  );
}

export type FamFixture = {
  cfg: FamilyPricing;
  anchors: JobAnchor[];
  validated: JobAnchor[];
};

/**
 * The family exactly as the app would see it after the migration:
 * seed config → writeFamilyPricing → families row → readFamilyPricing,
 * plus the approved catalog anchors mapped to JobAnchor.
 * `over` tweaks the seed before the round-trip — e.g. `{ minOrderQty: 0 }`
 * to test the short-run ramp below a family's live minimum order.
 */
export function famFixture(name: string, over: Partial<FamilyPricing> = {}): FamFixture {
  const seed = { ...specSeed(name), ...over };
  return {
    cfg: readFamilyPricing(familyRow(name, seed)),
    anchors: specAnchorsFor(name),
    /* only the catalog_surface engine reads its prices from the catalog;
       the config-driven engines are scored against their approved seed */
    validated: seed.engine === "catalog_surface" ? catalogRows(name) : [],
  };
}

/* ------------------------------------------------------------------ *
 *  The real approved price list, read from the committed dry-run
 *  export. The `catalog_surface` engine derives its price surface from
 *  these rows, so tests must be scored against them rather than against
 *  numbers hand-written into the seed.
 * ------------------------------------------------------------------ */

let CATALOG: Map<string, JobAnchor[]> | null = null;

/** Approved catalog rows for a family, from reports/dry-run-2026-08-25.csv. */
export function catalogRows(family: string): JobAnchor[] {
  if (!CATALOG) {
    CATALOG = new Map();
    /* tests run from the repo root (`bun test src`) */
    const csv = readFileSync(
      join(process.cwd(), "reports", "dry-run-2026-08-25.csv"),
      "utf8",
    ).replace(/^\uFEFF/, "");
    const [header, ...lines] = csv.trim().split("\n");
    const cols = (header ?? "").split(",");
    const at = (c: string[], name: string) => c[cols.indexOf(name)] ?? "";
    for (const line of lines) {
      const c = line.split(",");
      const fam = at(c, "family").trim();
      const w = Number(at(c, "width_cm"));
      const h = Number(at(c, "height_cm"));
      const qty = Math.max(1, Number(at(c, "qty")) || 1);
      const price = Number(at(c, "current_price"));
      if (!fam || !w || !h || !(price > 0)) continue;
      const rows = CATALOG.get(fam) ?? [];
      rows.push({
        id: `${w}x${h}@${qty}`,
        name: `${w}/${h}`,
        w,
        h,
        area: (w * h) / 10000,
        qty,
        price,
      });
      CATALOG.set(fam, rows);
    }
  }
  return CATALOG.get(family) ?? [];
}
