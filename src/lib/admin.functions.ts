import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminUser = {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  families: string[];
};

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin only");
}

export const bootstrapStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count, error } = await supabaseAdmin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return { needsBootstrap: (count ?? 0) === 0 };
});

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { email: string; password: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) throw new Error("Admin already exists");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: created.user.id, role: "admin" }, { onConflict: "user_id,role" });
    return { ok: true };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUser[]> => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }, { data: fams }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,email,display_name").order("created_at"),
      supabaseAdmin.from("user_roles").select("user_id,role"),
      supabaseAdmin.from("user_family_access").select("user_id,family"),
    ]);
    return (profiles ?? []).map((p) => ({
      id: p.id,
      email: p.email ?? "",
      display_name: p.display_name,
      is_admin: (roles ?? []).some((r) => r.user_id === p.id && r.role === "admin"),
      families: (fams ?? []).filter((f) => f.user_id === p.id).map((f) => f.family),
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { email: string; password: string; displayName?: string; isAdmin: boolean }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName || data.email },
    });
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");
    if (data.isAdmin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: created.user.id, role: "admin" }, { onConflict: "user_id,role" });
    }
    return { ok: true };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; isAdmin: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId && !data.isAdmin) {
      throw new Error("אי אפשר להסיר לעצמך הרשאת מנהל");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.isAdmin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "user" }, { onConflict: "user_id,role" });
    }
    return { ok: true };
  });

export const setUserFamilies = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; families: string[] }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_family_access").delete().eq("user_id", data.userId);
    if (data.families.length) {
      await supabaseAdmin
        .from("user_family_access")
        .insert(data.families.map((family) => ({ user_id: data.userId, family })));
    }
    return { ok: true };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; password: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("אי אפשר למחוק את עצמך");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);
    return { ok: true };
  });
