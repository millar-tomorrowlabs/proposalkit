import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { proposalId } = await req.json()
    if (!proposalId) {
      return new Response(
        JSON.stringify({ error: "Missing proposalId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Only upgrade "sent" → "viewed", never touch drafts or already-viewed
    await supabase
      .from("proposals")
      .update({ status: "viewed" })
      .eq("id", proposalId)
      .eq("status", "sent")

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (e) {
    console.error("track-view error:", e)
    return new Response(
      JSON.stringify({ success: true }), // still return success — fire-and-forget
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
