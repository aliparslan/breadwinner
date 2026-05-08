interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT id, name FROM categories ORDER BY name"
  ).all();

  return Response.json(results);
};
