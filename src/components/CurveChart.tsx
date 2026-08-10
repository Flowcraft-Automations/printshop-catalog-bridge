import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { curveRefPrice, shekel, type Anchor, type FamilyCurve } from "@/lib/mdvd";


type Point = Anchor & {
  /** price rescaled to the requested bundle quantity (what the chart plots) */
  price: number;
  /** the real catalog price at the item's own quantity */
  rawPrice: number;
  fit: number;
  dev: number;
  kind: "ok" | "warn" | "dropped";
};

function PointTooltip({ active, payload }: { active?: boolean; payload?: unknown }) {
  const items = (payload as { payload?: Partial<Point> }[] | undefined) ?? [];
  if (!active || items.length === 0) return null;
  const p = items.find((i) => i.payload && typeof i.payload.price === "number")?.payload;
  if (!p || typeof p.area !== "number") return null;
  const isPoint = p.kind !== undefined;
  return (
    <div className="border-2 border-[var(--ink)] bg-card p-2 text-[12px] shadow-[4px_4px_0_0_var(--ink)]">
      <div className="font-bold">{p.name ?? (p.w && p.h ? `${p.w}×${p.h}` : "המידה המבוקשת")}</div>
      {p.w && p.h ? (
        <div className="num text-muted-foreground">
          {p.w}×{p.h} · {p.area.toFixed(3)} מ״ר
        </div>
      ) : (
        <div className="num text-muted-foreground">{p.area.toFixed(3)} מ״ר</div>
      )}
      <div className="num">מחיר: {shekel(p.price)}</div>
      {typeof p.rawPrice === "number" && typeof p.qty === "number" ? (
        <div className="num text-muted-foreground">
          במחירון: {shekel(p.rawPrice)} ל־{p.qty.toLocaleString()} יח׳
        </div>
      ) : null}
      {!isPoint ? null : p.kind === "dropped" ? (
        <div className="font-bold text-muted-foreground">חריגה — לא נכללת בהתאמה</div>
      ) : (
        <>
          {typeof p.fit === "number" ? (
            <div className="num text-muted-foreground">לפי הקו: {shekel(Math.round(p.fit))}</div>
          ) : null}
          {typeof p.dev === "number" ? (
            <div className={`num ${p.kind === "warn" ? "font-bold" : "text-muted-foreground"}`}>
              סטייה {p.dev.toFixed(0)}%
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export function CurveChart({
  anchors,
  dropped,
  fit,
  requestedArea,
  requestedPrice,
  qty,
  factor,
  costRatePerM2 = 0,
  outsourceArea = null,
  outsourceRatePerM2 = 0,
  overheadFactor = 0,
}: {
  anchors: Anchor[];
  dropped: Anchor[];
  fit: FamilyCurve | null;
  requestedArea: number;
  requestedPrice: number;
  /** bundle quantity the chart is drawn for */
  qty: number;
  /** (qty / 1000)^c — scales reference prices to that quantity */
  factor: number;
  /** direct cost per m² in-house */
  costRatePerM2?: number;
  /** area above which printing is outsourced */
  outsourceArea?: number | null;
  /** direct cost per m² when outsourced */
  outsourceRatePerM2?: number;
  /** multiplier turning direct cost into a minimum sale price */
  overheadFactor?: number;
}) {

  const { ok, warn, out, line, costLine, warnCount } = useMemo(() => {
    const toPoint = (a: Anchor, isDropped: boolean): Point => {
      const shown = a.refPrice * factor;
      const f =
        fit || anchors.length
          ? curveRefPrice(anchors, fit, a.area).ref * factor
          : shown;
      const dev = (Math.abs(f - shown) / shown) * 100;
      return {
        ...a,
        price: shown,
        rawPrice: a.price,
        fit: f,
        dev,
        kind: isDropped ? "dropped" : dev > 20 ? "warn" : "ok",
      };
    };
    const pts = anchors.map((a) => toPoint(a, false));
    const outs = dropped.map((a) => toPoint(a, true));
    const areas = [...anchors, ...dropped].map((a) => a.area);
    const minA = areas.length ? Math.min(...areas) : 0;
    const maxA = areas.length ? Math.max(...areas, requestedArea || 0) : 1;
    const ln =
      fit || anchors.length
        ? Array.from({ length: 41 }, (_, i) => {
            const lo = Math.max(minA, 1e-4);
            const hi = Math.max(maxA, lo * 1.001);
            const area = lo * Math.pow(hi / lo, i / 40);
            return { area, lineY: curveRefPrice(anchors, fit, area).ref * factor };
          })
        : [];
    const ovh = overheadFactor > 0 ? overheadFactor : 0;
    const units = qty > 0 ? qty : 1;
    const costLn =
      ovh > 0 && (costRatePerM2 > 0 || outsourceRatePerM2 > 0) && ln.length > 0
        ? ln.map((p) => {
            const outsourced =
              outsourceArea != null && outsourceArea > 0 && p.area > outsourceArea && outsourceRatePerM2 > 0;
            const rate = outsourced ? outsourceRatePerM2 : costRatePerM2;
            return { area: p.area, costY: p.area * rate * units * ovh };
          })
        : [];
    return {
      ok: pts.filter((p) => p.kind === "ok"),
      warn: pts.filter((p) => p.kind === "warn"),
      out: outs,
      line: ln,
      costLine: costLn,
      warnCount: pts.filter((p) => p.kind === "warn").length,
    };
  }, [
    anchors,
    dropped,
    fit,
    requestedArea,
    factor,
    qty,
    costRatePerM2,
    outsourceArea,
    outsourceRatePerM2,
    overheadFactor,
  ]);


  if (anchors.length === 0 && dropped.length === 0) return null;

  const requested =
    requestedArea > 0 && requestedPrice > 0
      ? [{ area: requestedArea, price: requestedPrice }]
      : [];

  return (
    <section className="mb-8">
      <h2 className="mb-1 text-lg font-black">עקומת התמחור</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        {anchors.length} עוגנים · {dropped.length} חריגות · {warnCount} סטיות מעל 20% · המחירים בגרף מוצגים לכמות של {qty.toLocaleString()} יח׳
      </p>
      <div className="border-2 border-[var(--ink)] bg-card p-3 shadow-[6px_6px_0_0_var(--ink)]">
        <div className="h-[320px] w-full" dir="ltr">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart margin={{ top: 12, right: 16, bottom: 24, left: 8 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="2 4" />
              <XAxis
                type="number"
                dataKey="area"
                name="מ״ר"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--ink)"
                label={{
                  value: "מ״ר",
                  position: "insideBottom",
                  offset: -12,
                  fontSize: 11,
                  fill: "var(--muted-foreground)",
                }}
              />
              <YAxis
                type="number"
                dataKey="price"
                name="₪"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                stroke="var(--ink)"
              />
              <Tooltip content={<PointTooltip />} cursor={{ stroke: "var(--border)" }} />
              {line.length > 0 ? (
                <Line
                  data={line}
                  dataKey="lineY"
                  type="linear"
                  dot={false}
                  isAnimationActive={false}
                  stroke="var(--ink)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                />
              ) : null}
              {costLine.length > 0 ? (
                <Line
                  data={costLine}
                  dataKey="costY"
                  type="linear"
                  dot={false}
                  isAnimationActive={false}
                  stroke="oklch(0.55 0.2 25)"
                  strokeWidth={2}
                />
              ) : null}
              {outsourceArea != null && outsourceArea > 0 ? (
                <ReferenceLine
                  x={outsourceArea}
                  stroke="oklch(0.55 0.2 25)"
                  strokeDasharray="4 4"
                  label={{
                    value: `מיקור חוץ מעל ${outsourceArea} מ״ר`,
                    fontSize: 10,
                    fill: "oklch(0.5 0.2 25)",
                    position: "insideTopLeft",
                  }}
                />
              ) : null}

              <Scatter
                data={out}
                fill="transparent"
                stroke="var(--muted-foreground)"
                strokeWidth={2}
                shape="circle"
                isAnimationActive={false}
              />
              <Scatter
                data={ok}
                fill="var(--accent-raw)"
                shape="circle"
                isAnimationActive={false}
              />
              <Scatter
                data={warn}
                fill="oklch(0.7 0.17 55)"
                stroke="var(--ink)"
                strokeWidth={2}
                shape="circle"
                isAnimationActive={false}
              />
              {requested.length > 0 ? (
                <Scatter
                  data={requested}
                  fill="var(--ink)"
                  shape="diamond"
                  isAnimationActive={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-full bg-[var(--accent-raw)]" /> עוגן בהתאמה
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-full bg-[oklch(0.7_0.17_55)]" /> סטייה מעל 20%
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block size-2.5 rounded-full border-2 border-current" /> חריגה שהוסרה
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block size-2.5 rotate-45 bg-[var(--ink)]" /> המידה המבוקשת
          </span>
          <span>— — הקו המותאם</span>
        </div>
      </div>
    </section>
  );
}
