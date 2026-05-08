interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as any).userId;

  const { results } = await env.DB.prepare(
    "SELECT * FROM profiles WHERE user_id = ?"
  ).bind(userId).all();

  if (results.length === 0) {
    await env.DB.prepare(
      "INSERT INTO profiles (user_id) VALUES (?)"
    ).bind(userId).run();
    return Response.json({ user_id: userId, gemini_api_key: null, insights_cache: null, insights_updated_at: null });
  }

  return Response.json(results[0]);
};

export const onRequestPut: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as any).userId;
  const body = await request.json() as Record<string, any>;

  const allowedFields = ["gemini_api_key", "insights_cache", "insights_updated_at"];
  const updates: string[] = [];
  const values: any[] = [];

  for (const field of allowedFields) {
    if (field in body) {
      updates.push(`${field} = ?`);
      values.push(body[field]);
    }
  }

  if (updates.length === 0) {
    return new Response(JSON.stringify({ error: "No valid fields to update" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  values.push(userId);

  await env.DB.prepare(
    `INSERT INTO profiles (user_id) VALUES (?) ON CONFLICT(user_id) DO NOTHING`
  ).bind(userId).run();

  await env.DB.prepare(
    `UPDATE profiles SET ${updates.join(", ")} WHERE user_id = ?`
  ).bind(...values).run();

  return Response.json({ success: true });
};
