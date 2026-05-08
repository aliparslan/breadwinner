interface Env {
  AUTH0_DOMAIN: string;
  AUTH0_CLIENT_ID: string;
  AUTH0_AUDIENCE: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.AUTH0_DOMAIN || !env.AUTH0_CLIENT_ID || !env.AUTH0_AUDIENCE) {
    return Response.json(
      { error: "Missing Auth0 configuration" },
      { status: 500 }
    );
  }

  return Response.json({
    auth0Domain: env.AUTH0_DOMAIN,
    auth0ClientId: env.AUTH0_CLIENT_ID,
    auth0Audience: env.AUTH0_AUDIENCE,
  });
};
