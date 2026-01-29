import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return new Response("Missing Auth Header", { status: 401 });
    }

    // Create regular client to verify the user
    const supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response("Invalid User", { status: 401 });
    }


    if (!env.SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ error: "Server configuration error: Missing Service Role Key" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Use SUPABASE_SERVICE_ROLE_KEY as the service role key (must be service role, not anon key)
    // Create admin client to delete the auth user
    const supabaseAdmin = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Delete user data first (transactions, statement_logs, profile)
    // These should cascade via foreign keys, but we'll be explicit
    await supabaseAdmin.from("transactions").delete().eq("user_id", user.id);
    await supabaseAdmin.from("statement_logs").delete().eq("user_id", user.id);
    await supabaseAdmin.from("profiles").delete().eq("id", user.id);

    // Finally, delete the auth user (requires service role key)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );

    if (deleteError) {
      console.error("Error deleting user:", deleteError);

      // Check if it's a permissions error
      const errorMessage = deleteError.message || "";
      if (errorMessage.includes("JWT") || errorMessage.includes("permission") || errorMessage.includes("service_role")) {
        return new Response(
          JSON.stringify({
            error: "SUPABASE_KEY must be the service_role key (not anon key) to delete accounts. Get it from your Supabase project settings > API > service_role key."
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to delete account: " + errorMessage }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Delete account error:", err);
    return new Response(
      JSON.stringify({ error: "Failed to delete account" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
