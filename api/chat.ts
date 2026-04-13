import { streamText, type UIMessage, convertToModelMessages, type CoreMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { createClient } from "@supabase/supabase-js"

// Edge runtime — supports streaming and has 30s timeout (vs 10s for Node.js serverless)
export const config = { runtime: "edge" }

// --- System prompt ---

function buildSystemPrompt(ctx?: {
  studioName?: string
  studioDescription?: string
  studioTagline?: string
  brief?: string
}) {
  const studio = ctx?.studioName ?? "your studio"
  const studioDesc = ctx?.studioDescription ?? "a design and technology studio"
  const tagline = ctx?.studioTagline ? `\nStudio tagline: "${ctx.studioTagline}"` : ""
  const briefCtx = ctx?.brief
    ? `\n\nPROJECT BRIEF (the studio's working understanding of this client and project):\n${ctx.brief}`
    : ""
  return `You are an AI assistant helping edit a proposal for ${studio}, ${studioDesc}.${tagline}${briefCtx}

You have access to the current proposal state. When the user asks you to change something, you MUST output the edits as a JSON code block so they can be applied automatically.

MAKING EDITS:
When changes are needed, first provide a brief conversational explanation, then output a fenced JSON code block tagged \`\`\`proposal-edits with this exact format:

\`\`\`proposal-edits
[
  {
    "fieldPath": "summary.pillars.2.label",
    "oldValue": "SEO Protection",
    "newValue": "Store Build",
    "label": "Third pillar label"
  }
]
\`\`\`

FIELD PATH FORMAT:
Use dot notation for nested fields. Array indices are zero-based numbers.
- Top-level: "tagline", "title", "clientName", "heroDescription", "recommendation"
- Summary: "summary.studioTagline", "summary.projectDetail", "summary.pillars.0.label", "summary.pillars.0.description"
- Scope: "scope.outcomes.0", "scope.responsibilities.1"
- Timeline: "timeline.subtitle", "timeline.phases.0.name", "timeline.phases.0.description"
- Investment: "investment.packages.0.basePrice", "investment.packages.0.label"

RULES:
- Always include the proposal-edits code block when making changes. This is how edits are applied to the proposal — without it, nothing changes.
- Always include the current (old) value in each edit so the user can see what changed.
- Keep edits minimal — only change what the user asked for.
- For text edits, rewrite the entire field value (don't try to do partial string replacements).
- Use a clear, short human-readable label for each edit (e.g. "Tagline", "Scope Outcome #1", "Package 1 Price").
- If the user's request is vague, ask a clarifying question instead of guessing.
- When the user asks a question without requesting changes, respond conversationally without a code block.

VOICE AND TONE:
- Direct and confident. No hedging.
- Specific, not generic. Name real platforms, real timelines, real constraints.
- Client-centric. Every sentence should be about what the client gets.
- Short sentences mixed with detailed ones. No passive voice. No jargon.
- Never use: "digital transformation", "leverage", "world-class", "best-in-class", "seamlessly", "cutting-edge", "holistic", "synergy", "empower", "elevate"`
}

// --- Auth ---

async function verifyAuth(req: Request): Promise<void> {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED")
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    throw new Error("UNAUTHORIZED")
  }
}

// --- Handler ---

export default async function handler(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, content-type",
      },
    })
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    await verifyAuth(req)
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const { messages, proposal, accountContext } = (await req.json()) as {
      messages: UIMessage[]
      proposal: Record<string, unknown>
      accountContext?: {
        studioName?: string
        studioDescription?: string
        studioTagline?: string
        brief?: string
      }
    }

    // Prepend proposal state as context
    const proposalContext: CoreMessage = {
      role: "user",
      content: `Here is the current proposal state:\n\n${JSON.stringify(proposal, null, 2)}\n\nPlease help me edit this proposal. I'll describe what I'd like to change.`,
    }
    const assistantAck: CoreMessage = {
      role: "assistant",
      content: "I have the full proposal loaded. What would you like to change?",
    }

    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: buildSystemPrompt(accountContext),
      messages: [proposalContext, assistantAck, ...modelMessages],
      maxTokens: 8000,
    })

    return result.toUIMessageStreamResponse()
  } catch (err) {
    console.error("chat API error:", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
