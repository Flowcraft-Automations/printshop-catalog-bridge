# Pricing curve chart in the calculator

Add a visual chart of the family's pricing curve so outliers are obvious at a glance.

## What you'll see

A chart panel under the family items table, shown once a family is selected:

- X axis = area (מ״ר), Y axis = price (₪).
- Each catalog item with a size and price is a dot.
- The fitted line (base + rate × area) is drawn across the chart.
- Dots are color-coded:
  - accent = anchor used in the fit
  - grey outline = anomaly dropped by the ×2.5 median filter
  - orange ring = anchor kept in the fit but deviating more than 20% from the line (suspicious, worth a manual look)
- The requested size (once width/height are entered) is plotted as a distinct marker so you can see where your quote falls on the curve.
- Hover tooltip shows: product name, size, area, actual price, fitted price, and deviation %.
- A short legend plus counts: "N עוגנים · X חריגות · Y סטיות מעל 20%".

## Technical notes

- `src/lib/mdvd.ts`: `buildAnchors` also returns `dropped: Anchor[]` (the anomalies it filters out) and each `Anchor` carries the source product name, so the chart can label points. Existing callers keep working — the `skipped` count stays.
- New component `src/components/CurveChart.tsx` using recharts (already installed): `ComposedChart` with a `Scatter` per point class, a `Line` for the fit, and a custom tooltip. Colors come from the existing CSS variables (`--accent-raw`, `--ink`, muted), never hardcoded hex, and the chart is styled to match the app's bordered/hard-shadow look rather than recharts defaults.
- `src/routes/calculator.tsx`: renders `<CurveChart>` with `anchors`, `dropped`, `fit`, and the requested area; no pricing logic changes.
