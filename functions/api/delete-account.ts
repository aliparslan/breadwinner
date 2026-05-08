import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ahvfdteobwmrqkiorhpv.supabase.co";

interface Env {
  DB: D1Database;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_SECRET_KEY?: string;
}

async function ensureProfilesTable(db: D1Database) {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS profiles (
      user_id TEXT PRIMARY KEY,
      gemini_api_key TEXT,
      insights_cache TEXT,
      insights_updated_at TEXT
    )`
  ).run();
}

export const onRequestPost: PagesFunction<Env> = async ({ env, data }) => {
  try {
    const userId = (data as any).userId;

    await ensureProfilesTable(env.DB);
    await env.DB.prepare("DELETE FROM transactions WHERE user_id = ?").bind(userId).run();
    await env.DB.prepare("DELETE FROM statement_logs WHERE user_id = ?").bind(userId).run();
    await env.DB.prepare("DELETE FROM profiles WHERE user_id = ?").bind(userId).run();

    const adminKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

    if (!adminKey) {
      return Response.json(
        { error: "Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, adminKey, {
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
