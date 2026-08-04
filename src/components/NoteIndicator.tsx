import { StickyNote, Plus } from "lucide-react";

export function NoteIndicator({
  notes,
  onClick,
  showEmpty = true,
}: {
  /** Note bodies for this product, newest first. */
  notes: string[];
  onClick?: () => void;
  showEmpty?: boolean;
}) {
  const list = notes.map((n) => (n ?? "").trim()).filter(Boolean);
  if (list.length === 0) {
    if (!showEmpty) return null;
    return (
      <button
        type="button"
        title="הוסף הערה"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground/30 transition-colors hover:text-[var(--accent-raw)]"
      >
        <Plus size={13} />
      </button>
    );
  }
  return (
    <span className="group/note relative inline-flex align-middle">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className="relative inline-flex h-5 w-5 items-center justify-center text-[oklch(0.55_0.14_75)] hover:text-[var(--accent-raw)]"
      >
        <StickyNote size={14} />
        {list.length > 1 && (
          <span className="num absolute -top-1 -end-1 bg-[var(--ink)] px-[3px] text-[9px] font-bold leading-[12px] text-white">
            {list.length}
          </span>
        )}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full end-0 z-50 mb-1 hidden w-72 space-y-1 border-2 border-[var(--ink)] bg-[var(--ink)] px-2 py-1.5 text-right text-xs font-normal leading-snug text-white shadow-[3px_3px_0_rgba(0,0,0,0.25)] group-hover/note:block"
      >
        {list.slice(0, 3).map((t, i) => (
          <span key={i} className="block whitespace-pre-wrap border-b border-white/15 pb-1 last:border-0">
            {t.length > 220 ? `${t.slice(0, 220)}…` : t}
          </span>
        ))}
        {list.length > 3 && <span className="block text-white/60">+{list.length - 3} הערות נוספות</span>}
      </span>
    </span>
  );
}
