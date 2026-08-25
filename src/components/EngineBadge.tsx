import { ENGINE_LABEL, type EngineKind } from "@/lib/mdvd";

/**
 * תג מנוע התמחור של משפחה. תצורה ישנה (לפני v3.1) או מנוע חסר —
 * שבב ענבר "ללא מנוע" במקום התג הרגיל.
 */
export function EngineBadge({
  engine,
  legacy,
  size = "sm",
}: {
  engine?: EngineKind;
  legacy?: boolean;
  size?: "sm" | "xs";
}) {
  const pad = size === "xs" ? "px-1 text-[9px]" : "px-1.5 text-[10px]";
  if (legacy || !engine) {
    return (
      <span
        className={`inline-block border border-[oklch(0.6_0.16_70)] bg-[oklch(0.96_0.05_85_/_0.55)] py-0.5 font-black text-[oklch(0.45_0.1_70)] ${pad}`}
        title="מנוע תמחור: לא הוגדר — נדרשת מיגרציית תצורה"
      >
        ללא מנוע — תצורה ישנה
      </span>
    );
  }
  return (
    <span
      className={`inline-block border border-[var(--ink)] py-0.5 font-black text-[var(--ink)] ${pad}`}
      title={`מנוע תמחור: ${ENGINE_LABEL[engine]}`}
    >
      {ENGINE_LABEL[engine]}
    </span>
  );
}
