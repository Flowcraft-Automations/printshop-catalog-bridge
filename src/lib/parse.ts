/* ------------------------------------------------------------------ *
 *  parseNumber — locale-tolerant numeric parsing for catalog data.
 *
 *  Senzey/site exports mix separator conventions in the same file:
 *    "10,000"   → 10000   (US thousands)
 *    "10.000"   → 10000   (EU thousands — dots in groups of exactly 3)
 *    "806.84"   → 806.84  (plain decimal)
 *    "1,050.5"  → 1050.5  (US mixed)
 *    "1.234,5"  → 1234.5  (EU mixed)
 *    "806,84"   → 806.84  (comma decimal)
 *  Catalog quantities/prices never carry exactly-three-digit decimal
 *  precision, so a dot followed by exactly 3 digits per group is safe
 *  to read as a thousands separator.
 * ------------------------------------------------------------------ */
export function parseNumber(v: unknown): number | null {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;

  const s = String(v)
    .trim()
    .replace(/[₪\s ]/g, "");
  if (s === "") return null;

  let normalized = s;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    normalized = s.replace(/,/g, "");
  } else if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d+,\d{1,2}$/.test(s)) {
    normalized = s.replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}
