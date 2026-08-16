import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { shekel } from "@/lib/mdvd";
import {
  LADDER_QUANTITIES,
  priceJob,
  type PricingConfig,
  type PricingMethod,
  type Tier,
} from "@/lib/pricing";

const METHODS: { value: PricingMethod; label: string; fields: string[] }[] = [
  { value: "area_linear", label: "לפי שטח (בסיס + מ״ר)", fields: ["base", "rate_m2", "min"] },
  { value: "per_running_meter", label: "לפי מטר רץ", fields: ["rate", "min"] },
  {
    value: "per_sheet",
    label: "לפי גיליון",
    fields: ["sheet_w", "sheet_h", "gap_cm", "setup_fee", "sheet_rate", "sheet_cost", "min"],
  },
  { value: "reference", label: "הפניה למשפחה אחרת", fields: ["family"] },
];

const FIELD_LABELS: Record<string, string> = {
  base: "בסיס ₪",
  rate_m2: "₪ למ״ר",
  min: "מינימום ₪",
  rate: "₪ למטר",
  sheet_w: "רוחב גיליון ס״מ",
  sheet_h: "גובה גיליון ס״מ",
  gap_cm: "מרווח ס״מ",
  setup_fee: "עלות הקמה ₪",
  sheet_rate: "₪ לגיליון",
  sheet_cost: "עלות גיליון ₪",
  family: "משפחת מקור",
};

const MATCH_LABELS: Record<string, string> = {
  min_w: "צד ארוך מ־",
  max_w: "צד ארוך עד",
  min_h: "צד קצר מ־",
  max_h: "צד קצר עד",
};

const fieldCls =
  "w-full border-b-2 border-[var(--ink)] bg-transparent px-2 py-1 text-sm outline-none focus:border-[var(--accent-raw)]";

const emptyTier = (): Tier => ({
  name: "שכבה חדשה",
  match: {},
  method: "area_linear",
  params: { base: 0, rate_m2: 0, min: 0 },
  cost: { cost_per_m2: 0 },
});

export const DEFAULT_CONFIG: PricingConfig = {
  tiers: [emptyTier()],
  qty_model: { type: "tiers", tiers: [] },
  rounding: { step: 1, direction: "nearest" },
  cost: { overhead_mult: 1.3 },
};

function numOrUndef(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function TierEditor({
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
  const [draft, setDraft] = useState<PricingConfig>(config ?? DEFAULT_CONFIG);
  const [tw, setTw] = useState("");
  const [th, setTh] = useState("");
  const [tq, setTq] = useState("1");

  useEffect(() => {
    setDraft(config ?? DEFAULT_CONFIG);
  }, [family, config]);

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

  const ladderTier = useMemo(
    () => draft.tiers.find((t) => t.method === "per_sheet") ?? null,
    [draft],
  );
  const ladder = useMemo(() => {
    if (!ladderTier || !Number(tw) || !Number(th)) return [];
    return LADDER_QUANTITIES.map((q) => ({
      qty: q,
      res: priceJob({ family, w: Number(tw), h: Number(th), qty: q, configs: liveConfigs }),
    }));
  }, [ladderTier, family, tw, th, liveConfigs]);

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
      toast.success("תצורת התמחור נשמרה");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchTier = (i: number, patch: Partial<Tier>) =>
    setDraft((d) => ({
      ...d,
      tiers: d.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)),
    }));

  const moveTier = (i: number, delta: number) =>
    setDraft((d) => {
      const arr = [...d.tiers];
      const j = i + delta;
      if (j < 0 || j >= arr.length) return d;
      [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      return { ...d, tiers: arr };
    });

  return (
    <section className="border-2 border-[var(--ink)] bg-card p-4 shadow-[4px_4px_0_0_var(--ink)]">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-black">תצורת תמחור — «{family}»</h2>
        <button
          onClick={() => save.mutate()}
          className="bg-[var(--accent-raw)] px-4 py-2 text-xs font-bold text-white shadow-[3px_3px_0_0_var(--ink)]"
        >
          שמור תצורה
        </button>
      </div>

      <div className="space-y-3">
        {draft.tiers.map((tier, i) => {
          const meta = METHODS.find((m) => m.value === tier.method)!;
          const params = (tier.params ?? {}) as Record<string, unknown>;
          return (
            <div key={i} className="border-2 border-dashed border-[var(--ink)] p-3">
              <div className="mb-2 flex flex-wrap items-end gap-2">
                <div className="w-40">
                  <label className="block text-[11px] font-bold text-muted-foreground">שם שכבה</label>
                  <input
                    className={fieldCls}
                    value={tier.name}
                    onChange={(e) => patchTier(i, { name: e.target.value })}
                  />
                </div>
                <div className="w-52">
                  <label className="block text-[11px] font-bold text-muted-foreground">שיטה</label>
                  <select
                    className={fieldCls}
                    value={tier.method}
                    onChange={(e) =>
                      patchTier(i, { method: e.target.value as PricingMethod, params: {} })
                    }
                  >
                    {METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="ms-auto flex items-center gap-1">
                  <button
                    onClick={() => moveTier(i, -1)}
                    className="border-2 border-[var(--ink)] p-1"
                    aria-label="העלה שכבה"
                  >
                    <ArrowUp className="size-3" />
                  </button>
                  <button
                    onClick={() => moveTier(i, 1)}
                    className="border-2 border-[var(--ink)] p-1"
                    aria-label="הורד שכבה"
                  >
                    <ArrowDown className="size-3" />
                  </button>
                  <button
                    onClick={() =>
                      setDraft((d) => ({ ...d, tiers: d.tiers.filter((_, idx) => idx !== i) }))
                    }
                    className="border-2 border-[var(--ink)] p-1 text-[oklch(0.5_0.2_25)]"
                    aria-label="מחק שכבה"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
              </div>

              <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(["min_w", "max_w", "min_h", "max_h"] as const).map((k) => (
                  <div key={k}>
                    <label className="block text-[11px] font-bold text-muted-foreground">
                      {MATCH_LABELS[k]}
                    </label>
                    <input
                      className={`${fieldCls} num`}
                      value={tier.match?.[k] ?? ""}
                      placeholder="—"
                      onChange={(e) =>
                        patchTier(i, {
                          match: { ...(tier.match ?? {}), [k]: numOrUndef(e.target.value) },
                        })
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {meta.fields.map((f) => (
                  <div key={f}>
                    <label className="block text-[11px] font-bold text-muted-foreground">
                      {FIELD_LABELS[f] ?? f}
                    </label>
                    {f === "family" ? (
                      <select
                        className={fieldCls}
                        value={String(params['family'] ?? "")}
                        onChange={(e) =>
                          patchTier(i, { params: { ...params, family: e.target.value } })
                        }
                      >
                        <option value="">בחר משפחה…</option>
                        {familyNames
                          .filter((f2) => f2 !== family)
                          .map((f2) => (
                            <option key={f2} value={f2}>
                              {f2}
                            </option>
                          ))}
                      </select>
                    ) : (
                      <input
                        className={`${fieldCls} num`}
                        value={String(params[f] ?? "")}
                        onChange={(e) =>
                          patchTier(i, { params: { ...params, [f]: numOrUndef(e.target.value) } })
                        }
                      />
                    )}
                  </div>
                ))}
                {tier.method === "reference" ? (
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground">
                      דריסת מינימום ₪
                    </label>
                    <input
                      className={`${fieldCls} num`}
                      value={String(
                        ((params['overrides'] as Record<string, unknown>) ?? {})['min'] ?? "",
                      )}
                      onChange={(e) =>
                        patchTier(i, {
                          params: {
                            ...params,
                            overrides: {
                              ...((params['overrides'] as Record<string, unknown>) ?? {}),
                              min: numOrUndef(e.target.value),
                            },
                          },
                        })
                      }
                    />
                  </div>
                ) : null}
                {tier.method !== "per_sheet" && tier.method !== "reference" ? (
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground">
                      עלות ₪ למ״ר
                    </label>
                    <input
                      className={`${fieldCls} num`}
                      value={String(tier.cost?.cost_per_m2 ?? "")}
                      onChange={(e) =>
                        patchTier(i, {
                          cost: { ...(tier.cost ?? {}), cost_per_m2: numOrUndef(e.target.value) ?? 0 },
                        })
                      }
                    />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        <button
          onClick={() => setDraft((d) => ({ ...d, tiers: [...d.tiers, emptyTier()] }))}
          className="flex items-center gap-1 border-2 border-[var(--ink)] px-3 py-1.5 text-xs font-bold shadow-[3px_3px_0_0_var(--ink)]"
        >
          <Plus className="size-3" /> הוסף שכבה
        </button>
      </div>

      {/* qty model / rounding / overhead */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-[11px] font-bold text-muted-foreground">מודל כמות</label>
          <select
            className={fieldCls}
            value={draft.qty_model?.type ?? "tiers"}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                qty_model:
                  e.target.value === "power"
                    ? { type: "power", exponent: 0.85 }
                    : { type: "tiers", tiers: [] },
              }))
            }
          >
            <option value="tiers">מדרגות כמות</option>
            <option value="power">מקדם חזקה</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-muted-foreground">עיגול ₪</label>
          <div className="flex gap-2">
            <input
              className={`${fieldCls} num`}
              value={String(draft.rounding?.step ?? 1)}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  rounding: { ...(d.rounding ?? {}), step: numOrUndef(e.target.value) ?? 1 },
                }))
              }
            />
            <select
              className={fieldCls}
              value={draft.rounding?.direction ?? "nearest"}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  rounding: {
                    ...(d.rounding ?? {}),
                    direction: e.target.value as "up" | "down" | "nearest",
                  },
                }))
              }
            >
              <option value="up">כלפי מעלה</option>
              <option value="down">כלפי מטה</option>
              <option value="nearest">לקרוב</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-muted-foreground">מקדם תקורה</label>
          <input
            className={`${fieldCls} num`}
            value={String(draft.cost?.overhead_mult ?? 1.3)}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                cost: { ...(d.cost ?? {}), overhead_mult: numOrUndef(e.target.value) ?? 1.3 },
              }))
            }
          />
        </div>
      </div>

      {draft.qty_model?.type === "tiers" ? (
        <div className="mt-3 space-y-2">
          {(draft.qty_model.tiers ?? []).map((t, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="w-32">
                <label className="block text-[11px] font-bold text-muted-foreground">מכמות</label>
                <input
                  className={`${fieldCls} num`}
                  value={String(t.min_qty)}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      qty_model: {
                        type: "tiers",
                        tiers: (d.qty_model as { tiers: { min_qty: number; mult: number }[] }).tiers.map(
                          (x, idx) =>
                            idx === i ? { ...x, min_qty: numOrUndef(e.target.value) ?? 0 } : x,
                        ),
                      },
                    }))
                  }
                />
              </div>
              <div className="w-32">
                <label className="block text-[11px] font-bold text-muted-foreground">מכפיל</label>
                <input
                  className={`${fieldCls} num`}
                  value={String(t.mult)}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      qty_model: {
                        type: "tiers",
                        tiers: (d.qty_model as { tiers: { min_qty: number; mult: number }[] }).tiers.map(
                          (x, idx) => (idx === i ? { ...x, mult: numOrUndef(e.target.value) ?? 1 } : x),
                        ),
                      },
                    }))
                  }
                />
              </div>
              <button
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    qty_model: {
                      type: "tiers",
                      tiers: (d.qty_model as { tiers: { min_qty: number; mult: number }[] }).tiers.filter(
                        (_, idx) => idx !== i,
                      ),
                    },
                  }))
                }
                className="border-2 border-[var(--ink)] p-1.5 text-[oklch(0.5_0.2_25)]"
                aria-label="מחק מדרגה"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setDraft((d) => ({
                ...d,
                qty_model: {
                  type: "tiers",
                  tiers: [
                    ...((d.qty_model as { tiers: { min_qty: number; mult: number }[] })?.tiers ?? []),
                    { min_qty: 10, mult: 0.9 },
                  ],
                },
              }))
            }
            className="border-2 border-[var(--ink)] px-3 py-1 text-[11px] font-bold"
          >
            הוסף מדרגת כמות
          </button>
        </div>
      ) : (
        <div className="mt-3 w-40">
          <label className="block text-[11px] font-bold text-muted-foreground">מעריך (c)</label>
          <input
            className={`${fieldCls} num`}
            value={String((draft.qty_model as { exponent?: number })?.exponent ?? 0.85)}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                qty_model: { type: "power", exponent: numOrUndef(e.target.value) ?? 0.85 },
              }))
            }
          />
        </div>
      )}

      {/* live test box */}
      <div className="mt-5 border-2 border-[var(--ink)] bg-[var(--surface-deep)] p-3">
        <div className="mb-2 text-xs font-black">בדיקה חיה</div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-24">
            <label className="block text-[11px] font-bold text-muted-foreground">רוחב</label>
            <input className={`${fieldCls} num`} value={tw} onChange={(e) => setTw(e.target.value)} />
          </div>
          <div className="w-24">
            <label className="block text-[11px] font-bold text-muted-foreground">גובה</label>
            <input className={`${fieldCls} num`} value={th} onChange={(e) => setTh(e.target.value)} />
          </div>
          <div className="w-24">
            <label className="block text-[11px] font-bold text-muted-foreground">כמות</label>
            <input className={`${fieldCls} num`} value={tq} onChange={(e) => setTq(e.target.value)} />
          </div>
          <div className="min-w-40">
            {test.ok ? (
              <>
                <div className="num text-2xl font-black text-[var(--accent-raw)]">
                  {shekel(test.price ?? 0)}
                </div>
                <div className="text-[11px] font-bold">
                  שכבה: {test.tierPath.join(" → ")} · {test.label}
                </div>
                {test.breakdown.map((line, i) => (
                  <div key={i} className="text-[11px] text-muted-foreground">
                    {line}
                  </div>
                ))}
                <div className="text-[11px] text-muted-foreground">
                  רצפת עלות {shekel(test.costFloor)}
                </div>
              </>
            ) : (
              <div className="text-sm font-bold text-[oklch(0.5_0.2_25)]">{test.error}</div>
            )}
          </div>
        </div>

        {ladderTier && ladder.length > 0 ? (
          <div className="mt-3">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-black">סולם כמויות</span>
              <button
                onClick={() => {
                  const text = ladder
                    .map((l) => `${l.qty}\t${l.res.price ?? ""}`)
                    .join("\n");
                  navigator.clipboard.writeText(text);
                  toast.success("הסולם הועתק");
                }}
                className="flex items-center gap-1 border-2 border-[var(--ink)] px-2 py-0.5 text-[11px] font-bold"
              >
                <Copy className="size-3" /> העתק
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {ladder.map((l) => (
                <div key={l.qty} className="border-2 border-[var(--ink)] bg-card px-2 py-1 text-xs">
                  <span className="num font-bold">{l.qty}</span> יח׳ ·{" "}
                  <span className="num font-black text-[var(--accent-raw)]">
                    {shekel(l.res.price ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
