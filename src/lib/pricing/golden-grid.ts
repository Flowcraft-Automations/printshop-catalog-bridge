import type { JobPrice } from "../mdvd";

/* ------------------------------------------------------------------ *
 *  The characterization grid.
 *
 *  golden-prices.txt is a snapshot of what the engine returned BEFORE
 *  the pipeline refactor. It exists so the refactor can be proven not to
 *  move a single price: the differential test replays this grid and
 *  compares signatures. It is generated, never hand-edited — regenerate
 *  it only when a price change is intended and reviewed.
 * ------------------------------------------------------------------ */

export const GOLDEN_QTY = [
  1, 5, 10, 22, 50, 99, 100, 101, 150, 250, 499, 500, 501, 750, 1000, 2000, 5000, 10000,
];

export const GOLDEN_SIZES: [number, number][] = [
  [3, 3],
  [4, 4],
  [5, 5],
  [5, 9],
  [6, 6],
  [8, 5],
  [9, 9],
  [10, 10],
  [14, 11],
  [15, 21],
  [16, 6],
  [17, 17],
  [20, 30],
  [21, 29.7],
  [24, 6],
  [30, 20],
  [40, 40],
  [50, 70],
  [60, 40],
  [70, 50],
  [80, 60],
  [90, 90],
  [100, 70],
  [100, 100],
  [115, 8],
  [120, 80],
  [120, 100],
  [130, 130],
  [140, 140],
  [150, 100],
  [200, 100],
  [240, 120],
  [14.8, 21],
];

export const GOLDEN_OPTS = [
  {},
  { dualSided: true },
  { paperWeight: "170" },
  { withSeam: true },
] as const;

/** Everything about a quote that must not drift: price, the rule that set it, and its flags. */
export function signature(j: JobPrice | null): string {
  if (j === null) return "-";
  const flags =
    `${j.noQuote ? "n" : ""}${j.belowMinOrder ? "m" : ""}${j.overMachine ? "x" : ""}` +
    `${j.panels > 1 ? `p${j.panels}` : ""}`;
  return `${j.total};${j.bindingRule}${flags ? ";" + flags : ""}`;
}
