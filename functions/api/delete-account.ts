interface Env {
  DB: D1Database;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, data }) => {
  try {
    const userId = (data as any).userId;

    await env.DB.prepare("DELETE FROM transactions WHERE user_id = ?").bind(userId).run();
    await env.DB.prepare("DELETE FROM statement_logs WHERE user_id = ?").bind(userId).run();
    await env.DB.prepare("DELETE FROM profiles WHERE user_id = ?").bind(userId).run();

    return Response.json({ success: true });
  } catch (err: any) {
    console.error("Delete account error:", err);
    return Response.json(
      { error: "Failed to delete account" },
      { status: 500 }
    );
  }
};
