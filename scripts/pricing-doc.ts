/* ------------------------------------------------------------------ *
 *  pricing-doc — renders docs/PRICING.md from the seeds: for every priced
 *  family, the rule in plain Hebrew (the same narrative the calculator
 *  shows, generated from the plan) and the exact config JSON. Regenerate
 *  whenever pricing-defaults.ts changes:
 *
 *      bun run scripts/pricing-doc.ts
 * ------------------------------------------------------------------ */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ENGINE_LABEL, prepareFamily, readFamilyPricing, writeFamilyPricing } from "../src/lib/mdvd";
import { explainFamily } from "../src/lib/pricing/explain";
import { resolvePlan } from "../src/lib/pricing/plan";
import { SPEC_FAMILY_CONFIGS } from "../src/lib/pricing-defaults";
import { familyRow, specAnchorsFor } from "../src/lib/pricing-fixtures";
import { CLIENT_CASES } from "../src/lib/client-cases";

const BINDS: Record<string, string> = {
  all: "כל שורה מאומתת בקטלוג קובעת מחיר",
  anchors: "רק שורות שסומנו ⚓ (עוגן) קובעות מחיר",
  packs: "חבילות (מכמות החבילה הקטנה) ומדבקות שאינן נכנסות לדף הקטן קובעות מחיר; בודדים בדף הקטן — לפי הדף",
  none: "הקטלוג אינו קובע מחיר — נוסחה בלבד",
};

const out: string[] = [];
out.push("# תמחור MDVD — הכללים לפי משפחה");
out.push("");
out.push(
  "נוצר אוטומטית מ-`src/lib/pricing-defaults.ts` (`bun run scripts/pricing-doc.ts`). זהו מקור האמת: מה שמופיע כאן הוא מה שהמחשבון מחשב אחרי הפעלת המיגרציה. הקטלוג (`products`) אינו נערך על ידי הקוד — הוא יומן ידני של מה שיש באתר ובסנזי.",
);
out.push("");
out.push("## מקרי הלקוח (בדיקת קבלה)");
out.push("");
out.push("| משפחה | מידה | כמות | מחיר | כלל | מקור |");
out.push("|---|---|---|---|---|---|");
for (const c of CLIENT_CASES)
  out.push(
    `| ${c.family} | ${c.w}×${c.h}${c.opts ? " " + JSON.stringify(c.opts) : ""} | ${c.qty} | ${typeof c.want === "number" ? "₪" + c.want : c.want} | ${c.rule ?? ""} | ${c.source.replace(/\|/g, "/")} |`,
  );
out.push("");
for (const [name, seed] of Object.entries(SPEC_FAMILY_CONFIGS)) {
  const cfg = readFamilyPricing(familyRow(name, seed));
  const anchors = specAnchorsFor(name);
  const prepared = prepareFamily(cfg, anchors, []);
  const ex = explainFamily(cfg, resolvePlan(cfg, cfg.plan), prepared);
  out.push(`## ${name}`);
  out.push("");
  out.push(`**מנוע:** ${ENGINE_LABEL[cfg.engine]} · **קטלוג:** ${BINDS[cfg.catalogBinds] ?? cfg.catalogBinds}`);
  out.push("");
  out.push("**איך נקבע המחיר:**");
  out.push("");
  for (const s of ex.steps) out.push(`1. ${s.he}`);
  if (ex.settings.length) {
    out.push("");
    out.push("**הגדרות בתוקף:** " + ex.settings.map((s) => s.he).join(" · "));
  }
  if (ex.todos.length) {
    out.push("");
    out.push("**פתוח:** " + ex.todos.join(" · "));
  }
  out.push("");
  out.push("<details><summary>התצורה המלאה (pricing_config.v3)</summary>");
  out.push("");
  out.push("```json");
  out.push(JSON.stringify((writeFamilyPricing(seed) as { v3: unknown }).v3, null, 2));
  out.push("```");
  out.push("");
  out.push("</details>");
  out.push("");
}
const path = resolve(import.meta.dir, "../docs/PRICING.md");
mkdirSync(resolve(import.meta.dir, "../docs"), { recursive: true });
writeFileSync(path, out.join("\n") + "\n");
console.log(`written: ${path}`);
