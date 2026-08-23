import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { PageTitle } from "@/components/AppShell";
import { useAuth } from "@/lib/auth";
import { familiesQuery } from "@/lib/queries";
import {
  createUser,
  deleteUser,
  listUsers,
  resetUserPassword,
  setUserFamilies,
  setUserRole,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "ניהול משתמשים — קונסולת MDVD" },
      { name: "description", content: "יצירת משתמשים, הרשאות מנהל והגבלת משפחות במחשבון." },
      { property: "og:title", content: "ניהול משתמשים — קונסולת MDVD" },
      {
        property: "og:description",
        content: "יצירת משתמשים, הרשאות מנהל והגבלת משפחות במחשבון.",
      },
    ],
  }),
  component: AdminPage,
});

const inputCls =
  "w-full border-b-2 border-[var(--ink)] bg-transparent px-2 py-2 outline-none focus:border-[var(--accent-raw)]";

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const { data: families = [] } = useQuery(familiesQuery());
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listUsers(),
    enabled: isAdmin,
  });

  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [name, setName] = useState("");
  const [asAdmin, setAsAdmin] = useState(false);
  const [openUser, setOpenUser] = useState<string | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const add = useMutation({
    mutationFn: () =>
      createUser({ data: { email, password: pwd, displayName: name, isAdmin: asAdmin } }),
    onSuccess: () => {
      setEmail("");
      setPwd("");
      setName("");
      setAsAdmin(false);
      invalidate();
      toast.success("המשתמש נוצר");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const role = useMutation({
    mutationFn: (v: { userId: string; isAdmin: boolean }) => setUserRole({ data: v }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const fams = useMutation({
    mutationFn: (v: { userId: string; families: string[] }) => setUserFamilies({ data: v }),
    onSuccess: () => {
      invalidate();
      toast.success("ההרשאות נשמרו");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => deleteUser({ data: { userId } }),
    onSuccess: () => {
      invalidate();
      toast.success("המשתמש נמחק");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPwd = useMutation({
    mutationFn: (v: { userId: string; password: string }) => resetUserPassword({ data: v }),
    onSuccess: () => toast.success("הסיסמה עודכנה"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) return null;
  if (!isAdmin)
    return (
      <div className="border-2 border-[var(--ink)] bg-card p-8 text-center font-semibold">
        העמוד זמין למנהלים בלבד.
      </div>
    );

  return (
    <>
      <PageTitle title="ניהול משתמשים" sub="מנהלים רואים הכול · משתמש רגיל רואה רק משפחות מאושרות" />

      <section className="mb-8 border-2 border-[var(--ink)] bg-card p-5 shadow-[6px_6px_0_0_var(--ink)]">
        <h2 className="mb-4 text-lg font-black">משתמש חדש</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <label className="block text-sm">
            <span className="font-semibold">אימייל</span>
            <input
              dir="ltr"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">סיסמה</span>
            <input
              dir="ltr"
              className={inputCls}
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-semibold">שם תצוגה</span>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={asAdmin}
                onChange={(e) => setAsAdmin(e.target.checked)}
              />
              מנהל
            </label>
            <button
              onClick={() => add.mutate()}
              disabled={!email || pwd.length < 6 || add.isPending}
              className="bg-[var(--accent-raw)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              הוסף
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">סיסמה: 6 תווים לפחות.</p>
      </section>

      <section className="border-2 border-[var(--ink)] bg-card shadow-[6px_6px_0_0_var(--ink)]">
        {(users.data ?? []).map((u) => (
          <div key={u.id} className="border-b border-[var(--ink)]/20 p-4 last:border-b-0">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-56">
                <div className="font-bold">{u.display_name || u.email}</div>
                <div className="font-mono text-xs text-muted-foreground" dir="ltr">
                  {u.email}
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={u.is_admin}
                  onChange={(e) => role.mutate({ userId: u.id, isAdmin: e.target.checked })}
                />
                מנהל
              </label>
              <span className="text-xs text-muted-foreground">
                {u.is_admin ? "גישה מלאה" : `${u.families.length} משפחות מאושרות`}
              </span>
              <div className="ms-auto flex gap-2">
                {!u.is_admin && (
                  <button
                    onClick={() => setOpenUser(openUser === u.id ? null : u.id)}
                    className="border-2 border-[var(--ink)] px-3 py-1 text-xs font-bold"
                  >
                    משפחות במחשבון
                  </button>
                )}
                <button
                  onClick={() => {
                    const p = window.prompt("סיסמה חדשה (6 תווים לפחות)");
                    if (p && p.length >= 6) resetPwd.mutate({ userId: u.id, password: p });
                  }}
                  className="border-2 border-[var(--ink)] px-3 py-1 text-xs font-bold"
                >
                  איפוס סיסמה
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`למחוק את ${u.email}?`)) remove.mutate(u.id);
                  }}
                  className="border-2 border-destructive px-3 py-1 text-xs font-bold text-destructive"
                >
                  מחק
                </button>
              </div>
            </div>

            {openUser === u.id && !u.is_admin && (
              <FamilyPicker
                all={families.map((f) => f.family)}
                selected={u.families}
                saving={fams.isPending}
                onSave={(list) => fams.mutate({ userId: u.id, families: list })}
              />
            )}
          </div>
        ))}
        {users.data?.length === 0 && (
          <div className="p-6 text-center text-sm text-muted-foreground">אין משתמשים עדיין.</div>
        )}
      </section>
    </>
  );
}

function FamilyPicker({
  all,
  selected,
  saving,
  onSave,
}: {
  all: string[];
  selected: string[];
  saving: boolean;
  onSave: (list: string[]) => void;
}) {
  const [list, setList] = useState<string[]>(selected);
  const toggle = (f: string) =>
    setList((prev) => (prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]));
  return (
    <div className="mt-4 border-t border-[var(--ink)]/20 pt-4">
      <div className="mb-3 flex gap-2">
        <button
          onClick={() => setList(all)}
          className="border border-[var(--ink)] px-2 py-1 text-[11px] font-bold"
        >
          בחר הכול
        </button>
        <button
          onClick={() => setList([])}
          className="border border-[var(--ink)] px-2 py-1 text-[11px] font-bold"
        >
          נקה
        </button>
        <button
          onClick={() => onSave(list)}
          disabled={saving}
          className="bg-[var(--accent-raw)] px-3 py-1 text-[11px] font-bold text-white disabled:opacity-50"
        >
          שמור
        </button>
      </div>
      <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {all.map((f) => (
          <label key={f} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={list.includes(f)} onChange={() => toggle(f)} />
            {f}
          </label>
        ))}
      </div>
    </div>
  );
}
