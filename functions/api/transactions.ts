interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, data }) => {
  const userId = (data as any).userId;

  const { results } = await env.DB.prepare(`
    SELECT t.id, t.user_id, t.category_id, t.statement_id, t.date,
           t.description, t.amount, t.created_at, c.name as category_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ?
    ORDER BY t.date DESC
  `).bind(userId).all();

  return Response.json(results);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env, data }) => {
  const userId = (data as any).userId;
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
    INSERT INTO transactions (user_id, category_id, date, description, amount)
    VALUES (?, ?, ?, ?, ?)
  `).bind(userId, body.category_id, body.date, body.description || "", body.amount).run();

  return Response.json({ id: result.meta.last_row_id, ...body, user_id: userId });
};
