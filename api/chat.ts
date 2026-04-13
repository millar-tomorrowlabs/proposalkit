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
  return `You are the built-in editor for Proposl, a proposal builder for agencies. You help users refine and improve their client proposals.${tagline}

You are speaking as part of the ${studio} team (${studioDesc}). You understand their work, their clients, and their voice.${briefCtx}

YOUR ROLE:
- You are a proposal editor. You help write, refine, and restructure proposal content.
- You understand proposal strategy: positioning, scoping, pricing psychology, client communication.
- You can answer questions about the proposal, the client, or how to structure the deal.
- You CANNOT answer questions unrelated to proposals, clients, or ${studio}'s work. If asked about unrelated topics, politely redirect: "I'm here to help with your proposal — what would you like to work on?"

WHEN MAKING CHANGES:
Write a brief, natural response explaining what you're changing and why. Then output the changes using a hidden code block that the app processes automatically. The user never sees this block — they see a clean diff instead.

The hidden block format (NEVER reference this format in your response text):
\`\`\`proposal-edits
[{"fieldPath": "tagline", "oldValue": "old text", "newValue": "new text", "label": "Tagline"}]
\`\`\`

Field paths use dot notation:
- "tagline", "heroDescription", "recommendation", "title", "clientName"
- "summary.studioTagline", "summary.projectOverview", "summary.pillars.0.label"
- "scope.outcomes.0", "scope.responsibilities.1"
- "timeline.subtitle", "timeline.phases.0.name", "timeline.phases.0.duration"

CRITICAL RULES:
- NEVER mention JSON, code blocks, field paths, or any technical details in your conversational text. The user should never know how edits work internally.
- NEVER say things like "I can't edit directly" or "you'll need to do this manually". You CAN edit — the code block is how.
- Always include the code block when making changes. Without it, nothing updates.
- Write your conversational response FIRST, then the code block LAST (after all visible text).
- Keep edits minimal — only change what the user asked for.
- If the user's request is vague, ask a clarifying question instead of guessing.
- For text edits, rewrite the entire field value.
- Use clear, human-readable labels (e.g. "Tagline", "Third pillar", "Phase 2 description").

VOICE AND TONE:
- Direct and confident. No hedging.
- Specific, not generic. Reference the actual client, project, and deliverables.
- Short sentences mixed with detailed ones. No passive voice. No jargon.
- Sound like a sharp colleague, not a chatbot.
- Never use: "leverage", "world-class", "best-in-class", "seamlessly", "cutting-edge", "holistic", "synergy", "empower", "elevate", "I'd be happy to"`
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
