import { streamText, UIMessage, convertToModelMessages, type CoreMessage } from "ai"
import { anthropic } from "@ai-sdk/anthropic"
import { createClient } from "@supabase/supabase-js"
import { z } from "zod"
import type { VercelRequest, VercelResponse } from "@vercel/node"

// --- System prompt (ported from supabase/functions/chat-edit-proposal) ---

function buildChatSystemPrompt(ctx?: {
  studioName?: string
  studioDescription?: string
  studioTagline?: string
  brief?: string
}) {
  const studio = ctx?.studioName ?? "your studio"
  const studioDesc = ctx?.studioDescription ?? "a design and technology studio"
  const tagline = ctx?.studioTagline
    ? `\nStudio tagline: "${ctx.studioTagline}"`
    : ""
  const briefCtx = ctx?.brief
    ? `\n\nPROJECT BRIEF (the studio's working understanding of this client and project):\n${ctx.brief}`
    : ""
  return `You are an AI assistant helping edit a proposal for ${studio}, ${studioDesc}.${tagline}${briefCtx}

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

// --- Auth helper ---

async function verifyAuth(req: VercelRequest) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("UNAUTHORIZED")
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const token = authHeader.replace("Bearer ", "")
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    throw new Error("UNAUTHORIZED")
  }

  return user
}

// --- Main handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.setHeader("Access-Control-Allow-Headers", "authorization, content-type")
    return res.status(200).end()
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    // Verify auth
    await verifyAuth(req)

    const { messages, proposal, accountContext } = req.body as {
      messages: UIMessage[]
      proposal: Record<string, unknown>
      accountContext?: {
        studioName?: string
        studioDescription?: string
        studioTagline?: string
        brief?: string
      }
    }

    // Prepend proposal state as context in the conversation
    const proposalContext: CoreMessage = {
      role: "user",
      content: `Here is the current proposal state:\n\n${JSON.stringify(proposal, null, 2)}\n\nPlease help me edit this proposal. I'll describe what I'd like to change.`,
    }
    const assistantAck: CoreMessage = {
      role: "assistant",
      content: "I have the full proposal loaded. What would you like to change?",
    }

    // Convert UI messages to model messages
    const modelMessages = await convertToModelMessages(messages)

    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: buildChatSystemPrompt(accountContext),
      messages: [proposalContext, assistantAck, ...modelMessages],
      maxTokens: 8000,
      tools: {
        propose_edits: {
          description:
            "Propose structured edits to the proposal. Each edit specifies a field path, the current value, the new value, and a human-readable label.",
          parameters: z.object({
            edits: z.array(
              z.object({
                fieldPath: z.string().describe(
                  "Dot-notation path to the field, e.g. 'summary.studioTagline' or 'investment.packages.0.basePrice'",
                ),
                oldValue: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.record(z.unknown())]).describe("The current value at this path (for diff display)"),
                newValue: z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(z.unknown()), z.record(z.unknown())]).describe("The proposed new value"),
                label: z.string().describe(
                  "Human-readable label, e.g. 'Studio tagline' or 'Package 1 price'",
                ),
              }),
            ),
          }),
        },
      },
      toolChoice: "auto",
    })

    return result.toUIMessageStreamResponse()
  } catch (err) {
    if (err instanceof Error && err.message === "UNAUTHORIZED") {
      return res.status(401).json({ error: "Unauthorized" })
    }
    console.error("chat API error:", err)
    return res.status(500).json({ error: "Internal server error" })
  }
}
