/* ------------------------------------------------------------------ *
 *  client-cases — the acceptance table for the 2026-09-22 pricing fix.
 *
 *  Every row is something the client asked for in the WhatsApp group
 *  (dates m/d/26) or a default chosen for an open question (Q1–Q9 in the
 *  plan). `src/lib/client-cases.test.ts` asserts each row against the seeds
 *  + the live catalog rows; `scripts/repro/run.ts` prints the same table.
 *
 *  price: ₪ incl. VAT. rule: the binding rule the engine must report.
 *  "blocked" = above the production cap; "quote" = no automatic price.
 * ------------------------------------------------------------------ */
import type { BindingRule, JobOptions } from "./mdvd";

export type ClientCase = {
  family: string;
  w: number;
  h: number;
  qty: number;
  /** expected total, or "blocked" / "quote" */
  want: number | "blocked" | "quote";
  rule?: BindingRule;
  opts?: JobOptions;
  source: string;
};

export const CLIENT_CASES: ClientCase[] = [
  /* ---- מדבקות — small sheet ---- */
  { family: "מדבקות", w: 30, h: 20, qty: 1, want: 20, rule: "sheet", source: "9/8 12:10, 9/9 07:39 — fits the small sheet = ₪20" },
  { family: "מדבקות", w: 10, h: 10, qty: 1, want: 20, rule: "sheet", source: "9/9 07:40 — 1/2/3/4 stickers = ₪20" },
  { family: "מדבקות", w: 10, h: 10, qty: 3, want: 20, rule: "sheet", source: "9/9 07:40" },
  { family: "מדבקות", w: 10, h: 10, qty: 9, want: 40, rule: "sheet", source: "8 per sheet → 2 sheets" },
  { family: "מדבקות", w: 10, h: 10, qty: 22, want: 60, rule: "sheet", source: "8/23 10:36 (≈₪70 quoted) → 3 sheets" },
  { family: "מדבקות", w: 14, h: 11, qty: 22, want: 60, rule: "sheet", source: "8 per sheet → 3 sheets" },
  { family: "מדבקות", w: 45, h: 30, qty: 1, want: 20, rule: "sheet", source: "8/23 11:23, 8/31 11:15 — 45/30 is the printable area" },
  { family: "מדבקות", w: 40, h: 30, qty: 1, want: 20, rule: "sheet", source: "8/31 11:15" },
  { family: "מדבקות", w: 5, h: 5, qty: 50, want: 63, rule: "curve", source: "Q1 default — pro-rata of the 100-pack (126) above 2 sheets (40)" },
  { family: "מדבקות", w: 17, h: 17, qty: 80, want: 287, rule: "package_min", source: "Q1 default — never above the 100-pack (site 270 for 80)" },
  { family: "מדבקות", w: 5, h: 5, qty: 100, want: 126, rule: "validated", source: "catalog pack" },
  { family: "מדבקות", w: 5, h: 5, qty: 1000, want: 345, rule: "validated", source: "catalog pack" },
  { family: "מדבקות", w: 3, h: 3, qty: 1000, want: 315, rule: "validated", source: "catalog pack" },
  /* ---- מדבקות — roll ---- */
  { family: "מדבקות", w: 46, h: 30, qty: 1, want: 95, rule: "large_format", source: "8/31 11:51 — above the small page → big printer; job minimum" },
  { family: "מדבקות", w: 46, h: 30, qty: 10, want: 175, rule: "large_format", source: "1.38 m² × ₪125 — the job is billed by area" },
  { family: "מדבקות", w: 35, h: 35, qty: 1, want: 95, rule: "large_format", source: "9/23 Michelle — job minimum" },
  { family: "מדבקות", w: 35, h: 35, qty: 4, want: 95, rule: "large_format", source: "9/23 Michelle — 4 fit in a m²; the minimum is once per job, not per unit" },
  { family: "מדבקות", w: 35, h: 35, qty: 8, want: 125, rule: "large_format", source: "0.98 m² × ₪125 — above the job minimum" },
  { family: "מדבקות", w: 70, h: 50, qty: 1, want: 100, rule: "validated", source: "approved catalog single (big-printer size)" },
  { family: "מדבקות", w: 70, h: 50, qty: 2, want: 100, rule: "large_format", source: "never less than one approved sticker (8/23 — 1 unit ₪100, 2 units ₪70 was the complaint)" },
  { family: "מדבקות", w: 17, h: 56, qty: 1, want: 95, rule: "validated", source: "approved catalog single (roll size)" },
  { family: "מדבקות", w: 100, h: 100, qty: 1, want: 120, rule: "validated", source: "approved catalog single — Yulia 9/23" },
  { family: "מדבקות", w: 120, h: 80, qty: 1, want: 120, rule: "validated", source: "approved catalog single" },
  { family: "מדבקות", w: 130, h: 130, qty: 1, want: 155, rule: "validated", source: "9/3 08:30 — split above 120, same price; catalog ₪155" },
  { family: "מדבקות", w: 140, h: 140, qty: 1, want: 180, rule: "validated", source: "approved catalog single" },
  { family: "מדבקות", w: 110, h: 100, qty: 1, want: 140, rule: "large_format", source: "no catalog row — 1.1 m² on the big printer" },
  { family: "מדבקות", w: 140, h: 100, qty: 1, want: 140, rule: "large_format", source: "no tier step: 1.4 m² never costs more than 1.5 m² (₪140)" },
  { family: "מדבקות", w: 150, h: 100, qty: 1, want: 140, rule: "large_format", source: "1.5 m² × ₪92" },
  { family: "מדבקות", w: 115, h: 8, qty: 10, want: 115, rule: "large_format", source: "0.92 m² × ₪125 — one job, one area" },
  { family: "מדבקות", w: 160, h: 160, qty: 1, want: "blocked", source: "cap 150" },
  /* ---- שמשונית ---- */
  { family: "שמשונית", w: 120, h: 10, qty: 1, want: 70, rule: "package_min", source: "8/23 10:36 — minimum ₪70" },
  { family: "שמשונית", w: 60, h: 40, qty: 1, want: 70, source: "approved anchor = minimum" },
  { family: "שמשונית", w: 120, h: 80, qty: 1, want: 90, source: "approved anchor (SPEC_ANCHORS)" },
  { family: "שמשונית", w: 300, h: 100, qty: 1, want: 170, rule: "validated", source: "live is_anchor row (site price)" },
  { family: "שמשונית", w: 160, h: 160, qty: 1, want: 205, rule: "outsourced", source: "8/31 — flat ₪80/m² above 150 (2.56 m²)" },
  { family: "שמשונית", w: 200, h: 200, qty: 1, want: 320, rule: "outsourced", source: "8/31 12:03 → 9/1 07:32 — 4 m² × ₪80" },
  { family: "שמשונית", w: 300, h: 200, qty: 1, want: 480, rule: "outsourced", source: "6 m² × ₪80" },
  { family: "שמשונית", w: 400, h: 200, qty: 1, want: 640, rule: "outsourced", source: "8 m² × ₪80" },
  { family: "שמשונית", w: 400, h: 200, qty: 1, want: 575, opts: { withSeam: true }, source: "with seam: welded in-house, 8 m² × ₪72" },
  { family: "שמשונית", w: 120, h: 80, qty: 10, want: 815, rule: "curve", source: "the ₪470 10-pack is פוליגל's; 10 × ₪81.6" },
  /* ---- פוליגל ---- */
  { family: "פוליגל", w: 40, h: 40, qty: 1, want: 90, rule: "package_min", source: "8/18 10:59 — singles ₪90" },
  { family: "פוליגל", w: 60, h: 40, qty: 1, want: 90, rule: "package_min", source: "8/18 10:59 — singles ₪90" },
  { family: "פוליגל", w: 120, h: 80, qty: 1, want: 90, rule: "package_min", source: "8/18 — same as 60×40 (Natali)" },
  { family: "פוליגל", w: 120, h: 80, qty: 5, want: 259, rule: "short_run", source: "Q5 default — linear from ₪90 to the ₪470 pack" },
  { family: "פוליגל", w: 100, h: 80, qty: 10, want: 470, rule: "tier", source: "10 signs up to 120×80 = ₪470" },
  { family: "פוליגל", w: 120, h: 80, qty: 10, want: 470, rule: "tier", source: "March campaign — 10 × 120/80 = ₪470" },
  { family: "פוליגל", w: 40, h: 40, qty: 10, want: 295, rule: "tier", source: "catalog pack" },
  { family: "פוליגל", w: 150, h: 100, qty: 1, want: 120, rule: "curve", source: "Q5/Q6 default — ₪80/m² in-house" },
  { family: "פוליגל", w: 200, h: 100, qty: 1, want: 160, rule: "curve", source: "9/3 — up to 150 wide in-house" },
  { family: "פוליגל", w: 160, h: 160, qty: 1, want: 205, rule: "outsourced", source: "Q6 default — ₪80/m² outsourced" },
  /* ---- שלטי PVC ---- */
  { family: "שלטי PVC", w: 20, h: 30, qty: 1, want: 35, source: "8/19 catalog" },
  { family: "שלטי PVC", w: 30, h: 60, qty: 1, want: 60, source: "8/19 catalog" },
  { family: "שלטי PVC", w: 30, h: 80, qty: 1, want: 80, source: "8/19 catalog" },
  { family: "שלטי PVC", w: 40, h: 60, qty: 1, want: 70, source: "8/19 catalog" },
  { family: "שלטי PVC", w: 60, h: 40, qty: 1, want: 70, source: "8/19 catalog (orientation)" },
  /* ---- פליירים ---- */
  { family: "פליירים", w: 15, h: 21, qty: 500, want: 232, rule: "anchor", source: "8/23 08:49 — site price, 'don't forget this one'" },
  { family: "פליירים", w: 15, h: 21, qty: 500, want: 232, opts: { dualSided: true }, source: "8/24 10:15 — single = double sided" },
  { family: "פליירים", w: 15, h: 21, qty: 10000, want: 1093, source: "8/25 — works" },
];
