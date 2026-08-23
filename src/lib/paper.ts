/* standard paper / print sizes in cm, orientation-agnostic labelling */

export type PaperSize = { label: string; w: number; h: number };

export const PAPER_SIZES: PaperSize[] = [
  { label: "A0", w: 84.1, h: 118.9 },
  { label: "A1", w: 59.4, h: 84.1 },
  { label: "A2", w: 42, h: 59.4 },
  { label: "A3", w: 29.7, h: 42 },
  { label: "A4", w: 21, h: 29.7 },
  { label: "A5", w: 14.8, h: 21 },
  { label: "A6", w: 10.5, h: 14.8 },
  { label: "A7", w: 7.4, h: 10.5 },
  { label: "B2", w: 50, h: 70 },
  { label: "B3", w: 35, h: 50 },
];

/** tolerance in cm — a size is labelled when both edges are within this range */
const TOL = 0.7;

/** returns the standard size label for the given dimensions, or null */
export function paperLabel(w: number, h: number): string | null {
  if (!w || !h) return null;
  const a = Math.min(w, h);
  const b = Math.max(w, h);
  const hit = PAPER_SIZES.find(
    (p) => Math.abs(Math.min(p.w, p.h) - a) <= TOL && Math.abs(Math.max(p.w, p.h) - b) <= TOL,
  );
  return hit ? hit.label : null;
}
