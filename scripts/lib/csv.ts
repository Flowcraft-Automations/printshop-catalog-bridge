/* ------------------------------------------------------------------ *
 *  Minimal RFC-4180 CSV parse/write, BOM-aware.
 *  Offline tooling only — no runtime imports from src/.
 * ------------------------------------------------------------------ */

const BOM = "﻿";

/** Parse CSV text into rows of fields. Handles quoted fields containing
 *  commas, newlines and escaped quotes (""), and strips a leading BOM. */
export function parseCsv(text: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < src.length) {
    const c = src[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        field += c;
        i++;
      }
    } else if (c === '"') {
      inQuotes = true;
      i++;
    } else if (c === ",") {
      endField();
      i++;
    } else if (c === "\r") {
      if (src[i + 1] === "\n") i++;
      endRow();
      i++;
    } else if (c === "\n") {
      endRow();
      i++;
    } else {
      field += c;
      i++;
    }
  }
  /* last row without trailing newline */
  if (field !== "" || row.length) endRow();
  return rows;
}

function encodeField(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "number" ? String(v) : v;
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Render rows as CSV: CRLF line endings, quoting only where needed,
 *  prefixed with a UTF-8 BOM (Excel-friendly Hebrew). */
export function writeCsv(rows: (string | number | null)[][]): string {
  return BOM + rows.map((r) => r.map(encodeField).join(",")).join("\r\n") + "\r\n";
}

/** The Hebrew export headers (catalog CSV export) → product field names.
 *  Columns not listed here are ignored by the report tooling. */
export const HEADER_MAP: Record<string, string> = {
  שם: "name",
  מפתח: "row_key",
  משפחה: "family",
  רוחב: "width_cm",
  גובה: "height_cm",
  כמות: "qty",
  "קיים בסנזיי": "senzey_exists",
  "מזהי סנזיי": "senzey_ids",
  "מחיר סנזיי": "senzey_price",
  "כפילויות סנזיי": "senzey_dup_count",
  "קיים באתר": "site_exists",
  קישור: "site_url",
  "מחיר אתר": "site_price",
  "סטטוס סנזיי": "senzey_status",
  "סטטוס אתר": "site_status",
  אומת: "verified",
  עוגן: "is_anchor",
  הערות: "notes",
  "קבוצה בסנזיי": "senzey_group",
  "קטגוריה באתר": "site_category",
  "מחיר מתחרה": "competitor_price",
  "מקור מחיר מתחרה": "competitor_ref",
  "מחיר מוצע": "proposed_price",
  מקור: "source",
};
