import { describe, expect, it } from "bun:test";
import { parseNumber } from "./parse";

/* bug #6 — locale-tolerant numeric parsing ("10,000" and "10.000" are both
   ten thousand in the Senzey/site exports; comma decimals also appear). */
describe("parseNumber", () => {
  const CASES: [unknown, number | null][] = [
    ["10,000", 10000], // US thousands
    ["10.000", 10000], // EU thousands (dots in groups of exactly 3)
    ["806.84", 806.84], // plain decimal
    ["1,050.5", 1050.5], // US mixed
    ["1.234,5", 1234.5], // EU mixed
    ["806,84", 806.84], // comma decimal
    ["", null],
    [null, null],
    [undefined, null],
    ["כן", null], // Hebrew text is not a number
    [12000, 12000], // numbers pass through
    ["0", 0],
    ["  10,000 ", 10000], // surrounding whitespace stripped
    ["₪1,500", 1500], // shekel sign stripped
    [NaN, null], // non-finite numbers → null
  ];

  for (const [input, expected] of CASES) {
    const label = typeof input === "string" ? JSON.stringify(input) : String(input);
    it(`${label} → ${expected}`, () => {
      expect(parseNumber(input)).toBe(expected as never);
    });
  }
});
