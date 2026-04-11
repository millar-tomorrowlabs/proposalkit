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

You have access to the current proposal state. When the user asks you to change something, suggest precise edits in your response. Describe each change clearly with the field path, old value, and new value.

When the user asks a question without requesting changes, respond conversationally.

VOICE AND TONE:
- Direct and confident. No hedging.
- Specific, not generic. Name real platforms, real timelines, real constraints.
- Client-centric. Every sentence should be about what the client gets.
- Short sentences mixed with detailed ones. No passive voice. No jargon.
- Never use: "digital transformation", "leverage", "world-class", "best-in-class", "seamlessly", "cutting-edge", "holistic", "synergy", "empower", "elevate"

RULES:
- Keep edits minimal — only change what the user asked for.
- For text edits, provide the full new value.
- If the user's request is vague, ask a clarifying question instead of guessing.`
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
