import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";

export function AppShell({ children }: { children: ReactNode }) {
  const { isAdmin, email, signOut } = useAuth();
  const qc = useQueryClient();
  const nav = [
    { to: "/", label: "לוח בקרה" },
    { to: "/catalog", label: "קטלוג" },
    { to: "/calculator", label: "מחשבון מידות" },
    ...(isAdmin ? [{ to: "/admin", label: "משתמשים" }] : []),
  ];
  return (
    <div className="min-h-screen bg-[var(--surface-deep)]">
      <header className="sticky top-0 z-30 border-b-2 border-[var(--ink)] bg-[var(--accent-raw)] text-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-black">דפוס MDVD</span>
            <span className="font-mono text-[10px] tracking-[0.25em] text-white/60">
              MIGRATION CONSOLE
            </span>
          </div>
          <nav className="flex flex-wrap items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                activeOptions={{ exact: n.to === "/" }}
                className="px-3 py-1.5 text-sm font-semibold text-white/70 transition-colors hover:text-white"
                activeProps={{ className: "!text-white bg-white/15" }}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-3">
            {email && (
              <span className="font-mono text-[11px] text-white/60" dir="ltr">
                {email}
                {isAdmin ? " · admin" : ""}
              </span>
            )}
            <button
              onClick={async () => {
                await qc.cancelQueries();
                qc.clear();
                await signOut();
              }}
              className="border border-white/40 px-3 py-1 text-xs font-semibold text-white/80 hover:bg-white/10"
            >
              יציאה
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-5 py-6">{children}</main>
    </div>
  );
}

export function PageTitle({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-3xl font-black tracking-tight text-foreground">{title}</h1>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
    </div>
  );
}
