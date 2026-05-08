import { createRemoteJWKSet, jwtVerify } from "jose";

interface Env {
  DB: D1Database;
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_AUDIENCE: string;
  GEMINI_API_KEY: string;
}

const PUBLIC_ROUTES = ["/api/public-config", "/api/validate-key"];

function getIssuer(domain: string) {
  const normalized = domain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return `https://${normalized}/`;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  if (PUBLIC_ROUTES.includes(url.pathname)) {
    return context.next();
  }

  const authHeader = context.request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.slice(7);
  try {
    const issuer = getIssuer(context.env.AUTH0_DOMAIN);
    const jwks = createRemoteJWKSet(new URL(`${issuer}.well-known/jwks.json`));
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: context.env.AUTH0_AUDIENCE,
    });
    context.data.userId = payload.sub;
    return context.next();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
};
