import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { contextBlobs, proposal } = await req.json()

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const contextText = contextBlobs
      .filter((b: { content: string }) => b.content?.trim())
      .map((b: { label: string; content: string }) => `--- ${b.label || "Context"} ---\n${b.content}`)
      .join("\n\n")

    if (!contextText) {
      return new Response(JSON.stringify({ error: "No context provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const prompt = `You are helping Tomorrow Studios, a creative agency that builds Shopify themes, web apps, and brand experiences, draft a client proposal.

Based on the following deal context, generate suggestions for all proposal fields.

${contextText}

Return a JSON object with suggested content. All fields are optional — only include what you can confidently infer. Use concise, professional language appropriate for a high-end agency proposal.

Field guide:
- title: Proposal title (e.g. "Flush & Seawards — Shopify Migration")
- clientName: Client name(s), use "+" for multiple clients (e.g. "Flush + Seawards")
- tagline: Hero headline, 3-8 words, aspirational and specific to the project
- heroDescription: 1-2 sentences below the tagline
- recommendation: Completes "Our recommendation is to..." — steer the client toward the most appropriate approach
- summary.studioTagline: One-line description of Tomorrow Studios
- summary.studioDescription: 2-4 sentence paragraph about the studio's craft and approach
- summary.studioDescription2: Optional continuation paragraph
- summary.projectOverview: One sentence overview of this specific engagement
- summary.projectDetail: 2-4 sentences on the project scope and approach
- summary.projectDetail2: Optional second paragraph
- summary.pillarsTagline: Intro for the pillars (e.g. "Three workstreams that define this engagement.")
- summary.pillars: 2-4 engagement pillars [{label, description}], each label 1-2 words, description 1 sentence
- scope.outcomes: 3-6 concrete deliverables the client will receive (be specific)
- scope.responsibilities: 2-4 things the client needs to provide or action
- timeline.subtitle: One sentence about timing/launch target
- timeline.phases: 4-6 project phases [{name, duration, description}] — duration like "Week 1", "Weeks 2–4", description 1 sentence
- addOns: 5-10 optional services relevant to this project. Each: {label (2-4 words), description (1 sentence), category (one of: "Design", "Development", "SEO", "Marketing", "Operations", "Support", "Analytics", "Content")}

Return ONLY valid JSON, no markdown, no explanation, no code fences.`

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return new Response(JSON.stringify({ error: err }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    const result = await response.json()
    const text = result.content?.[0]?.text ?? ""

    let suggestions
    try {
      suggestions = JSON.parse(text)
    } catch {
      // Claude occasionally wraps in markdown — strip it
      const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
      suggestions = match ? JSON.parse(match[1]) : {}
    }

    return new Response(JSON.stringify(suggestions), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
