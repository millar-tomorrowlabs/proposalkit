import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest("SHA-256", data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { proposalId, password } = await req.json()
    if (!proposalId || !password) {
      return new Response(
        JSON.stringify({ access: false, error: "Missing proposalId or password" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { data: proposal } = await supabase
      .from("proposals")
      .select("password_hash")
      .eq("id", proposalId)
      .single()

    if (!proposal) {
      return new Response(
        JSON.stringify({ access: false, error: "Proposal not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // No password set — allow access
    if (!proposal.password_hash) {
      return new Response(
        JSON.stringify({ access: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const inputHash = await sha256(password)
    const access = inputHash === proposal.password_hash

    return new Response(
      JSON.stringify({ access }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (e) {
    console.error("verify-proposal-password error:", e)
    return new Response(
      JSON.stringify({ access: false, error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
