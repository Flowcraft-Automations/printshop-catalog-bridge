import {
  ENGINE_LABEL,
  printableSheet,
  shekel,
  type FamilyPricing,
  type PreparedFamily,
} from "../mdvd";
import { MATERIAL_LABEL } from "./modifiers";
import type { PricingPlan } from "./plan";

/* ------------------------------------------------------------------ *
 *  Human explanation of how a family is priced.
 *
 *  Generated from the SAME plan and config the engine prices from, so it
 *  cannot drift from what actually happens. A hand-written description
 *  per family would be wrong the first time anyone edits a number.
 *
 *  Hebrew is shown to everyone; English is added for admins.
 * ------------------------------------------------------------------ */

export type ExplainLine = { he: string; en: string };

export type FamilyExplanation = {
  /** ordered narrative: what decides the price, first rule to last */
  steps: ExplainLine[];
  /** the settings actually in force for this family */
  settings: ExplainLine[];
  /** gaps the client still has to fill */
  todos: string[];
};

const n = (v: number) => v.toLocaleString();

function describeSource(
  cfg: FamilyPricing,
  plan: PricingPlan,
  prepared: PreparedFamily | null,
): ExplainLine {
  switch (plan.source.kind) {
    case "catalog_surface": {
      const sheet = prepared?.sheetSurface?.rows ?? 0;
      const large = prepared?.largeSurface?.rows ?? 0;
      const built = sheet + large;
      return {
        he:
          `המחיר נבנה מהשורות המאומתות בקטלוג: מחיר לפי שטח × מקדם לפי כמות — שני הגורמים נלמדים מהמחירון שלכם` +
          (built
            ? ` (${n(built)} שורות מאומתות בשימוש)`
            : ` — כרגע אין די שורות מאומתות, ולכן המחיר לפי התצורה`),
        en:
          `Price is built from the approved catalog rows: price by area × a quantity multiplier, both learned from your price list` +
          (built
            ? ` (${n(built)} approved rows in use)`
            : ` — not enough approved rows yet, so it falls back to configuration`),
      };
    }
    case "size_ladder":
      return {
        he: `סולם מידות: ${n(cfg.sizeLadder.length)} מידות מאושרות; מידה שאינה בסולם מתומחרת בין שתי השכנות לפי שטח`,
        en: `Size ladder: ${n(cfg.sizeLadder.length)} approved sizes; a size not on the ladder is interpolated by area between its two neighbours`,
      };
    case "per_m2": {
      const tiers = cfg.perM2Tiers.map((t) => `${t.minM2}+ מ״ר → ${shekel(t.rate)}`).join(" · ");
      return {
        he: `לפי מ״ר${tiers ? `: ${tiers}` : ""}${cfg.minJobPrice > 0 ? ` · מינימום ${shekel(cfg.minJobPrice)} ליחידה` : ""}`,
        en: `Per square metre${tiers ? `: ${tiers}` : ""}${cfg.minJobPrice > 0 ? ` · minimum ${shekel(cfg.minJobPrice)} per unit` : ""}`,
      };
    }
    case "sheet_yield": {
      const s = printableSheet(cfg);
      return {
        he: `תפוקת גיליון: כמה יחידות נכנסות בגיליון ${s.w}×${s.h} ס״מ, ומחיר לפי מספר הגיליונות`,
        en: `Sheet yield: how many units fit a ${s.w}×${s.h} cm sheet, priced by the number of sheets used`,
      };
    }
    case "unit_floor":
      return {
        he: `מחירי פורמט קבועים: ${n(cfg.formatPrices.length)} תצורות מאושרות`,
        en: `Fixed format prices: ${n(cfg.formatPrices.length)} approved configurations`,
      };
    case "anchor_curve":
      return {
        he: `עקומת עוגנים: מחיר בסיס לפי דלי גודל × מקדם כמות (${n(cfg.sizeBuckets.length)} דליים)`,
        en: `Anchor curve: a base price per size bucket × a quantity multiplier (${n(cfg.sizeBuckets.length)} buckets)`,
      };
    case "two_machine_sheet": {
      const s = printableSheet(cfg);
      const tiers = cfg.perM2Tiers.map((t) => `${t.minM2}+ מ״ר → ${shekel(t.rate)}`).join(" · ");
      return {
        he:
          `שתי מדפסות. מדבקה שנכנסת לדף הקטן (${s.w}×${s.h} ס״מ) מתומחרת לפי דפים — ${shekel(cfg.sheetPrice)} לדף לפי כמה מדבקות נכנסות בדף — ולעולם לא יותר מחבילת ${n(cfg.shortRunRefQty)} היחידות של דלי הגודל; ` +
          `מ-${n(cfg.shortRunRefQty)} יחידות המחיר הוא מחירי החבילות של האתר. ` +
          `מדבקה שאינה נכנסת לדף הקטן מודפסת במדפסת הגדולה (דף גדול) לפי מ״ר — השטח נספר על כל היחידות יחד${tiers ? ` (${tiers})` : ""}${cfg.minJobPrice > 0 ? `, ומינימום ${shekel(cfg.minJobPrice)} נגבה פעם אחת לעבודה` : ""}`,
        en:
          `Two printers. A sticker that fits the small page (${s.w}×${s.h} cm) is priced per page — ${shekel(cfg.sheetPrice)} a page by how many stickers fit — and never above the size bucket's ${n(cfg.shortRunRefQty)}-unit pack; ` +
          `from ${n(cfg.shortRunRefQty)} units the website pack prices apply. ` +
          `A sticker that does not fit the small page is printed on the big printer (big page) per m², counting the area of all units together${tiers ? ` (${tiers})` : ""}${cfg.minJobPrice > 0 ? `, with a ${shekel(cfg.minJobPrice)} minimum once per job` : ""}`,
      };
    }
    case "cost_plus":
      return {
        he: `עלות-פלוס: (עלות נייר + עלות הדפסה × צדדים) × מקדם ${plan.source.markup}`,
        en: `Cost-plus: (paper cost + click cost × sides) × markup ${plan.source.markup}`,
      };
  }
}

export function explainFamily(
  cfg: FamilyPricing,
  plan: PricingPlan,
  prepared: PreparedFamily | null,
): FamilyExplanation {
  const steps: ExplainLine[] = [];

  const quoteOnly = plan.gates.find((g) => g.kind === "quote_only");
  if (quoteOnly) {
    steps.push({
      he: "משפחה זו מתומחרת ידנית — כל מידה מוחזרת כהצעת מחיר, ללא מחיר אוטומטי",
      en: "This family is priced by hand — every size returns a quote request, never an automatic price",
    });
    return { steps, settings: [], todos: cfg.todos };
  }

  const s0 = printableSheet(cfg);
  steps.push(
    cfg.catalogBinds === "none"
      ? {
          he: "הקטלוג אינו קובע מחיר למשפחה זו — המחיר מחושב מהנוסחה בלבד; השורות המאומתות מוצגות להשוואה",
          en: "The catalog does not set prices for this family — the formula alone prices it; approved rows are shown for comparison",
        }
      : cfg.catalogBinds === "anchors"
        ? {
            he: "רק שורה שסומנה כעוגן ⚓ בקטלוג, לאותה מידה ולאותה כמות, נלקחת כמות שהיא — לפני כל חישוב; שאר השורות המאומתות משמשות להשוואה",
            en: "Only a catalog row marked as an anchor ⚓, for this exact size and quantity, is used as-is before any calculation; other approved rows are for comparison",
          }
        : cfg.catalogBinds === "packs"
          ? {
              he: `מחיר מאומת בקטלוג נלקח כמות שהוא לחבילות (מ-${n(cfg.shortRunRefQty)} יח׳) ולמדבקות שאינן נכנסות לדף הקטן (${s0.w}×${s0.h} ס״מ); מדבקה בודדת שנכנסת לדף הקטן מתומחרת לפי הדף`,
              en: `An approved catalog price is used as-is for packs (from ${n(cfg.shortRunRefQty)} units) and for stickers that do not fit the small page (${s0.w}×${s0.h} cm); a single sticker that fits the small page is priced by the page`,
            }
          : {
              he: "מחיר מאומת בקטלוג לאותה מידה ולאותה כמות נלקח כמות שהוא — לפני כל חישוב",
              en: "An approved catalog price for this exact size and quantity is used as-is, before any calculation",
            },
  );

  steps.push(describeSource(cfg, plan, prepared));

  for (const g of plan.gates) {
    if (g.kind === "min_order_qty")
      steps.push({
        he: `מתחת ל-${n(g.qty)} יחידות אין מחיר${g.exemptLargeFormat ? " (למעט פורמט גדול, שאינו עבודת גיליון)" : ""}`,
        en: `Below ${n(g.qty)} units there is no price${g.exemptLargeFormat ? " (except large format, which is not sheet work)" : ""}`,
      });
    if (g.kind === "machine_limit" && cfg.maxPrintW > 0) {
      const over =
        cfg.overLimit === "weld"
          ? {
              he: `מידה רחבה מ-${cfg.maxPrintW} ס״מ מסופקת בכמה חלקים — אותו מחיר, כי שטח החומר זהה`,
              en: `A size wider than ${cfg.maxPrintW} cm is delivered in several parts — same price, since the material area is unchanged`,
            }
          : cfg.overLimit === "mount"
            ? {
                he: `מידה רחבה מ-${cfg.maxPrintW} ס״מ מודבקת על לוח`,
                en: `A size wider than ${cfg.maxPrintW} cm is mounted on a board`,
              }
            : cfg.overLimit === "outsource"
              ? {
                  he: `מידה שצידה הצר רחב מ-${cfg.maxPrintW} ס״מ מיוצרת בייצור חוץ${cfg.outsourcedRateM2 > 0 ? ` — ${shekel(cfg.outsourcedRateM2)} למ״ר${cfg.minJobPrice > 0 ? `, מינימום ${shekel(cfg.minJobPrice)}` : ""}` : ""} (עם תפר: ריתוך פאנלים בבית)`,
                  en: `A size whose short side exceeds ${cfg.maxPrintW} cm is outsourced${cfg.outsourcedRateM2 > 0 ? ` — ${shekel(cfg.outsourcedRateM2)} per m²${cfg.minJobPrice > 0 ? `, minimum ${shekel(cfg.minJobPrice)}` : ""}` : ""} (with a seam: welded in-house)`,
                }
            : {
                he: `מידה רחבה מ-${cfg.maxPrintW} ס״מ אינה מיוצרת`,
                en: `A size wider than ${cfg.maxPrintW} cm is not produced`,
              };
      steps.push({
        he: `רוחב הדפסה מרבי ${cfg.maxPrintW} ס״מ · ${over.he}${cfg.capW > 0 ? ` · גבול ייצור מוחלט ${cfg.capW} ס״מ` : ""}`,
        en: `Maximum print width ${cfg.maxPrintW} cm · ${over.en}${cfg.capW > 0 ? ` · absolute production limit ${cfg.capW} cm` : ""}`,
      });
    }
  }

  for (const m of plan.modifiers) {
    if (m.kind === "dual_sided")
      steps.push({
        he: `הדפסה דו-צדדית מוסיפה אחוז לפי כמות (${n(m.tiers.length)} מדרגות)`,
        en: `Double-sided printing adds a percentage by quantity (${n(m.tiers.length)} tiers)`,
      });
    if (m.kind === "paper_weight")
      steps.push({
        he: `משקל נייר משנה את המחיר: ${Object.entries(m.pct)
          .map(([k, v]) => `${k} גר׳ +${Math.round(v * 100)}%`)
          .join(" · ")}`,
        en: `Paper weight adjusts the price: ${Object.entries(m.pct)
          .map(([k, v]) => `${k}g +${Math.round(v * 100)}%`)
          .join(" · ")}`,
      });
    if (m.kind === "material_surcharge")
      steps.push({
        he: `חומר משנה את המחיר: ${Object.entries(m.pct)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${MATERIAL_LABEL[k] ?? k} +${Math.round(v * 100)}%`)
          .join(" · ")}`,
        en: `Material adjusts the price: ${Object.entries(m.pct)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${k} +${Math.round(v * 100)}%`)
          .join(" · ")}`,
      });
    if (m.kind === "size_floor")
      steps.push({
        he: "המחיר לעולם אינו נמוך ממידה מאושרת קטנה יותר (בשני הממדים) באותה כמות — הרצפה הופכת למחיר",
        en: "The price never drops below an approved size that is smaller in both dimensions at the same quantity — that floor becomes the price",
      });
    if (m.kind === "cost_floor")
      steps.push({
        he: `המחיר לעולם אינו נמוך מעלות הייצור × מקדם הרווח (${cfg.margin}) — הרצפה הופכת למחיר`,
        en: `The price never drops below production cost × the profit factor (${cfg.margin}) — that floor becomes the price`,
      });
    if (m.kind === "min_order_value")
      steps.push({
        he: `מינימום הזמנה ${shekel(m.value)} — עבודה קטנה יותר מתומחרת בסכום הזה`,
        en: `Minimum order ${shekel(m.value)} — a smaller job is priced at that amount`,
      });
  }

  steps.push({
    he: "לבסוף המחיר מעוגל: עד ₪20 לחצי שקל · עד ₪100 לשקל · מעל ₪100 לחמישה שקלים",
    en: "Finally the price is rounded: under ₪20 to ₪0.5 · under ₪100 to ₪1 · above ₪100 to ₪5",
  });

  const s = printableSheet(cfg);
  const settings: ExplainLine[] = [
    {
      he: `מנוע תמחור: ${ENGINE_LABEL[cfg.engine]}`,
      en: `Pricing engine: ${ENGINE_LABEL[cfg.engine]}`,
    },
  ];
  if (cfg.minOrderQty > 1)
    settings.push({
      he: `מינימום הזמנה: ${n(cfg.minOrderQty)} יחידות`,
      en: `Minimum order: ${n(cfg.minOrderQty)} units`,
    });
  if (cfg.minOrderValue > 0)
    settings.push({
      he: `מינימום הזמנה: ${shekel(cfg.minOrderValue)}`,
      en: `Minimum order value: ${shekel(cfg.minOrderValue)}`,
    });
  if (cfg.maxPrintW > 0)
    settings.push({
      he: `רוחב הדפסה: ${cfg.maxPrintW} ס״מ`,
      en: `Print width: ${cfg.maxPrintW} cm`,
    });
  if (cfg.capW > 0 || cfg.capL > 0)
    settings.push({
      he: `גבול ייצור: ${cfg.capW || "∞"}×${cfg.capL || "∞"} ס״מ`,
      en: `Production limit: ${cfg.capW || "∞"}×${cfg.capL || "∞"} cm`,
    });
  /* only list settings the family's source actually reads — a setting shown
     for a family that ignores it is worse than showing nothing */
  const sheetBased =
    cfg.engine === "catalog_surface" ||
    cfg.engine === "anchor_curve" ||
    cfg.engine === "sheet_yield" ||
    cfg.engine === "two_machine_sheet";
  if (sheetBased)
    settings.push(
      cfg.engine === "two_machine_sheet"
        ? { he: `שטח הדף הקטן: ${s.w}×${s.h} ס״מ`, en: `Small page area: ${s.w}×${s.h} cm` }
        : { he: `שטח הדפסה: ${s.w}×${s.h} ס״מ`, en: `Printable sheet: ${s.w}×${s.h} cm` },
    );
  if (cfg.engine === "two_machine_sheet")
    settings.push({
      he: `דף קטן: ${shekel(cfg.sheetPrice)} · חבילות מ-${n(cfg.shortRunRefQty)} יח׳ · מדפסת גדולה: מינימום ${shekel(cfg.minJobPrice)} לעבודה`,
      en: `Small page: ${shekel(cfg.sheetPrice)} · packs from ${n(cfg.shortRunRefQty)} units · big printer: minimum ${shekel(cfg.minJobPrice)} per job`,
    });
  if (cfg.overLimit === "outsource" && cfg.outsourcedRateM2 > 0)
    settings.push({
      he: `ייצור חוץ: ${shekel(cfg.outsourcedRateM2)} למ״ר`,
      en: `Outsourced: ${shekel(cfg.outsourcedRateM2)} per m²`,
    });
  const usesShortRun = cfg.engine === "catalog_surface" || cfg.engine === "anchor_curve";
  if (usesShortRun && cfg.shortRunPct > 0 && cfg.shortRunPct < 1)
    settings.push({
      he: `ריצה קצרה: ${Math.round(cfg.shortRunPct * 100)}% ממחיר ${n(cfg.shortRunRefQty)} יח׳`,
      en: `Short run: ${Math.round(cfg.shortRunPct * 100)}% of the ${n(cfg.shortRunRefQty)}-unit price`,
    });
  if (cfg.qtyExponentPinned && usesShortRun)
    settings.push({
      he: `מקדם כמות: ${cfg.qtyExponent}`,
      en: `Quantity exponent: ${cfg.qtyExponent}`,
    });

  return { steps, settings, todos: cfg.todos };
}
