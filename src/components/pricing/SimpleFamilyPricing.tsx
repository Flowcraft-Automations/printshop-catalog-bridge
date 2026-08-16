import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Settings2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { shekel } from "@/lib/mdvd";
import { priceJob, type PricingConfig, type Tier } from "@/lib/pricing";
import { DEFAULT_CONFIG, TierEditor } from "@/components/TierEditor";

/* ------------------------------------------------------------------ *
 * One simple card per family: a size threshold, the customer price on
 * each side of it, and the production cost on each side of it.
 * Writes the very same pricing_config the engine reads.
 * ------------------------------------------------------------------ */

const field =
  "w-full border-b-2 border-[var(--ink)] bg-transparent px-2 py-1 text-sm outline-none focus:border-[var(--accent-raw)]";
const lbl = "block text-[11px] font-bold text-muted-foreground";

const num = (v: string): number | undefined => {
  if (v.trim() === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
};

/**
 * Simple = at most two size bands, first one optionally capped by a single
 * threshold (both sides), last one the catch-all, no running-metre and no
 * reference tiers.
 */
export function isSimpleConfig(cfg: PricingConfig): boolean {
  const tiers = cfg.tiers ?? [];
  if (tiers.length === 0 || tiers.length > 2) return false;
  for (const t of tiers) {
    if (t.method === "per_running_meter" || t.method === "reference") return false;
  }
  const last = tiers[tiers.length - 1]!;
  const lm = last.match ?? {};
  if (lm.max_w != null || lm.max_h != null) return false;
  if (tiers.length === 2) {
    const first = tiers[0]!;
    const fm = first.match ?? {};
    if (fm.max_w == null) return false;
    if (last.method !== "area_linear") return false;
  }
  return true;
}

function areaTier(name: string): Tier {
  return {
    name,
    match: {},
    method: "area_linear",
    params: { base: 0, rate_m2: 0, min: 0 },
    cost: { cost_per_m2: 0 },
  };
}

/** Best-effort collapse of any config into the one-threshold simple shape. */
function simplify(cfg: PricingConfig): PricingConfig {
  const tiers = cfg.tiers ?? [];
  const usable = tiers.filter(
    (t) => t.method === "area_linear" || t.method === "per_sheet",
  );
  const src = usable.length ? usable : [areaTier("כל המידות")];
  const withCap = src.find((t) => t.match?.max_w != null || t.match?.max_h != null);
  const catchAll = [...src].reverse().find((t) => !t.match?.max_w && !t.match?.max_h);

  if (!withCap || !catchAll || withCap === catchAll) {
    const only = { ...(catchAll ?? src[0]!), name: "כל המידות", match: {} };
    return { ...cfg, tiers: [only] };
  }
  const w = withCap.match?.max_w ?? withCap.match?.max_h ?? 0;
  const h = withCap.match?.max_h ?? withCap.match?.max_w ?? 0;
  const big = Math.max(w, h);
  const small = Math.min(w, h);
  return {
    ...cfg,
    tiers: [
      { ...withCap, name: `עד ${big}×${small} ס״מ`, match: { max_w: big, max_h: small } },
      { ...catchAll, name: "מעל הסף", method: "area_linear", match: {} },
    ],
  };
}

export function SimpleFamilyPricing({
  family,
  config,
  configs,
  familyNames,
}: {
  family: string;
  config: PricingConfig | null | undefined;
  configs: Record<string, PricingConfig | null | undefined>;
  familyNames: string[];
}) {
  const qc = useQueryClient();
  const base = config ?? DEFAULT_CONFIG;
  const [draft, setDraft] = useState<PricingConfig>(
    isSimpleConfig(base) ? base : simplify(base),
  );
  const [advanced, setAdvanced] = useState(false);
  const [collapsed, setCollapsed] = useState(!isSimpleConfig(base));
  const [tw, setTw] = useState("");
  const [th, setTh] = useState("");
  const [tq, setTq] = useState("1");

  useEffect(() => {
    const next = config ?? DEFAULT_CONFIG;
    const simple = isSimpleConfig(next);
    setDraft(simple ? next : simplify(next));
    setCollapsed(!simple);
    setAdvanced(false);
  }, [family, config]);


  const representable = isSimpleConfig(draft);

  const liveConfigs = useMemo(
    () => ({ ...configs, [family]: draft }),
    [configs, family, draft],
  );

  const test = useMemo(
    () =>
      priceJob({
        family,
        w: Number(tw) || 0,
        h: Number(th) || 0,
        qty: Number(tq) || 0,
        configs: liveConfigs,
      }),
    [family, tw, th, tq, liveConfigs],
  );

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("families")
        .update({ pricing_config: draft as unknown as never })
        .eq("family", family);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["families"] });
      toast.success("התמחור נשמר");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  /* ---------------- derived simple view ---------------- */

  const tiers = draft.tiers ?? [];
  const lower = tiers[0] ?? areaTier("עד הסף");
  const upper = tiers.length > 1 ? tiers[1]! : null;
  const sheetMode = lower.method === "per_sheet";
  const lp = (lower.params ?? {}) as Record<string, unknown>;
  const up = (upper?.params ?? {}) as Record<string, unknown>;
  const thW = lower.match?.max_w;
  const thH = lower.match?.max_h;

  const patchTier = (idx: number, p: Partial<Tier>) =>
    setDraft((d) => ({
      ...d,
      tiers: d.tiers.map((t, i) => (i === idx ? { ...t, ...p } : t)),
    }));

  const setThreshold = (w: number | undefined, h: number | undefined) =>
    setDraft((d) => {
      const t0 = d.tiers[0] ?? areaTier("עד הסף");
      if (w == null && h == null) {
        return { ...d, tiers: [{ ...t0, name: "כל המידות", match: {} }] };
      }
      const big = Math.max(w ?? h ?? 0, h ?? w ?? 0);
      const small = Math.min(w ?? h ?? 0, h ?? w ?? 0);
      const first: Tier = {
        ...t0,
        name: `עד ${big}×${small} ס״מ`,
        match: { max_w: big, max_h: small },
      };
      const second: Tier = d.tiers[1]
        ? { ...d.tiers[1], name: "מעל הסף", match: {} }
        : { ...areaTier("מעל הסף"), params: { base: 0, rate_m2: 0, min: 0 } };
      return { ...d, tiers: [first, second] };
    });

  const setMode = (mode: "area" | "sheet") =>
    patchTier(0, {
      method: mode === "area" ? "area_linear" : "per_sheet",
      params:
        mode === "area"
          ? { base: 0, rate_m2: 0, min: 0 }
          : { sheet_w: 45, sheet_h: 32, gap_cm: 0.5, sheet_rate: 8, sheet_cost: 4, min: 0 },
    });

  const qtyTiers = draft.qty_model?.type === "tiers" ? (draft.qty_model.tiers ?? []) : [];
  const setQtyTiers = (rows: { min_qty: number; mult: number }[]) =>
    setDraft((d) => ({ ...d, qty_model: { type: "tiers", tiers: rows } }));

  if (advanced) {
    return (
      <div className="space-y-2">
        <button
          onClick={() => setAdvanced(false)}
          className="flex items-center gap-1 border-2 border-[var(--ink)] px-3 py-1.5 text-xs font-bold shadow-[3px_3px_0_0_var(--ink)]"
        >
          <Settings2 className="size-3" /> חזור למצב פשוט
        </button>

        <TierEditor
          family={family}
          config={config}
          configs={configs}
          familyNames={familyNames}
        />
      </div>
    );
  }

  return (
    <section className="border-2 border-[var(--ink)] bg-card p-4 shadow-[4px_4px_0_0_var(--ink)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black">תמחור «{family}»</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAdvanced(true)}
            className="flex items-center gap-1 border-2 border-[var(--ink)] px-3 py-1.5 text-[11px] font-bold"
          >
            <Settings2 className="size-3" /> הגדרות מתקדמות
          </button>
          <button
            onClick={() => save.mutate()}
            className="bg-[var(--accent-raw)] px-4 py-2 text-xs font-bold text-white shadow-[3px_3px_0_0_var(--ink)]"
          >
            שמור
          </button>
        </div>
      </div>

      {collapsed ? (
        <p className="mb-4 border-2 border-dashed border-[var(--ink)] p-2 text-[11px] font-bold">
          למשפחה הזו היו כללים ישנים ומורכבים. הם קופלו כאן לתצורה אחת — בדקו את המספרים
          ולחצו «שמור» כדי לקבע אותם (או פתחו «הגדרות מתקדמות» לכללים המקוריים).
        </p>
      ) : null}


      {/* ---- size threshold ---- */}
      <div className="mb-5 border-2 border-dashed border-[var(--ink)] p-3">
        <div className="mb-2 text-xs font-black">סף גודל</div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[11px] font-bold text-muted-foreground">
            רוחב (ס״מ)
            <input
              className={`${field} num w-24`}
              value={thW ?? ""}
              onChange={(e) => setThreshold(num(e.target.value), thH)}
            />
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">
            גובה (ס״מ)
            <input
              className={`${field} num w-24`}
              value={thH ?? ""}
              onChange={(e) => setThreshold(thW, num(e.target.value))}
            />
          </label>
          {upper ? (
            <button
              onClick={() => setThreshold(undefined, undefined)}
              className="border-2 border-[var(--ink)] px-3 py-1 text-[11px] font-bold"
            >
              בטל סף
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {upper
            ? "מעל המידה הזו ההדפסה יוצאת למיקור חוץ ומחושבת לפי המחיר והעלות של «מעל הסף»."
            : "בלי סף — אותו מחיר ואותה עלות לכל המידות. מלאו רוחב וגובה כדי לפצל."}
        </p>
      </div>

      {/* ---- below the threshold ---- */}
      <div className="border-2 border-[var(--ink)] p-3">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="text-xs font-black">
            {upper ? `עד ${thW}×${thH} ס״מ` : "כל המידות"}
          </div>
          <div className="flex gap-2">
            {(
              [
                { v: "area", t: "לפי גודל" },
                { v: "sheet", t: "לפי גיליון" },
              ] as const
            ).map((m) => (
              <button
                key={m.v}
                onClick={() => setMode(m.v)}
                className={`border-2 border-[var(--ink)] px-3 py-1 text-[11px] font-black ${
                  (m.v === "sheet") === sheetMode
                    ? "bg-[var(--accent-raw)] text-white shadow-[3px_3px_0_0_var(--ink)]"
                    : ""
                }`}
              >
                {m.t}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {sheetMode ? (
            <>
              <div>
                <label className={lbl}>מחיר גיליון ללקוח ₪</label>
                <input
                  className={`${field} num`}
                  value={String(lp['sheet_rate'] ?? "")}
                  onChange={(e) =>
                    patchTier(0, { params: { ...lp, sheet_rate: num(e.target.value) } })
                  }
                />
              </div>
              <div>
                <label className={lbl}>עלות גיליון ₪</label>
                <input
                  className={`${field} num`}
                  value={String(lp['sheet_cost'] ?? "")}
                  onChange={(e) =>
                    patchTier(0, { params: { ...lp, sheet_cost: num(e.target.value) } })
                  }
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={lbl}>מחיר למ״ר ללקוח ₪</label>
                <input
                  className={`${field} num`}
                  value={String(lp['rate_m2'] ?? "")}
                  onChange={(e) =>
                    patchTier(0, { params: { ...lp, rate_m2: num(e.target.value) } })
                  }
                />
              </div>
              <div>
                <label className={lbl}>עלות ייצור למ״ר ₪</label>
                <input
                  className={`${field} num`}
                  value={String(lower.cost?.cost_per_m2 ?? "")}
                  onChange={(e) =>
                    patchTier(0, {
                      cost: { ...(lower.cost ?? {}), cost_per_m2: num(e.target.value) ?? 0 },
                    })
                  }
                />
              </div>
            </>
          )}
          <div>
            <label className={lbl}>מחיר מינימום ₪</label>
            <input
              className={`${field} num`}
              value={String(lp['min'] ?? "")}
              onChange={(e) => patchTier(0, { params: { ...lp, min: num(e.target.value) } })}
            />
          </div>
        </div>
      </div>

      {/* ---- above the threshold ---- */}
      {upper ? (
        <div className="mt-3 border-2 border-[var(--ink)] p-3">
          <div className="mb-3 text-xs font-black">מעל {thW}×{thH} ס״מ</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className={lbl}>מחיר למ״ר ללקוח ₪</label>
              <input
                className={`${field} num`}
                value={String(up['rate_m2'] ?? "")}
                onChange={(e) =>
                  patchTier(1, { params: { ...up, rate_m2: num(e.target.value) } })
                }
              />
            </div>
            <div>
              <label className={lbl}>עלות ייצור למ״ר ₪</label>
              <input
                className={`${field} num`}
                value={String(upper.cost?.cost_per_m2 ?? "")}
                onChange={(e) =>
                  patchTier(1, {
                    cost: { ...(upper.cost ?? {}), cost_per_m2: num(e.target.value) ?? 0 },
                  })
                }
              />
            </div>
            <div>
              <label className={lbl}>מחיר מינימום ₪</label>
              <input
                className={`${field} num`}
                value={String(up['min'] ?? "")}
                onChange={(e) => patchTier(1, { params: { ...up, min: num(e.target.value) } })}
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* ---- overhead, rounding, quantity ---- */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <label className={lbl}>מקדם תקורה</label>
          <input
            className={`${field} num max-w-32`}
            value={String(draft.cost?.overhead_mult ?? "")}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                cost: { ...(d.cost ?? {}), overhead_mult: num(e.target.value) ?? 1 },
              }))
            }
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            רצפת המחיר = עלות הייצור × המקדם.
          </p>
        </div>

        <div>
          <label className={lbl}>עיגול מחיר</label>
          <select
            className={`${field} max-w-48`}
            value={String(draft.rounding?.step ?? 1)}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                rounding: {
                  step: Number(e.target.value),
                  direction: d.rounding?.direction ?? "nearest",
                },
              }))
            }
          >
            <option value="1">ללא עיגול</option>
            <option value="5">לעגל ל־5 ₪</option>
            <option value="10">לעגל ל־10 ₪</option>
          </select>
        </div>

        <div>
          <div className="mb-2 text-xs font-black">הנחת כמות</div>
          <div className="space-y-2">
            {qtyTiers.map((row, i) => (
              <div key={i} className="flex items-end gap-2">
                <label className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                  מכמות
                  <input
                    className={`${field} num w-16`}
                    value={String(row.min_qty)}
                    onChange={(e) =>
                      setQtyTiers(
                        qtyTiers.map((x, idx) =>
                          idx === i ? { ...x, min_qty: num(e.target.value) ?? 0 } : x,
                        ),
                      )
                    }
                  />
                </label>
                <label className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                  הנחה %
                  <input
                    className={`${field} num w-16`}
                    value={String(Math.round((1 - row.mult) * 100))}
                    onChange={(e) =>
                      setQtyTiers(
                        qtyTiers.map((x, idx) =>
                          idx === i
                            ? { ...x, mult: 1 - (num(e.target.value) ?? 0) / 100 }
                            : x,
                        ),
                      )
                    }
                  />
                </label>
                <button
                  onClick={() => setQtyTiers(qtyTiers.filter((_, idx) => idx !== i))}
                  className="border-2 border-[var(--ink)] p-1 text-[oklch(0.5_0.2_25)]"
                  aria-label="מחק שורה"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setQtyTiers([...qtyTiers, { min_qty: 10, mult: 0.9 }])}
              className="border-2 border-[var(--ink)] px-3 py-1 text-[11px] font-bold"
            >
              הוסף שורת הנחה
            </button>
          </div>
        </div>
      </div>

      {/* ---- always-on mini calculator ---- */}
      <div className="mt-5 border-2 border-[var(--ink)] bg-[var(--surface-deep)] p-3">
        <div className="mb-2 text-xs font-black">בדיקה מהירה</div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[11px] font-bold text-muted-foreground">
            רוחב
            <input className={`${field} num w-20`} value={tw} onChange={(e) => setTw(e.target.value)} />
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">
            גובה
            <input className={`${field} num w-20`} value={th} onChange={(e) => setTh(e.target.value)} />
          </label>
          <label className="text-[11px] font-bold text-muted-foreground">
            כמות
            <input className={`${field} num w-20`} value={tq} onChange={(e) => setTq(e.target.value)} />
          </label>
          <div className="min-w-48">
            {test.ok ? (
              <>
                <div className="num text-2xl font-black text-[var(--accent-raw)]">
                  {shekel(test.price ?? 0)}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {test.breakdown.join(" · ")}
                </div>
              </>
            ) : (
              <div className="text-sm font-bold text-[oklch(0.5_0.2_25)]">{test.error}</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
