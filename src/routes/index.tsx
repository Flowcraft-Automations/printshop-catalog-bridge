import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PageTitle } from "@/components/AppShell";
import { productsQuery } from "@/lib/queries";
import { STATUS_LABEL } from "@/lib/mdvd";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "לוח בקרה — קונסולת הגירת קטלוג MDVD" },
      { name: "description", content: "תמונת מצב של הקטלוג: פערים, חריגות והתקדמות ההגירה." },
      { property: "og:title", content: "לוח בקרה — קונסולת הגירת קטלוג MDVD" },
      { property: "og:description", content: "תמונת מצב של הקטלוג: פערים, חריגות והתקדמות ההגירה." },
    ],
  }),
  component: Dashboard,
});

function Kpi({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="border-2 border-[var(--ink)] bg-card px-4 py-3 shadow-[4px_4px_0_0_var(--ink)]">
      <div className={`num text-3xl font-black ${tone ?? "text-foreground"}`}>
        {value.toLocaleString("he-IL")}
      </div>
      <div className="mt-1 text-xs font-semibold text-muted-foreground">{label}</div>
    </div>
  );
}

function Progress({
  title,
  counts,
}: {
  title: string;
  counts: { to_review: number; to_add: number; in_progress: number; done: number };
}) {
  const total = counts.to_review + counts.to_add + counts.in_progress + counts.done;
  const pct = total ? Math.round((counts.done / total) * 100) : 0;
  return (
    <div className="border-2 border-[var(--ink)] bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-bold">{title}</h3>
        <span className="num text-sm font-bold text-[var(--accent-raw)]">{pct}%</span>
      </div>
      <div className="mt-3 h-3 w-full border border-[var(--ink)] bg-[var(--surface-deep)]">
        <div className="h-full bg-[var(--accent-raw)]" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap gap-4 text-xs font-semibold">
        <span>{STATUS_LABEL['to_review']}: <b className="num">{counts.to_review}</b></span>
        <span>{STATUS_LABEL['to_add']}: <b className="num">{counts.to_add}</b></span>
        <span>{STATUS_LABEL['in_progress']}: <b className="num">{counts.in_progress}</b></span>
        <span>{STATUS_LABEL['done']}: <b className="num">{counts.done}</b></span>
      </div>
    </div>
  );
}


function Dashboard() {
  const { data: products = [], isLoading } = useQuery(productsQuery());

  if (isLoading) return <p className="text-muted-foreground">טוען נתונים…</p>;

  const both = products.filter((p) => p.site_exists && p.senzey_exists).length;
  const onlySite = products.filter((p) => p.site_exists && !p.senzey_exists).length;
  const onlySenzey = products.filter((p) => !p.site_exists && p.senzey_exists).length;
  const anomalies = products.filter((p) => p.anomaly && p.anomaly.trim()).length;
  const gaps = products.filter((p) => (p.notes ?? "").includes("פער מחיר")).length;

  const count = (key: "site_status" | "senzey_status", v: string) =>
    products.filter((p) => p[key] === v).length;

  const byFamily = new Map<
    string,
    { items: number; site: number; senzey: number; pending: number }
  >();
  for (const p of products) {
    const f = p.family || "ללא משפחה";
    const e = byFamily.get(f) ?? { items: 0, site: 0, senzey: 0, pending: 0 };
    e.items++;
    if (p.site_exists) e.site++;
    if (p.senzey_exists) e.senzey++;
    if (["to_review", "to_add", "in_progress"].includes(p.site_status)) e.pending++;
    if (["to_review", "to_add", "in_progress"].includes(p.senzey_status)) e.pending++;
    byFamily.set(f, e);
  }
  const families = [...byFamily.entries()].sort((a, b) => b[1].items - a[1].items);

  return (
    <div>
      <PageTitle title="לוח בקרה" sub="תמונת מצב מלאה של הקטלוג בשתי המערכות" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Kpi label='סה"כ פריטים' value={products.length} />
        <Kpi label="קיים בשתי המערכות" value={both} />
        <Kpi label="רק באתר" value={onlySite} />
        <Kpi label="רק בסנזיי" value={onlySenzey} />
        <Kpi label="חריגות מחיר" value={anomalies} tone="text-destructive" />
        <Kpi label="פערי מחיר" value={gaps} tone="text-[oklch(0.55_0.16_50)]" />
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <Progress
          title="התקדמות הזנה לאתר"
          counts={{
            to_review: count("site_status", "to_review"),
            to_add: count("site_status", "to_add"),
            in_progress: count("site_status", "in_progress"),
            done: count("site_status", "done"),
          }}
        />
        <Progress
          title="התקדמות הזנה לסנזיי"
          counts={{
            to_review: count("senzey_status", "to_review"),
            to_add: count("senzey_status", "to_add"),
            in_progress: count("senzey_status", "in_progress"),
            done: count("senzey_status", "done"),
          }}
        />

      </div>

      <h2 className="mt-8 mb-3 text-lg font-black">פילוח לפי משפחות</h2>
      <div className="overflow-x-auto border-2 border-[var(--ink)] bg-card">
        <table className="w-full text-sm">
          <thead className="bg-[var(--ink)] text-white">
            <tr className="text-right">
              <th className="px-3 py-2 font-semibold">משפחה</th>
              <th className="px-3 py-2 font-semibold">פריטים</th>
              <th className="px-3 py-2 font-semibold">באתר</th>
              <th className="px-3 py-2 font-semibold">בסנזיי</th>
              <th className="px-3 py-2 font-semibold">ממתין להגירה</th>
            </tr>
          </thead>
          <tbody>
            {families.map(([f, v], i) => (
              <tr
                key={f}
                className={`border-t border-border ${i % 2 ? "bg-[var(--surface-deep)]" : ""}`}
              >
                <td className="px-3 py-1.5">
                  <Link
                    to="/catalog"
                    search={{ family: f }}
                    className="font-semibold text-[var(--accent-raw)] hover:underline"
                  >
                    {f}
                  </Link>
                </td>
                <td className="num px-3 py-1.5">{v.items}</td>
                <td className="num px-3 py-1.5">{v.site}</td>
                <td className="num px-3 py-1.5">{v.senzey}</td>
                <td className="num px-3 py-1.5 font-bold">{v.pending || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
