import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function buildSystemPrompt(ctx?: { studioName?: string; studioDescription?: string }) {
  const studio = ctx?.studioName ?? "your studio"
  const studioDesc = ctx?.studioDescription ?? "a design and technology studio"

  return `You are a proposal writer for ${studio}, ${studioDesc}.

${studio} works with growing brands and businesses. Clients are founders, operators, and brand leads — intelligent people who appreciate directness and specificity over marketing language.

VOICE AND TONE:
- Direct and confident. No hedging, no qualifiers like "we believe" or "we aim to".
- Specific, not generic. Name real platforms, real timelines, real constraints.
- Client-centric. Every sentence should be about what the client gets or does, not what ${studio} offers.
- Short sentences mixed with detailed ones. No passive voice. No jargon.
- Never use: "digital transformation", "leverage", "world-class", "best-in-class", "seamlessly", "cutting-edge", "holistic", "synergy", "empower", "elevate"
- Do use: specific outcomes, real numbers, honest language about tradeoffs

STYLE REFERENCE (example tone and structure):
- Tagline: "Two stores. One platform."
- Hero description: "A complete Shopify migration for Flush and Seawards — ecommerce, point-of-sale, and everything in between."
- Recommendation: "...proceed with the Total package to ensure the project launches by the end of May. This scope includes the brand, content, and growth components that most retailers ultimately implement after launch, allowing the full system to be designed and built together."
- Outcome example: "Flush and Seawards live on Shopify (online store and POS) by the end of May"

Notice: taglines are punchy (3-8 words). Descriptions are specific to the actual project, not generic. Outcomes name concrete deliverables with timelines. Pillars use 1-2 word labels with 1-sentence descriptions.

PROPOSAL STRUCTURE:
- brief: Your synthesis of the client and project — 2-4 sentences capturing who the client is, what they need, and why
- title: "[Client Name] — [Project Type]" format
- clientName: The client's name. Use "+" for multiple parties (e.g. "Flush + Seawards")
- tagline: The hero headline. 3-8 words. Punchy, specific to this project.
- heroDescription: 1-2 sentences below the tagline. Sets the scene.
- recommendation: Completes "Our recommendation is to..." — steer toward the best approach for the client. Reference specific package names if relevant. 2-4 sentences.
- summary.studioTagline: One-line description of ${studio}
- summary.studioDescription: 2-4 sentences about ${studio}'s craft and approach
- summary.studioDescription2: Optional continuation paragraph
- summary.projectOverview: One sentence overview of this specific engagement
- summary.projectDetail: 2-4 sentences on the project scope and approach
- summary.projectDetail2: Optional second paragraph with additional context
- summary.pillarsTagline: Intro for the pillars (e.g. "Three workstreams that define this engagement.")
- summary.pillars: 2-4 engagement pillars, each with a 1-2 word label and 1 sentence description
- scope.outcomes: 3-6 concrete deliverables the client will receive (be specific, include timelines where possible)
- scope.responsibilities: 2-4 things the client needs to provide or action
- timeline.subtitle: One sentence about timing/launch target
- timeline.phases: 4-6 project phases with name, duration (e.g. "Week 1", "Weeks 2-4"), and 1-sentence description

IMPORTANT:
- Do NOT generate any investment/pricing content. No packages, no add-ons, no pricing. This is set manually.
- Only include fields you can confidently fill based on the context provided. If the context doesn't mention timelines, make reasonable assumptions based on project scope but flag them in the brief.
- The brief field is your internal working understanding — be honest about what you know and what you're inferring.`
}

const TOOL_DEFINITION = {
  name: "create_proposal_draft",
  description:
    "Creates a complete proposal draft from client context. Do not include investment/pricing fields.",
  input_schema: {
    type: "object" as const,
    properties: {
      brief: {
        type: "string",
        description:
          "2-4 sentence synthesis of the client, project, and key context. Be honest about what's known vs inferred.",
      },
      title: {
        type: "string",
        description: 'Proposal title in "[Client] — [Project Type]" format',
      },
      clientName: {
        type: "string",
        description: 'Client name(s). Use "+" for multiple parties.',
      },
      tagline: {
        type: "string",
        description: "Hero headline, 3-8 words, punchy and specific",
      },
      heroDescription: {
        type: "string",
        description: "1-2 sentences below the tagline",
      },
      recommendation: {
        type: "string",
        description:
          'Completes "Our recommendation is to..." — 2-4 sentences steering toward best approach',
      },
      summary: {
        type: "object",
        properties: {
          studioTagline: { type: "string" },
          studioDescription: { type: "string" },
          studioDescription2: { type: "string" },
          projectOverview: { type: "string" },
          projectDetail: { type: "string" },
          projectDetail2: { type: "string" },
          pillarsTagline: { type: "string" },
          pillars: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                description: { type: "string" },
              },
              required: ["label", "description"],
            },
          },
        },
      },
      scope: {
        type: "object",
        properties: {
          outcomes: {
            type: "array",
            items: { type: "string" },
            description: "3-6 concrete deliverables",
          },
          responsibilities: {
            type: "array",
            items: { type: "string" },
            description: "2-4 client responsibilities",
          },
        },
      },
      timeline: {
        type: "object",
        properties: {
          subtitle: { type: "string" },
          phases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                duration: { type: "string" },
                description: { type: "string" },
              },
              required: ["name", "duration", "description"],
            },
          },
        },
      },
    },
    required: ["brief", "title", "clientName", "tagline", "heroDescription"],
  },
}

async function scrapeUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Proposl/1.0; +https://proposl.app)",
      },
      redirect: "follow",
    })
    if (!response.ok) return `[Failed to fetch ${url}: ${response.status}]`

    const html = await response.text()

    // Extract useful meta tags
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() ?? ""
    const description =
      html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
      )?.[1] ?? ""
    const ogDescription =
      html.match(
        /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i,
      )?.[1] ?? ""
    const ogImage =
      html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
      )?.[1] ?? ""

    // Strip HTML tags and extract text content
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const bodyHtml = bodyMatch?.[1] ?? html
    const textContent = bodyHtml
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&[a-z]+;/gi, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000)

    const parts = [`URL: ${url}`]
    if (title) parts.push(`Page title: ${title}`)
    if (description) parts.push(`Meta description: ${description}`)
    if (ogDescription && ogDescription !== description)
      parts.push(`OG description: ${ogDescription}`)
    if (ogImage) parts.push(`OG image: ${ogImage}`)
    if (textContent) parts.push(`Page content:\n${textContent}`)

    return parts.join("\n")
  } catch (err) {
    return `[Failed to fetch ${url}: ${String(err)}]`
  }
}

// --- Hero image generation ---

async function generateHeroWithGemini(
  context: { tagline?: string; clientName?: string; brief?: string },
  proposalId: string,
): Promise<string | undefined> {
  const googleKey = Deno.env.get("GOOGLE_AI_API_KEY")
  if (!googleKey) return undefined

  // Build a prompt from proposal context
  const parts = []
  if (context.brief) parts.push(context.brief)
  if (context.tagline) parts.push(`Tagline: ${context.tagline}`)
  if (context.clientName) parts.push(`Client: ${context.clientName}`)

  if (parts.length === 0) return undefined

  const prompt = `Generate a professional hero image for a business proposal website. ${parts.join(". ")}. Style: modern, clean, editorial photography feel with rich colors and depth. Abstract or atmospheric — no text, no logos, no people's faces. Landscape orientation, 16:9 aspect ratio.`

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": googleKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ["IMAGE", "TEXT"],
          },
        }),
      },
    )

    if (!response.ok) {
      console.error("Gemini error:", response.status, await response.text())
      return undefined
    }

    const result = await response.json()

    // Find the image part in the response
    for (const candidate of result.candidates ?? []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.inlineData?.data) {
          // Upload base64 image to Supabase Storage
          const imageBytes = Uint8Array.from(atob(part.inlineData.data), (c) => c.charCodeAt(0))
          const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          )

          const { error: uploadError } = await supabase.storage
            .from("proposal-assets")
            .upload(`${proposalId}/hero.png`, imageBytes, {
              contentType: "image/png",
              upsert: true,
            })

          if (uploadError) {
            console.error("Storage upload error:", uploadError)
            return undefined
          }

          const { data: { publicUrl } } = supabase.storage
            .from("proposal-assets")
            .getPublicUrl(`${proposalId}/hero.png`)

          return `${publicUrl}?t=${Date.now()}`
        }
      }
    }

    return undefined
  } catch (err) {
    console.error("Gemini image generation error:", err)
    return undefined
  }
}

async function searchUnsplashImage(query: string): Promise<string | undefined> {
  const unsplashKey = Deno.env.get("UNSPLASH_ACCESS_KEY")
  if (!unsplashKey) return undefined

  try {
    // Extract 2-3 keywords from context
    const keywords = query
      .replace(/[^a-zA-Z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 3)
      .join(" ")

    if (!keywords.trim()) return undefined

    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keywords)}&orientation=landscape&per_page=1`,
      {
        headers: { Authorization: `Client-ID ${unsplashKey}` },
      },
    )

    if (!response.ok) {
      console.error("Unsplash error:", response.status)
      return undefined
    }

    const data = await response.json()
    return data.results?.[0]?.urls?.regular ?? undefined
  } catch (err) {
    console.error("Unsplash search error:", err)
    return undefined
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const { context, urls, clientName, clientEmail, ctaEmail, accountContext, proposalId } =
      await req.json()

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY")
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // Build context from all sources
    const contextParts: string[] = []

    // Scrape URLs
    if (urls?.length > 0) {
      const urlResults = await Promise.all(
        urls
          .filter((u: string) => u?.trim())
          .map((u: string) => scrapeUrl(u.trim())),
      )
      for (const result of urlResults) {
        contextParts.push(result)
      }
    }

    // Add user-provided context
    if (context?.trim()) {
      contextParts.push(`--- User-provided context ---\n${context.trim()}`)
    }

    if (contextParts.length === 0) {
      return new Response(
        JSON.stringify({ error: "No context provided" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    // Build the user message
    const userMessageParts = [
      "Generate a proposal draft based on the following context.",
      "",
      ...contextParts,
    ]

    if (clientName?.trim()) {
      userMessageParts.push(`\nClient name: ${clientName.trim()}`)
    }
    if (clientEmail?.trim()) {
      userMessageParts.push(`Client email: ${clientEmail.trim()}`)
    }
    if (ctaEmail?.trim()) {
      userMessageParts.push(`Proposal CTA email (for follow-up): ${ctaEmail.trim()}`)
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        thinking: {
          type: "enabled",
          budget_tokens: 8000,
        },
        system: buildSystemPrompt(accountContext),
        tools: [TOOL_DEFINITION],
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: userMessageParts.join("\n") }],
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

    // Extract the tool use input from the response
    const toolUse = result.content?.find(
      (block: { type: string }) => block.type === "tool_use",
    )

    if (!toolUse?.input) {
      return new Response(
        JSON.stringify({
          error: "No proposal generated",
          raw: result.content,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      )
    }

    const proposalDraft = toolUse.input

    // Generate hero image — try Gemini first, fall back to Unsplash
    if (proposalId) {
      let heroImageUrl: string | undefined

      // Try AI generation if we have enough context
      if (proposalDraft.brief || proposalDraft.tagline) {
        heroImageUrl = await generateHeroWithGemini(
          {
            tagline: proposalDraft.tagline,
            clientName: proposalDraft.clientName || clientName,
            brief: proposalDraft.brief,
          },
          proposalId,
        )
      }

      // Fall back to Unsplash
      if (!heroImageUrl) {
        const searchQuery = [
          proposalDraft.clientName || clientName,
          proposalDraft.tagline,
        ].filter(Boolean).join(" ")
        heroImageUrl = await searchUnsplashImage(searchQuery)
      }

      if (heroImageUrl) {
        proposalDraft.heroImageUrl = heroImageUrl
      }
    }

    return new Response(JSON.stringify(proposalDraft), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
