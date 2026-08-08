import { useMemo } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shekel, type Anchor, type FamilyFit } from "@/lib/mdvd";

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
}: {
  anchors: Anchor[];
  dropped: Anchor[];
  fit: FamilyFit | null;
  requestedArea: number;
  requestedPrice: number;
  /** bundle quantity the chart is drawn for */
  qty: number;
  /** (qty / 1000)^c — scales reference prices to that quantity */
  factor: number;
}) {
  const { ok, warn, out, line, warnCount } = useMemo(() => {
    const toPoint = (a: Anchor, isDropped: boolean): Point => {
      const shown = a.refPrice * factor;
      const f = fit ? (fit.base + fit.rate * a.area) * factor : shown;
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
    const ln = fit
      ? [
          { area: minA, lineY: (fit.base + fit.rate * minA) * factor },
          { area: maxA, lineY: (fit.base + fit.rate * maxA) * factor },
        ]
      : [];
    return {
      ok: pts.filter((p) => p.kind === "ok"),
      warn: pts.filter((p) => p.kind === "warn"),
      out: outs,
      line: ln,
      warnCount: pts.filter((p) => p.kind === "warn").length,
    };
  }, [anchors, dropped, fit, requestedArea, factor]);

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
