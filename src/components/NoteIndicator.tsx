import { StickyNote, Plus } from "lucide-react";

export function NoteIndicator({
  note,
  onClick,
  showEmpty = true,
}: {
  note: string | null | undefined;
  onClick?: () => void;
  showEmpty?: boolean;
}) {
  const text = (note ?? "").trim();
  if (!text) {
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
        className="inline-flex h-5 w-5 items-center justify-center text-[oklch(0.55_0.14_75)] hover:text-[var(--accent-raw)]"
      >
        <StickyNote size={14} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full end-0 z-50 mb-1 hidden w-64 whitespace-pre-wrap border-2 border-[var(--ink)] bg-[var(--ink)] px-2 py-1.5 text-right text-xs font-normal leading-snug text-white shadow-[3px_3px_0_rgba(0,0,0,0.25)] group-hover/note:block"
      >
        {text.length > 300 ? `${text.slice(0, 300)}…` : text}
      </span>
    </span>
  );
}
