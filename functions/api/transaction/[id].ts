interface Env {
  DB: D1Database;
}

export const onRequestPut: PagesFunction<Env> = async ({ request, env, data, params }) => {
  const userId = (data as any).userId;
  const id = params.id;
  const body = await request.json() as {
    description: string;
    amount: number;
    date: string;
    category_id: number;
  };

  if (typeof body.amount !== "number" || !body.date || !body.category_id) {
    return new Response(JSON.stringify({ error: "Missing required fields: amount, date, category_id" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await env.DB.prepare(`
    UPDATE transactions
    SET description = ?, amount = ?, date = ?, category_id = ?
    WHERE id = ? AND user_id = ?
  `).bind(body.description, body.amount, body.date, body.category_id, id, userId).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({ success: true });
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, data, params }) => {
  const userId = (data as any).userId;
  const id = params.id;

  const result = await env.DB.prepare(
    "DELETE FROM transactions WHERE id = ? AND user_id = ?"
  ).bind(id, userId).run();

  if (result.meta.changes === 0) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({ success: true });
};
