import { describe, expect, it } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BINDING_LABEL,
  ENGINE_LABEL,
  priceJob,
  readFamilyPricing,
  writeFamilyPricing,
  type FamilyPricing,
} from "./mdvd";
import { OPTIONAL_FAMILY_CONFIGS, SPEC_ANCHORS, SPEC_FAMILY_CONFIGS } from "./pricing-defaults";
import { familyRow, specAnchorsFor } from "./pricing-fixtures";

const HEBREW = /[֐-׿]/;

/* ------------------------------------------------------------------ *
 * (a) write → read round-trip: the config that comes back from the DB
 *     prices exactly like the seed.
 * ------------------------------------------------------------------ */

/** Probe sizes that exercise every part of a family config. */
function probeSizes(cfg: FamilyPricing): [number, number][] {
  const out: [number, number][] = [];
  for (const b of cfg.sizeBuckets) if (b.maxW > 0 && b.maxH > 0) out.push([b.maxW, b.maxH]);
  for (const p of cfg.sizeLadder) out.push([p.w, p.h]);
  for (const f of cfg.formatPrices) if (f.w && f.h) out.push([f.w, f.h]);
  out.push([10, 10], [60, 40], [120, 80], [14, 11], [5, 9]);
  return out;
}

const PROBE_QTYS = [1, 7, 10, 22, 100, 500, 1000];

describe("SPEC_FAMILY_CONFIGS round-trip (writeFamilyPricing → readFamilyPricing)", () => {
  const ALL = { ...SPEC_FAMILY_CONFIGS, ...OPTIONAL_FAMILY_CONFIGS };
  for (const [name, seed] of Object.entries(ALL)) {
    it(`${name}: read-back config equals the seed field-by-field`, () => {
      const read = readFamilyPricing(familyRow(name, seed));
      expect(read.legacy).toBe(false);
      expect(seed.legacy).toBe(false);
      /* `method` is intentionally rewritten on save (legacy hint:
         anchor_curve → "sheet") — every other field must survive intact. */
      const { method: _rm, ...restRead } = read;
      const { method: _sm, ...restSeed } = seed;
      expect(restRead).toEqual(restSeed);
    });

    it(`${name}: read-back config prices identically to the seed`, () => {
      const read = readFamilyPricing(familyRow(name, seed));
      const anchors = specAnchorsFor(name);
      for (const [w, h] of probeSizes(seed)) {
        for (const qty of PROBE_QTYS) {
          const a = priceJob(seed, anchors, w, h, qty, []);
          const b = priceJob(read, anchors, w, h, qty, []);
          expect(b).not.toBeNull();
          expect(a).not.toBeNull();
          if (!a || !b) continue;
          expect(b.total).toBe(a.total);
          expect(b.bindingRule).toBe(a.bindingRule);
          expect(b.noQuote).toBe(a.noQuote);
        }
      }
    });
  }
});

/* ------------------------------------------------------------------ *
 * (b) label maps are exhaustive over their unions
 * ------------------------------------------------------------------ */

describe("label maps", () => {
  it("ENGINE_LABEL covers all 5 engines with non-empty Hebrew labels", () => {
    expect(Object.keys(ENGINE_LABEL).sort()).toEqual(
      ["anchor_curve", "per_m2", "size_ladder", "sheet_yield", "unit_floor"].sort(),
    );
    for (const label of Object.values(ENGINE_LABEL)) {
      expect(label.length).toBeGreaterThan(0);
      expect(HEBREW.test(label)).toBe(true);
    }
  });

  it("BINDING_LABEL covers all 12 binding rules with non-empty Hebrew labels", () => {
    expect(Object.keys(BINDING_LABEL).sort()).toEqual(
      [
        "validated",
        "anchor",
        "curve",
        "package_min",
        "short_run",
        "outsourced",
        "dual_surcharge",
        "min_order_value",
        "min_order_qty",
        "machine_blocked",
        "tier",
        "cost",
      ].sort(),
    );
    for (const label of Object.values(BINDING_LABEL)) {
      expect(label.length).toBeGreaterThan(0);
      expect(HEBREW.test(label)).toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ *
 * (c) SPEC_ANCHORS sanity
 * ------------------------------------------------------------------ */

describe("SPEC_ANCHORS", () => {
  it("every anchor has positive dims, qty and price, and a known family", () => {
    expect(SPEC_ANCHORS.length).toBeGreaterThan(0);
    for (const a of SPEC_ANCHORS) {
      expect(a.w).toBeGreaterThan(0);
      expect(a.h).toBeGreaterThan(0);
      expect(a.qty).toBeGreaterThanOrEqual(1);
      expect(a.price).toBeGreaterThan(0);
      expect(Object.keys(SPEC_FAMILY_CONFIGS)).toContain(a.family);
    }
  });
});

/* ------------------------------------------------------------------ *
 * (d) migration drift guard — the committed SQL must embed exactly
 *     writeFamilyPricing(seed) for every family.
 * ------------------------------------------------------------------ */

const MIGRATION_PATH = join(
  import.meta.dir,
  "..",
  "..",
  "supabase",
  "migrations",
  "20260825000000_pricing_config_v3.sql",
);

/**
 * Extract {family → parsed pricing_config JSON} from the migration.
 * Format written by scripts/generate-config-migration.ts:
 *   VALUES ('<family>', $cfg${...json...}$cfg$::jsonb ...
 * (also matches the commented-out optional-family block, which is fine —
 * only SPEC families are asserted below).
 */
function extractMigrationConfigs(sql: string): Map<string, unknown> {
  const out = new Map<string, unknown>();
  const re = /VALUES\s*\('((?:[^']|'')+)',\s*\$([A-Za-z0-9_]*)\$([\s\S]*?)\$\2\$\s*::\s*jsonb/g;
  for (let m; (m = re.exec(sql));) {
    const family = m[1]!.replace(/''/g, "'");
    try {
      out.set(family, JSON.parse(m[3]!));
    } catch {
      /* not JSON (e.g. a function body) — skip */
    }
  }
  return out;
}

/* A sibling script generates this file; skip (not fail) while it is absent. */
const migrationExists = existsSync(MIGRATION_PATH);
const maybeIt = migrationExists ? it : it.skip;

describe("pricing_config v3 migration drift guard", () => {
  maybeIt("every family's SQL JSON deep-equals writeFamilyPricing(seed)", () => {
    const sql = readFileSync(MIGRATION_PATH, "utf8");
    const configs = extractMigrationConfigs(sql);
    for (const [name, seed] of Object.entries(SPEC_FAMILY_CONFIGS)) {
      const found = configs.get(name);
      expect(found).toBeDefined();
      const expected = writeFamilyPricing(seed);
      /* tolerate either the full {v3: …} wrapper or a bare v3 block */
      const f = found as Record<string, unknown>;
      if (f && typeof f === "object" && "v3" in f) expect(f).toEqual(expected);
      else expect(f).toEqual(expected["v3"] as never);
    }
  });
});
