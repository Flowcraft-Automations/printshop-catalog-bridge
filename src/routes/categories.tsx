import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { PageTitle } from "@/components/AppShell";
import { productsQuery } from "@/lib/queries";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "מיפוי קטגוריות — קונסולת MDVD" },
      { name: "description", content: "מפת התאמה בין קבוצות סנזיי לקטגוריות האתר." },
      { property: "og:title", content: "מיפוי קטגוריות — קונסולת MDVD" },
      { property: "og:description", content: "מפת התאמה בין קבוצות סנזיי לקטגוריות האתר." },
    ],
  }),
  component: CategoryMap,
});

function CategoryMap() {
  const { data: products = [], isLoading } = useQuery(productsQuery());

  const rows = useMemo(() => {
    const map = new Map<string, { g: string; c: string; n: number }>();
    for (const p of products) {
      const g = (p.senzey_group ?? "").trim();
      const c = (p.site_category ?? "").trim();
      const k = `${g}||${c}`;
      const e = map.get(k) ?? { g, c, n: 0 };
      e.n++;
      map.set(k, e);
    }
    return [...map.values()].sort((a, b) => b.n - a.n);
  }, [products]);

  const gaps = rows.filter((r) => !r.g || !r.c).reduce((n, r) => n + r.n, 0);

  return (
    <div>
      <PageTitle
        title="מיפוי קטגוריות"
        sub={`${rows.length} צירופים · ${gaps.toLocaleString("he-IL")} פריטים עם צד חסר`}
      />
      {isLoading ? (
        <p className="text-muted-foreground">טוען…</p>
      ) : (
        <div className="overflow-x-auto border-2 border-[var(--ink)] bg-card">
          <table className="w-full text-sm">
            <thead className="bg-[var(--ink)] text-white">
              <tr className="text-right">
                <th className="px-3 py-2 font-semibold">קבוצה בסנזיי</th>
                <th className="px-3 py-2 font-semibold">קטגוריה באתר</th>
                <th className="px-3 py-2 font-semibold">פריטים</th>
                <th className="px-3 py-2 font-semibold">מצב</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={`${r.g}||${r.c}`}
                  className={`border-t border-border ${i % 2 ? "bg-[var(--surface-deep)]" : ""}`}
                >
                  <td className="px-3 py-1.5">
                    <Link
                      to="/catalog"
                      search={{
                        senzey_group: r.g || "__empty__",
                        site_category: r.c || "__empty__",
                      }}
                      className="font-semibold text-[var(--accent-raw)] hover:underline"
                    >
                      {r.g || "— ללא קבוצה —"}
                    </Link>
                  </td>
                  <td className="px-3 py-1.5">{r.c || "— ללא קטגוריה —"}</td>
                  <td className="num px-3 py-1.5 font-bold">{r.n}</td>
                  <td className="px-3 py-1.5">
                    {r.g && r.c ? (
                      <span className="text-xs font-bold text-[oklch(0.45_0.1_155)]">מותאם</span>
                    ) : (
                      <span className="border border-destructive bg-[oklch(0.95_0.05_25)] px-1.5 py-0.5 text-[11px] font-bold text-destructive">
                        פער התאמה
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
