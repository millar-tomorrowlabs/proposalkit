import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function buildChatSystemPrompt(ctx?: { studioName?: string; studioDescription?: string }) {
  const studio = ctx?.studioName ?? "your studio"
  const studioDesc = ctx?.studioDescription ?? "a design and technology studio"
  return `You are an AI assistant helping edit a proposal for ${studio}, ${studioDesc}.

You have access to the current proposal state. When the user asks you to change something, use the propose_edits tool to suggest precise, structured edits. Also provide a brief conversational response explaining what you changed and why.

When the user asks a question without requesting changes, respond conversationally without using the tool.

VOICE AND TONE:
- Direct and confident. No hedging.
- Specific, not generic. Name real platforms, real timelines, real constraints.
- Client-centric. Every sentence should be about what the client gets.
- Short sentences mixed with detailed ones. No passive voice. No jargon.
- Never use: "digital transformation", "leverage", "world-class", "best-in-class", "seamlessly", "cutting-edge", "holistic", "synergy", "empower", "elevate"

FIELD PATH FORMAT:
Use dot notation for nested fields. Array indices are zero-based numbers.
Examples:
- Top-level: "tagline", "title", "clientName", "heroDescription", "recommendation"
- Summary: "summary.studioTagline", "summary.projectDetail", "summary.pillars.0.label"
- Scope: "scope.outcomes.0", "scope.responsibilities.1"
- Timeline: "timeline.subtitle", "timeline.phases.0.name", "timeline.phases.0.description"
- Investment: "investment.packages.0.basePrice", "investment.packages.0.label", "investment.addOns.0.label", "investment.retainer.hourlyRate"

RULES:
- Always include the current (old) value in each edit so the user can see what changed.
- Keep edits minimal — only change what the user asked for.
- For text edits, rewrite the entire field value (don't try to do partial string replacements).
- Use a clear, short human-readable label for each edit (e.g. "Tagline", "Scope Outcome #1", "Package 1 Price").
- If the user's request is vague, ask a clarifying question instead of guessing.`
}

const TOOL_DEFINITION = {
  name: "propose_edits",
  description: "Propose structured edits to the proposal. Each edit specifies a field path, the current value, the new value, and a human-readable label.",
  input_schema: {
    type: "object" as const,
    properties: {
      edits: {
        type: "array",
        items: {
          type: "object",
          properties: {
            fieldPath: {
              type: "string",
              description: "Dot-notation path to the field, e.g. 'summary.studioTagline' or 'investment.packages.0.basePrice'",
            },
            oldValue: {
              description: "The current value at this path (for diff display)",
            },
            newValue: {
              description: "The proposed new value",
            },
            label: {
              type: "string",
              description: "Human-readable label, e.g. 'Studio tagline' or 'Package 1 price'",
            },
          },
          required: ["fieldPath", "oldValue", "newValue", "label"],
        },
      },
    },
    required: ["edits"],
  },
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { messages, proposal, userMessage, accountContext } = await req.json()

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    // Build the messages array for Claude
    // First message: current proposal state as context
    const apiMessages: { role: string; content: string }[] = [
      {
        role: "user",
        content: `Here is the current proposal state:\n\n${JSON.stringify(proposal, null, 2)}\n\nPlease help me edit this proposal. I'll describe what I'd like to change.`,
      },
      {
        role: "assistant",
        content: "I have the full proposal loaded. What would you like to change?",
      },
    ]

    // Add conversation history (stripped to role + content)
    if (messages?.length) {
      for (const msg of messages) {
        apiMessages.push({ role: msg.role, content: msg.content })
      }
    }

    // Add the new user message
    apiMessages.push({ role: "user", content: userMessage })

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 8000,
        thinking: {
          type: "enabled",
          budget_tokens: 4000,
        },
        system: buildChatSystemPrompt(accountContext),
        tools: [TOOL_DEFINITION],
        tool_choice: { type: "auto" },
        messages: apiMessages,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return new Response(
        JSON.stringify({ error: err }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      )
    }

    const result = await response.json()

    // Extract text content and tool use from response
    let content = ""
    let edits: unknown[] | undefined

    for (const block of result.content ?? []) {
      if (block.type === "text") {
        content += block.text
      } else if (block.type === "tool_use" && block.name === "propose_edits") {
        edits = block.input?.edits
      }
    }

    // If there's no text content but there are edits, provide a default message
    if (!content.trim() && edits?.length) {
      content = "Here are my suggested changes:"
    }

    return new Response(
      JSON.stringify({ content, edits }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    )
  }
})
