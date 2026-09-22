/* ------------------------------------------------------------------ *
 *  catalog-agreement — for every VERIFIED catalog row, what the family's
 *  formula alone (catalog_binds = none) would charge, next to the catalog
 *  price. Turns the catalog from a silent override into a report the
 *  client can read: rows that agree can be marked ⚓ in the app, rows that
 *  disagree need a decision (update the site, or change the rule).
 *
 *      bun run scripts/catalog-agreement.ts --json supabase/snapshots/2026-09-22/products-verified.json
 *      bun run scripts/catalog-agreement.ts --json … מדבקות שמשונית      # some families
 *      bun run scripts/catalog-agreement.ts --live                       # needs service-role env
 *      … --out reports/catalog-agreement.csv                             # also write a CSV
 *
 *  Prices come from the SEED config (pricing-defaults.ts), i.e. what the
 *  app prices with once the families migration is applied. Read-only:
 *  never writes to the database.
 * ------------------------------------------------------------------ */
import { writeFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import {
  familyAnchors,
  familyValidated,
  prepareFamily,
  priceJob,
  readFamilyPricing,
  shekel,
  type JobAnchor,
  type Product,
} from "../src/lib/mdvd";
import { SPEC_FAMILY_CONFIGS } from "../src/lib/pricing-defaults";
import { familyRow } from "../src/lib/pricing-fixtures";
import { loadProductsLive, parseArgs } from "./lib/config-seed";

const args = parseArgs(process.argv.slice(2));
const outIdx = args.rest.indexOf("--out");
const outPath = outIdx >= 0 ? args.rest[outIdx + 1] ?? null : null;
const families = args.rest.filter((a, i) => a !== "--out" && i !== outIdx + 1);

function toProducts(rows: Record<string, unknown>[]): Product[] {
  const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
  return rows.map((r, i) => ({
    id: String(r["id"] ?? r["row_key"] ?? i),
    row_key: String(r["row_key"] ?? ""),
    name: String(r["name"] ?? ""),
    family: r["family"] == null ? null : String(r["family"]).trim(),
    width_cm: num(r["width_cm"]),
    height_cm: num(r["height_cm"]),
    qty: num(r["qty"]),
    senzey_exists: null,
    senzey_ids: null,
    senzey_price: num(r["senzey_price"]),
    senzey_dup_count: null,
    site_exists: null,
    site_url: null,
    site_price: num(r["site_price"]),
    final_price: num(r["final_price"]),
    senzey_status: "",
    site_status: "",
    anomaly: null,
    notes: null,
    source: null,
    verified: r["verified"] === true || r["verified"] === "true",
    is_anchor: r["is_anchor"] === true || r["is_anchor"] === "true",
  })) as unknown as Product[];
}

const rows: Record<string, unknown>[] = args.live
  ? await loadProductsLive()
  : args.json
    ? (JSON.parse(readFileSync(args.json, "utf8")) as Record<string, unknown>[])
    : (() => {
        console.error("usage: --json <products export> | --live  [family …] [--out file.csv]");
        process.exit(2);
      })();
const products = toProducts(rows);

type Line = {
  family: string;
  row: JobAnchor;
  engine: number | null;
  rule: string;
  delta: number | null;
};
const csv: string[] = ["family,width_cm,height_cm,qty,is_anchor,catalog_price,engine_price,delta_pct,rule"];
const names = Object.keys(SPEC_FAMILY_CONFIGS).filter((n) => !families.length || families.includes(n));
for (const name of names) {
  const seed = SPEC_FAMILY_CONFIGS[name]!;
  const cfg = readFamilyPricing(familyRow(name, seed));
  const anchors = familyAnchors(products, name);
  const validated = familyValidated(products, name);
  if (!validated.length) continue;
  const prepared = prepareFamily(cfg, anchors, validated, { catalogBinds: "none" });
  const lines: Line[] = validated.map((row) => {
    const j = priceJob(cfg, anchors, row.w, row.h, row.qty, validated, {
      catalogBinds: "none",
      prepared,
    });
    const engine = j && !j.noQuote && !j.overMachine && !j.belowMinOrder ? j.total : null;
    const rule = !j ? "-" : j.overMachine ? "blocked" : j.noQuote ? "quote" : j.belowMinOrder ? "min-order" : j.bindingRule;
    return { family: name, row, engine, rule, delta: engine !== null ? (engine - row.price) / row.price : null };
  });
  const scored = lines.filter((l) => l.delta !== null) as (Line & { delta: number })[];
  const abs = scored.map((l) => Math.abs(l.delta)).sort((a, b) => a - b);
  const mean = abs.length ? abs.reduce((t, x) => t + x, 0) / abs.length : 0;
  const median = abs.length ? abs[Math.floor(abs.length / 2)]! : 0;
  const within10 = abs.filter((x) => x <= 0.1).length;
  console.log(
    `\n# ${name} — engine ${cfg.engine}, catalog_binds ${cfg.catalogBinds} · ${validated.length} verified rows (${anchors.length} ⚓) · ` +
      `formula prices ${scored.length} · mean |Δ| ${Math.round(mean * 100)}% · median ${Math.round(median * 100)}% · within 10%: ${within10}/${scored.length}`,
  );
  const sorted = [...lines].sort((a, b) => Math.abs(b.delta ?? 9) - Math.abs(a.delta ?? 9));
  console.log(`  ${"size".padEnd(10)} ${"qty".padStart(5)} ${"⚓".padEnd(2)} ${"catalog".padStart(9)} ${"formula".padStart(9)} ${"Δ".padStart(6)}  rule`);
  for (const l of sorted) {
    const d = l.delta === null ? "  n/a" : `${l.delta > 0 ? "+" : ""}${Math.round(l.delta * 100)}%`;
    console.log(
      `  ${`${l.row.w}×${l.row.h}`.padEnd(10)} ${String(l.row.qty).padStart(5)} ${(l.row.anchor ? "⚓" : "").padEnd(2)} ${shekel(l.row.price).padStart(9)} ${(l.engine === null ? "—" : shekel(l.engine)).padStart(9)} ${d.padStart(6)}  ${l.rule}`,
    );
    csv.push(
      [name, l.row.w, l.row.h, l.row.qty, l.row.anchor ? 1 : 0, l.row.price, l.engine ?? "", l.delta === null ? "" : (l.delta * 100).toFixed(1), l.rule]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    );
  }
}
if (outPath) {
  writeFileSync(outPath, "﻿" + csv.join("\r\n") + "\r\n");
  console.log(`\nwritten: ${outPath}`);
}
