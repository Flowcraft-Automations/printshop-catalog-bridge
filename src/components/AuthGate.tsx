import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const KEY = "mdvd_unlocked";

export function useLogout() {
  return () => {
    localStorage.removeItem(KEY);
    window.location.reload();
  };
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOk(localStorage.getItem(KEY) === "1");
    setReady(true);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase
      .from("app_config")
      .select("password")
      .eq("id", 1)
      .maybeSingle();
    setBusy(false);
    if (err) {
      setError("שגיאת חיבור למסד הנתונים");
      return;
    }
    if (data && (data as { password: string }).password === pwd) {
      localStorage.setItem(KEY, "1");
      setOk(true);
    } else {
      setError("סיסמה שגויה");
    }
  }

  if (!ready) return <div className="min-h-screen bg-background" />;
  if (ok) return <>{children}</>;

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--surface-deep)] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm border-2 border-[var(--ink)] bg-card p-8 shadow-[8px_8px_0_0_var(--ink)]"
      >
        <div className="mb-1 font-mono text-[11px] tracking-[0.3em] text-muted-foreground">
          MDVD / CATALOG OPS
        </div>
        <h1 className="mb-6 text-2xl font-black text-foreground">קונסולת הגירת קטלוג</h1>
        <label className="mb-2 block text-sm font-semibold text-foreground">סיסמת כניסה</label>
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          autoFocus
          className="w-full border-b-2 border-[var(--ink)] bg-transparent py-2 text-lg outline-none focus:border-[var(--accent-raw)]"
        />
        {error && <p className="mt-3 text-sm font-semibold text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full bg-[var(--accent-raw)] py-3 text-sm font-bold tracking-wide text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {busy ? "בודק…" : "כניסה"}
        </button>
      </form>
    </div>
  );
}
