import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { bootstrapAdmin, bootstrapStatus } from "@/lib/admin.functions";

export function AuthGate({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState(false);

  useEffect(() => {
    if (session) return;
    bootstrapStatus()
      .then((r) => setNeedsBootstrap(r.needsBootstrap))
      .catch(() => setNeedsBootstrap(false));
  }, [session]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (needsBootstrap) {
        await bootstrapAdmin({ data: { email, password: pwd } });
      }
      const { error: err } = await supabase.auth.signInWithPassword({
        email,
        password: pwd,
      });
      if (err) throw new Error("אימייל או סיסמה שגויים");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאת התחברות");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="min-h-screen bg-background" />;
  if (session) return <>{children}</>;

  return (
    <div className="grid min-h-screen place-items-center bg-[var(--surface-deep)] px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm border-2 border-[var(--ink)] bg-card p-8 shadow-[8px_8px_0_0_var(--ink)]"
      >
        <div className="mb-1 font-mono text-[11px] tracking-[0.3em] text-muted-foreground">
          MDVD / CATALOG OPS
        </div>
        <h1 className="mb-6 text-2xl font-black text-foreground">
          {needsBootstrap ? "יצירת מנהל ראשון" : "כניסה למערכת"}
        </h1>
        <label className="mb-2 block text-sm font-semibold text-foreground">אימייל</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
          dir="ltr"
          required
          className="w-full border-b-2 border-[var(--ink)] bg-transparent py-2 text-lg outline-none focus:border-[var(--accent-raw)]"
        />
        <label className="mb-2 mt-5 block text-sm font-semibold text-foreground">סיסמה</label>
        <input
          type="password"
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          required
          dir="ltr"
          className="w-full border-b-2 border-[var(--ink)] bg-transparent py-2 text-lg outline-none focus:border-[var(--accent-raw)]"
        />
        {error && <p className="mt-3 text-sm font-semibold text-destructive">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-6 w-full bg-[var(--accent-raw)] py-3 text-sm font-bold tracking-wide text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50"
        >
          {busy ? "בודק…" : needsBootstrap ? "צור מנהל והיכנס" : "כניסה"}
        </button>
      </form>
    </div>
  );
}
