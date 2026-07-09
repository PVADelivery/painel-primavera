import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const { data: drivers, error } = await supabase.from("delivery_drivers").select("*");

  return new Response(JSON.stringify({ drivers, error }), {
    headers: { "Content-Type": "application/json" },
  });
});
