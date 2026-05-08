interface Env {
  CLERK_PUBLISHABLE_KEY: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  if (!env.CLERK_PUBLISHABLE_KEY) {
    return Response.json(
      { error: "Missing CLERK_PUBLISHABLE_KEY" },
      { status: 500 }
    );
  }

  return Response.json({
    clerkPublishableKey: env.CLERK_PUBLISHABLE_KEY,
  });
};
