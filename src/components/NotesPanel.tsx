import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { productNotesQuery } from "@/lib/queries";
import type { ProductNote } from "@/lib/mdvd";

function fmt(ts: string) {
  return new Date(ts).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotesPanel({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const { data: allNotes = [], isLoading } = useQuery(productNotesQuery());
  const notes = allNotes.filter((n) => n.product_id === productId);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["product-notes"] });

  const add = useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase
        .from("product_notes")
        .insert({ product_id: productId, body } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      invalidate();
      toast.success("ההערה נוספה");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const edit = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase
        .from("product_notes")
        .update({ body } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(null);
      invalidate();
      toast.success("ההערה עודכנה");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("ההערה נמחקה");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="mt-6 border-t-2 border-[var(--ink)] pt-4">
      <h3 className="mb-3 text-sm font-black">
        הערות{notes.length > 0 && <span className="num ms-1 text-muted-foreground">({notes.length})</span>}
      </h3>

      <div className="mb-4">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="כתוב הערה חדשה…"
          rows={3}
          className="w-full border-2 border-[var(--ink)] bg-transparent p-2 text-sm outline-none focus:border-[var(--accent-raw)]"
        />
        <button
          disabled={!draft.trim() || add.isPending}
          onClick={() => add.mutate(draft.trim())}
          className="mt-2 border-2 border-[var(--ink)] bg-[var(--ink)] px-3 py-1 text-sm font-bold text-white disabled:opacity-40"
        >
          הוסף הערה
        </button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">טוען…</p>}
      {!isLoading && notes.length === 0 && (
        <p className="text-xs text-muted-foreground">אין הערות עדיין</p>
      )}

      <ul className="space-y-2">
        {notes.map((n: ProductNote) => (
          <li
            key={n.id}
            className="border-s-4 border-[oklch(0.55_0.14_75)] bg-[var(--surface-deep)] px-3 py-2"
          >
            <div className="mb-1 flex items-center gap-2">
              <span className="num text-[11px] text-muted-foreground">{fmt(n.created_at)}</span>
              <div className="ms-auto flex gap-2">
                <button
                  onClick={() => setEditing({ id: n.id, body: n.body })}
                  className="text-[11px] font-bold underline"
                >
                  עריכה
                </button>
                <button
                  onClick={() => remove.mutate(n.id)}
                  className="text-destructive"
                  title="מחק"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            {editing?.id === n.id ? (
              <>
                <textarea
                  value={editing.body}
                  onChange={(e) => setEditing({ id: n.id, body: e.target.value })}
                  rows={3}
                  className="w-full border-2 border-[var(--ink)] bg-card p-2 text-sm outline-none"
                />
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={() => edit.mutate({ id: n.id, body: editing.body.trim() })}
                    className="border border-[var(--ink)] px-2 py-0.5 text-xs font-bold"
                  >
                    שמור
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="text-xs text-muted-foreground underline"
                  >
                    ביטול
                  </button>
                </div>
              </>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-snug">{n.body}</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
