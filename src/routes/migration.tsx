import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/AppShell";
import { NoteIndicator } from "@/components/NoteIndicator";
import { NotesPanel } from "@/components/NotesPanel";
import { supabase } from "@/integrations/supabase/client";
import { productNotesQuery, productsQuery } from "@/lib/queries";
import { STATUS_LABEL, shekel, type Product } from "@/lib/mdvd";

export const Route = createFileRoute("/migration")({
  head: () => ({
    meta: [
      { title: "רשימת הגירה — קונסולת MDVD" },
      { name: "description", content: "מעקב יומיומי אחר הזנת מוצרים לאתר ולסנזיי." },
      { property: "og:title", content: "רשימת הגירה — קונסולת MDVD" },
      { property: "og:description", content: "מעקב אחר הזנת מוצרים לשתי המערכות." },
    ],
  }),
  component: MigrationBoard,
});

type TabKey = "site" | "senzey" | "site_done" | "senzey_done";

const TABS: { key: TabKey; label: string }[] = [
  { key: "site", label: "להזנה לאתר" },
  { key: "senzey", label: "להזנה לסנזיי" },
  { key: "site_done", label: "בוצע — אתר" },
  { key: "senzey_done", label: "בוצע — סנזיי" },
];

function MigrationBoard() {
  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery(productsQuery());
  const { data: allNotes = [] } = useQuery(productNotesQuery());
  const [tab, setTab] = useState<TabKey>("site");
  const [noteFor, setNoteFor] = useState<Product | null>(null);

  const system: "site" | "senzey" = tab.startsWith("site") ? "site" : "senzey";
  const field = system === "site" ? "site_status" : "senzey_status";
  const doneView = tab.endsWith("_done");

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("products")
        .update({ [field]: status, updated_at: new Date().toISOString() } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("הסטטוס עודכן");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const groups = useMemo(() => {
    const wanted = doneView ? ["done"] : ["to_review", "to_add", "in_progress"];
    const rows = products.filter((p) => wanted.includes(p[field]));
    const map = new Map<string, Product[]>();
    for (const p of rows) {
      const f = p.family || "ללא משפחה";
      map.set(f, [...(map.get(f) ?? []), p]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [products, field, doneView]);

  const total = groups.reduce((n, [, g]) => n + g.length, 0);

  return (
    <div>
      <PageTitle title="רשימת הגירה" sub="רשימת העבודה היומית — מה צריך להזין ולאן" />

      <div className="mb-5 flex flex-wrap gap-0 border-b-2 border-[var(--ink)]">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`-mb-0.5 border-2 border-b-0 px-5 py-2 text-sm font-bold ${
              tab === t.key
                ? "border-[var(--ink)] bg-[var(--accent-raw)] text-white"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">טוען…</p>
      ) : total === 0 ? (
        <p className="border-2 border-dashed border-border p-10 text-center text-muted-foreground">
          אין פריטים בתצוגה זו
        </p>
      ) : (
        <>
          <p className="mb-4 text-sm font-semibold text-muted-foreground">
            {total.toLocaleString("he-IL")} פריטים · {groups.length} משפחות
          </p>
          <div className="space-y-6">
            {groups.map(([fam, items]) => (
              <section key={fam} className="border-2 border-[var(--ink)] bg-card">
                <header className="flex items-baseline gap-3 border-b-2 border-[var(--ink)] bg-[var(--surface-deep)] px-4 py-2">
                  <h2 className="font-black">{fam}</h2>
                  <span className="num text-xs text-muted-foreground">{items.length} פריטים</span>
                </header>
                <table className="w-full text-sm">
                  <tbody>
                    {items.map((p, i) => (
                      <tr key={p.id} className={i % 2 ? "bg-[var(--surface-deep)]" : ""}>
                        <td className="px-4 py-2 font-semibold">
                          {p.name}
                          {p.source === "approved_new" && (
                            <span className="ms-2 border border-[oklch(0.5_0.12_155)] bg-[oklch(0.93_0.07_155)] px-1.5 py-0.5 text-[11px] font-bold text-[oklch(0.4_0.1_155)]">
                              חדש מאושר
                            </span>
                          )}
                          <span className="ms-2">
                            <NoteIndicator
                              notes={allNotes.filter((n) => n.product_id === p.id).map((n) => n.body)}
                              onClick={() => setNoteFor(p)}
                            />
                          </span>
                        </td>
                        <td className="num whitespace-nowrap px-3 py-2 text-muted-foreground">
                          {p.width_cm && p.height_cm ? `${p.width_cm}×${p.height_cm}` : "—"}
                        </td>
                        <td className="num px-3 py-2">×{p.qty ?? 1}</td>
                        <td className="num px-3 py-2">
                          {p.final_price == null ? (
                            <span className="font-bold text-destructive">חסר מחיר סופי</span>
                          ) : (
                            <span className="font-bold">{shekel(p.final_price)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs font-bold text-muted-foreground">
                          {STATUS_LABEL[p[field]]}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-left">
                          {!doneView && (
                            <>
                              <button
                                onClick={() => update.mutate({ id: p.id, status: "in_progress" })}
                                className="me-2 border border-[var(--ink)] px-2 py-1 text-xs font-bold hover:bg-[oklch(0.93_0.08_60)]"
                              >
                                התחל
                              </button>
                              <button
                                onClick={() => update.mutate({ id: p.id, status: "done" })}
                                className="me-2 border border-[var(--ink)] bg-[oklch(0.93_0.07_155)] px-2 py-1 text-xs font-bold"
                              >
                                בוצע
                              </button>
                              <button
                                onClick={() => update.mutate({ id: p.id, status: "not_relevant" })}
                                className="border border-border px-2 py-1 text-xs text-muted-foreground"
                              >
                                לא רלוונטי
                              </button>
                            </>
                          )}
                          {doneView && (
                            <button
                              onClick={() => update.mutate({ id: p.id, status: "to_add" })}
                              className="border border-border px-2 py-1 text-xs text-muted-foreground"
                            >
                              החזר לרשימה
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        </>
      )}

      {noteFor && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-6"
          onClick={() => setNoteFor(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg border-2 border-[var(--ink)] bg-card p-4 shadow-[6px_6px_0_var(--ink)]"
          >
            <div className="flex items-start gap-3">
              <h3 className="font-black">{noteFor.name}</h3>
              <button
                onClick={() => setNoteFor(null)}
                className="ms-auto text-sm text-muted-foreground underline"
              >
                סגור
              </button>
            </div>
            <NotesPanel productId={noteFor.id} />
          </div>
        </div>
      )}
    </div>
  );
}
