import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";

// Credentials are read from server-side secrets — never hardcoded.
const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .inputValidator((d: { username: string; password: string }) =>
    z.object({ username: z.string(), password: z.string() }).parse(d),
  )
  .handler(async ({ data }) => {
    if (!ADMIN_USERNAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
      return { ok: false as const, email: null, error: "Admin credentials not configured" };
    }
    if (data.username !== ADMIN_USERNAME || data.password !== ADMIN_PASSWORD) {
      return { ok: false as const, email: null };
    }

    const normalizedUsername = data.username.trim();
    const normalizedPassword = data.password;
    if (normalizedUsername !== ADMIN_USERNAME.trim() || normalizedPassword !== ADMIN_PASSWORD) {
      return { ok: false as const, email: null };
    }

    // Find the configured account and keep its password synchronized with the
    // protected project variable so the first login also repairs old bootstrap data.
    const { data: list, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      return { ok: false as const, email: null, error: listError.message };
    }
    const existing = list.users.find(
      (user) => user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
    );

    let userId = existing?.id;
    if (!existing) {
      const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
      if (error || !created.user) {
        return { ok: false as const, email: null, error: error?.message };
      }
      userId = created.user.id;
    } else {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
      });
      if (error) {
        return { ok: false as const, email: null, error: error.message };
      }
    }

    if (!userId) return { ok: false as const, email: null };

    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (roleError) {
      return { ok: false as const, email: null, error: roleError.message };
    }

    return { ok: true as const, email: ADMIN_EMAIL };
  });
