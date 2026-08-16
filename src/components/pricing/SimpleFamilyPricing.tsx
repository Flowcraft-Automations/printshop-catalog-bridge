import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { shekel } from "@/lib/mdvd";
import { priceJob, type PricingConfig, type PricingMethod, type Tier } from "@/lib/pricing";
import { DEFAULT_CONFIG, TierEditor } from "@/components/TierEditor";

/* ------------------------------------------------------------------ *
 * Simple mode writes the very same pricing_config the engine reads.
 * It only hides the parameters a non-technical user never touches.
 * ------------------------------------------------------------------ */

const SIMPLE_METHODS: {
  value: PricingMethod;
  title: string;
  hint: string;
}[] = [
  { value: "area_linear", title: "לפי גודל", hint: "כל מטר רבוע עולה סכום קבוע" },
  { value: "per_sheet", title: "לפי גיליון", hint: "מוצרים קטנים — כמה יוצאים מגיליון" },
  { value: "reference", title: "כמו משפחה אחרת", hint: "השתמש בתמחור של משפחה קיימת" },
];

const field =
  "w-full border-b-2 border-[var(--ink)] bg-transparent px-2 py-1 text-sm outline-none focus:border-[var(--accent-raw)]";
const lbl = "block text-[11px] font-bold text-muted-foreground";

const num = (v: string): number | undefined => {
  if (v.trim() === "") return undefined;
  const x = Number(v);
  return Number.isFinite(x) ? x : undefined;
};

/** A config is "simple" when every band is a plain size range (both sides). */
export function isSimpleConfig(cfg: PricingConfig): boolean {
  return cfg.tiers.every((t) => {
    const m = t.match ?? {};
    if (m.max_h != null && m.max_w != null && m.max_h !== m.max_w) return false;
    if (m.max_h != null && m.max_w == null) return false;
    if (m.min_h != null && m.min_h !== m.min_w) return false;
    return t.method !== "per_running_meter";
  });
}


function methodOf(t: Tier) {
  return SIMPLE_METHODS.find((m) => m.value === t.method) ?? SIMPLE_METHODS[0]!;
}

function newTier(): Tier {
  return {
    name: "טווח חדש",
    match: {},
    method: "area_linear",
    params: { base: 0, rate_m2: 0, min: 0 },
    cost: { cost_per_m2: 0 },
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
  const [draft, setDraft] = useState<PricingConfig>(base);
  const [advanced, setAdvanced] = useState(!isSimpleConfig(base));
  const [tw, setTw] = useState("");
  const [th, setTh] = useState("");
  const [tq, setTq] = useState("1");

  useEffect(() => {
    const next = config ?? DEFAULT_CONFIG;
    setDraft(next);
    setAdvanced(!isSimpleConfig(next));
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

  const patch = (i: number, p: Partial<Tier>) =>
    setDraft((d) => ({ ...d, tiers: d.tiers.map((t, idx) => (idx === i ? { ...t, ...p } : t)) }));

  const params = (t: Tier) => (t.params ?? {}) as Record<string, unknown>;

  /** One cut-off number drives max of this band and min of the next. */
  const setCutoff = (i: number, value: number | undefined) =>
    setDraft((d) => ({
      ...d,
      tiers: d.tiers.map((t, idx) => {
        if (idx !== i && idx !== i + 1) return t;
        const m: Record<string, number> = {};
        for (const [k, v] of Object.entries(t.match ?? {})) if (v != null) m[k] = v as number;
        const keys = idx === i ? ["max_w", "max_h"] : ["min_w", "min_h"];
        for (const key of keys) {
          // keep the paired short-side rule in sync only when it already exists
          if (!(key in m) && key.endsWith("_h")) continue;
          if (value == null) delete m[key];
          else m[key] = value;
        }
        return { ...t, match: m };

      }),
    }));


  const qtyTiers =
    draft.qty_model?.type === "tiers" ? (draft.qty_model.tiers ?? []) : [];

  const setQtyTiers = (rows: { min_qty: number; mult: number }[]) =>
    setDraft((d) => ({ ...d, qty_model: { type: "tiers", tiers: rows } }));

  if (advanced) {
    return (
      <div className="space-y-2">
        <button
          onClick={() => setAdvanced(false)}
          disabled={!representable}
          className="flex items-center gap-1 border-2 border-[var(--ink)] px-3 py-1.5 text-xs font-bold shadow-[3px_3px_0_0_var(--ink)] disabled:opacity-40"
        >
          <Settings2 className="size-3" /> חזור למצב פשוט
        </button>
        {!representable ? (
          <p className="text-[11px] font-bold text-muted-foreground">
            התמחור של משפחה זו משתמש בכללים מיוחדים, לכן הוא מוצג במצב המתקדם בלבד.
          </p>
        ) : null}
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

      {/* ---- size bands ---- */}
      <div className="space-y-3">
        {draft.tiers.map((tier, i) => {
          const p = params(tier);
          const last = i === draft.tiers.length - 1;
          const from = tier.match?.min_w;
          const to = tier.match?.max_w;
          return (
            <div key={i} className="border-2 border-dashed border-[var(--ink)] p-3">
              <div className="mb-3 flex flex-wrap items-center gap-2 text-sm font-bold">
                <span>
                  {from != null && to != null
                    ? `מידה ${from}–${to} ס״מ`
                    : to != null
                      ? `מידה עד ${to} ס״מ`
                      : from != null
                        ? `מידה מ־${from} ס״מ ומעלה`
                        : "כל המידות"}
                </span>
                {!last ? (
                  <label className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                    עד (ס״מ)
                    <input
                      className={`${field} num w-20`}
                      value={to ?? ""}
                      onChange={(e) => setCutoff(i, num(e.target.value))}
                    />
                  </label>
                ) : null}
                {draft.tiers.length > 1 ? (
                  <button
                    onClick={() =>
                      setDraft((d) => ({ ...d, tiers: d.tiers.filter((_, x) => x !== i) }))
                    }
                    className="ms-auto border-2 border-[var(--ink)] p-1 text-[oklch(0.5_0.2_25)]"
                    aria-label="מחק טווח"
                  >
                    <Trash2 className="size-3" />
                  </button>
                ) : null}
              </div>

              {/* method chooser */}
              <div className="mb-3 grid gap-2 sm:grid-cols-3">
                {SIMPLE_METHODS.map((m) => {
                  const on = tier.method === m.value;
                  return (
                    <button
                      key={m.value}
                      onClick={() =>
                        patch(i, {
                          method: m.value,
                          params:
                            m.value === tier.method
                              ? (tier.params ?? {})
                              : m.value === "area_linear"
                                ? { base: 0, rate_m2: 0, min: 0 }
                                : m.value === "per_sheet"
                                  ? {
                                      sheet_w: 45,
                                      sheet_h: 32,
                                      gap_cm: 0.5,
                                      sheet_rate: 8,
                                      sheet_cost: 4,
                                      min: 0,
                                    }
                                  : { family: "" },
                        })
                      }
                      className={`border-2 border-[var(--ink)] p-2 text-right ${
                        on
                          ? "bg-[var(--accent-raw)] text-white shadow-[3px_3px_0_0_var(--ink)]"
                          : "bg-transparent"
                      }`}
                    >
                      <div className="text-xs font-black">{m.title}</div>
                      <div
                        className={`text-[11px] ${on ? "opacity-90" : "text-muted-foreground"}`}
                      >
                        {m.hint}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* the two or three numbers that matter */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {tier.method === "area_linear" ? (
                  <>
                    <div>
                      <label className={lbl}>מחיר למטר רבוע ₪</label>
                      <input
                        className={`${field} num`}
                        value={String(p['rate_m2'] ?? "")}
                        onChange={(e) =>
                          patch(i, { params: { ...p, rate_m2: num(e.target.value) } })
                        }
                      />
                    </div>
                    <div>
                      <label className={lbl}>מחיר מינימום ₪</label>
                      <input
                        className={`${field} num`}
                        value={String(p['min'] ?? "")}
                        onChange={(e) => patch(i, { params: { ...p, min: num(e.target.value) } })}
                      />
                    </div>
                    <div>
                      <label className={lbl}>עלות חומר למ״ר ₪</label>
                      <input
                        className={`${field} num`}
                        value={String(tier.cost?.cost_per_m2 ?? "")}
                        onChange={(e) =>
                          patch(i, {
                            cost: {
                              ...(tier.cost ?? {}),
                              cost_per_m2: num(e.target.value) ?? 0,
                            },
                          })
                        }
                      />
                    </div>
                  </>
                ) : null}

                {tier.method === "per_sheet" ? (
                  <>
                    <div>
                      <label className={lbl}>מחיר גיליון ללקוח ₪</label>
                      <input
                        className={`${field} num`}
                        value={String(p['sheet_rate'] ?? "")}
                        onChange={(e) =>
                          patch(i, { params: { ...p, sheet_rate: num(e.target.value) } })
                        }
                      />
                    </div>
                    <div>
                      <label className={lbl}>עלות גיליון ₪</label>
                      <input
                        className={`${field} num`}
                        value={String(p['sheet_cost'] ?? "")}
                        onChange={(e) =>
                          patch(i, { params: { ...p, sheet_cost: num(e.target.value) } })
                        }
                      />
                    </div>
                    <div>
                      <label className={lbl}>מחיר מינימום ₪</label>
                      <input
                        className={`${field} num`}
                        value={String(p['min'] ?? "")}
                        onChange={(e) => patch(i, { params: { ...p, min: num(e.target.value) } })}
                      />
                    </div>
                  </>
                ) : null}

                {tier.method === "reference" ? (
                  <>
                    <div>
                      <label className={lbl}>לפי המשפחה</label>
                      <select
                        className={field}
                        value={String(p['family'] ?? "")}
                        onChange={(e) => patch(i, { params: { ...p, family: e.target.value } })}
                      >
                        <option value="">בחר משפחה…</option>
                        {familyNames
                          .filter((f) => f !== family)
                          .map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className={lbl}>מחיר מינימום ₪</label>
                      <input
                        className={`${field} num`}
                        value={String(
                          ((p['overrides'] as Record<string, unknown>) ?? {})['min'] ?? "",
                        )}
                        onChange={(e) =>
                          patch(i, {
                            params: {
                              ...p,
                              overrides: {
                                ...((p['overrides'] as Record<string, unknown>) ?? {}),
                                min: num(e.target.value),
                              },
                            },
                          })
                        }
                      />
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          );
        })}

        <button
          onClick={() =>
            setDraft((d) => {
              const tiers = [...d.tiers];
              const prev = tiers[tiers.length - 1];
              const cut = prev?.match?.max_w;
              tiers.push({ ...newTier(), match: cut != null ? { min_w: cut } : {} });
              return { ...d, tiers };
            })
          }
          className="flex items-center gap-1 border-2 border-[var(--ink)] px-3 py-1.5 text-xs font-bold shadow-[3px_3px_0_0_var(--ink)]"
        >
          <Plus className="size-3" /> הוסף טווח גודל
        </button>
      </div>

      {/* ---- quantity discount + rounding ---- */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-2 text-xs font-black">הנחת כמות</div>
          <div className="space-y-2">
            {qtyTiers.map((row, i) => (
              <div key={i} className="flex items-end gap-2">
                <label className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                  מכמות
                  <input
                    className={`${field} num w-20`}
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
                  מחיר ליחידה
                  <input
                    className={`${field} num w-20`}
                    value={String(row.mult)}
                    onChange={(e) =>
                      setQtyTiers(
                        qtyTiers.map((x, idx) =>
                          idx === i ? { ...x, mult: num(e.target.value) ?? 1 } : x,
                        ),
                      )
                    }
                  />
                </label>
                <span className="pb-1 text-[11px] text-muted-foreground">
                  ({Math.round((1 - row.mult) * 100)}% הנחה)
                </span>
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

        <div>
          <div className="mb-2 text-xs font-black">עיגול מחיר</div>
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
