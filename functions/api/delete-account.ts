import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ahvfdteobwmrqkiorhpv.supabase.co";

interface Env {
  DB: D1Database;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, data }) => {
  try {
    const userId = (data as any).userId;

    await env.DB.prepare("DELETE FROM transactions WHERE user_id = ?").bind(userId).run();
    await env.DB.prepare("DELETE FROM statement_logs WHERE user_id = ?").bind(userId).run();
    await env.DB.prepare("DELETE FROM profiles WHERE user_id = ?").bind(userId).run();

    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      return Response.json(
        { error: "Missing SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Supabase auth delete error:", deleteError);
      return Response.json(
        { error: `Failed to delete auth user: ${deleteError.message}` },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("Delete account error:", err);
    return Response.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
};
