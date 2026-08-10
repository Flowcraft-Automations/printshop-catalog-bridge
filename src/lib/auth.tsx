import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AuthValue = {
  session: Session | null;
  userId: string | null;
  email: string | null;
  isAdmin: boolean;
  /** null = no restriction (admin). Array = families the regular user may use. */
  allowedFamilies: string[] | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthValue>({
  session: null,
  userId: null,
  email: null,
  isAdmin: false,
  allowedFamilies: null,
  loading: true,
  refresh: async () => {},
  signOut: async () => {},
});

export function useAuth() {
  return useContext(Ctx);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadPerms(uid: string | null) {
    if (!uid) {
      setIsAdmin(false);
      setAllowed(null);
      return;
    }
    const [{ data: roles }, { data: fams }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("user_family_access").select("family").eq("user_id", uid),
    ]);
    const admin = (roles ?? []).some((r) => (r as { role: string }).role === "admin");
    setIsAdmin(admin);
    setAllowed(admin ? null : ((fams ?? []) as { family: string }[]).map((f) => f.family));
  }

  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!alive) return;
      setSession(data.session ?? null);
      await loadPerms(data.session?.user.id ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      setSession(s ?? null);
      void loadPerms(s?.user.id ?? null);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      session,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      isAdmin,
      allowedFamilies: allowed,
      loading,
      refresh: () => loadPerms(session?.user.id ?? null),
      signOut: async () => {
        await supabase.auth.signOut();
        setSession(null);
        setIsAdmin(false);
        setAllowed(null);
      },
    }),
    [session, isAdmin, allowed, loading],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
