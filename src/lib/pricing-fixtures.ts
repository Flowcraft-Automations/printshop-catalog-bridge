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
 */
export function famFixture(name: string): FamFixture {
  const seed = specSeed(name);
  return {
    cfg: readFamilyPricing(familyRow(name, seed)),
    anchors: specAnchorsFor(name),
    validated: [],
  };
}
