/**
 * /api/mcp — Proposl MCP server v1 (INT-26)
 *
 * Remote MCP over streamable HTTP, stateless (a fresh server+transport per
 * POST; no sessions, no SSE stream). Lets Claude read and write proposals
 * through tools instead of driving the builder UI.
 *
 * Auth: per-user API token from Account settings, sent as a bearer header.
 * Only the SHA-256 hash is stored (api_tokens table); the server resolves
 * the hash to an account and scopes every query to it.
 *
 * Client setup:
 *   claude mcp add --transport http proposl https://proposl.app/api/mcp \
 *     --header "Authorization: Bearer <token>"
 *
 * Deliberately NOT exposed: send_proposal. Sending is outward-facing and
 * stays a human action in the UI.
 *
 * Runs on the Vercel Node runtime (the MCP SDK needs Node APIs, unlike the
 * edge-based /api/chat). In local dev the vite middleware (INT-25) passes
 * raw req/res straight through.
 */

import { createHash, randomUUID } from "node:crypto"
import type { IncomingMessage, ServerResponse } from "node:http"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { z } from "zod"
// Pure TS module shared with the builder's Import dialog — same parser,
// same verbatim semantics. (Its only non-runtime import is a type-only
// "@/types/proposal", which compiles away.)
import { parseImportDoc, applyImportToProposal } from "../src/lib/proposalImport"
import type { ProposalData } from "../src/types/proposal"

// ---------------------------------------------------------------------------
// Supabase (service role) + auth

function serviceClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  return createClient(url!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
}

interface TokenContext {
  accountId: string
  userId: string
  tokenId: string
}

async function resolveToken(req: IncomingMessage): Promise<TokenContext | null> {
  const raw = req.headers["authorization"]
  const header = Array.isArray(raw) ? raw[0] : raw
  if (!header?.startsWith("Bearer ")) return null
  const token = header.slice(7).trim()
  if (!token.startsWith("ppk_") || token.length < 20) return null

  const hash = createHash("sha256").update(token).digest("hex")
  const supa = serviceClient()
  const { data } = await supa
    .from("api_tokens")
    .select("id, account_id, user_id")
    .eq("token_hash", hash)
    .is("revoked_at", null)
    .maybeSingle()
  if (!data) return null

  // Fire-and-forget usage stamp; never block the request on it.
  void supa
    .from("api_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {})

  return { accountId: data.account_id, userId: data.user_id, tokenId: data.id }
}

// ---------------------------------------------------------------------------
// Proposal helpers

const APP_ORIGIN = "https://www.proposl.app"

type ProposalRow = {
  id: string
  slug: string
  title: string
  client_name: string
  status: string | null
  updated_at: string
  data: Record<string, unknown>
}

async function fetchProposal(
  supa: SupabaseClient,
  accountId: string,
  proposalId: string,
): Promise<ProposalRow | null> {
  const { data } = await supa
    .from("proposals")
    .select("id, slug, title, client_name, status, updated_at, data")
    .eq("id", proposalId)
    .eq("account_id", accountId)
    .is("deleted_at", null)
    .maybeSingle()
  return (data as ProposalRow | null) ?? null
}

/** Merge row + data jsonb the same way the app does on load. */
function mergedProposal(row: ProposalRow): ProposalData {
  return { ...(row as unknown as Record<string, unknown>), ...(row.data ?? {}) } as unknown as ProposalData
}

/** Persist a proposal data object, mirroring the builder's auto-save shape. */
async function saveProposal(
  supa: SupabaseClient,
  accountId: string,
  proposalId: string,
  data: ProposalData,
): Promise<string | null> {
  const { error } = await supa
    .from("proposals")
    .update({
      title: data.title || "Untitled",
      client_name: data.clientName || "Unknown",
      sections: data.sections,
      data,
      updated_at: new Date().toISOString(),
    })
    .eq("id", proposalId)
    .eq("account_id", accountId)
  return error ? error.message : null
}

/** Mirrors builderStore DEFAULT_PROPOSAL for server-side creation. */
function defaultProposalData(
  id: string,
  title: string,
  clientName: string,
  account: Record<string, unknown> | null,
): ProposalData {
  const defaultSteps = (account?.default_cta_steps as string[] | null) ?? null
  return {
    id,
    slug: id,
    title,
    clientName,
    brandColor1: (account?.default_brand_color_1 as string) ?? "#000000",
    brandColor2: (account?.default_brand_color_2 as string) ?? "#6b7280",
    tagline: "",
    heroDescription: "",
    ctaEmail: (account?.default_cta_email as string) ?? "",
    recommendation: "",
    studioName: (account?.studio_name as string) ?? "",
    studioLogoUrl: (account?.logo_url as string) ?? undefined,
    sections: ["summary", "scope", "timeline", "investment", "cta"],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    summary: {
      studioTagline: (account?.default_studio_tagline as string) ?? "",
      studioDescription: (account?.default_studio_description as string) ?? "",
      studioDescription2: (account?.default_studio_description_2 as string) ?? "",
      projectOverview: "",
      projectDetail: "",
      pillarsTagline: "",
      pillars: [],
    },
    scope: { outcomes: [], responsibilities: [] },
    timeline: { subtitle: "", phases: [] },
    investment: { packages: [], addOnCategories: [], addOns: [] },
    cta: {
      steps: defaultSteps?.length
        ? [...defaultSteps]
        : [
            "Confirm package selection and any add-ons",
            "Review and sign the Master Services Agreement",
            "Schedule kickoff to align on workflows, timelines, and responsibilities",
          ],
    },
    customSections: [],
  } as ProposalData
}

/** Minimal structural check for set_investment; deliberately permissive so
 * extra fields pass through untouched. */
function validateInvestment(inv: unknown): string | null {
  if (typeof inv !== "object" || inv === null) return "investment must be an object"
  const o = inv as Record<string, unknown>
  if (!Array.isArray(o.packages)) return "investment.packages must be an array"
  for (const p of o.packages) {
    const pkg = p as Record<string, unknown>
    if (typeof pkg.id !== "string" || typeof pkg.label !== "string" || typeof pkg.basePrice !== "number") {
      return "each package needs id (string), label (string), basePrice (number)"
    }
  }
  if (o.addOns !== undefined && !Array.isArray(o.addOns)) return "investment.addOns must be an array"
  if (o.addOnCategories !== undefined && !Array.isArray(o.addOnCategories)) return "investment.addOnCategories must be an array"
  return null
}

// ---------------------------------------------------------------------------
// Tool surface

function text(value: unknown) {
  return { content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }] }
}

function err(message: string) {
  return { content: [{ type: "text" as const, text: `Error: ${message}` }], isError: true }
}

function buildServer(ctx: TokenContext): McpServer {
  const supa = serviceClient()
  const server = new McpServer({ name: "proposl", version: "1.0.0" })

  server.registerTool(
    "list_proposals",
    {
      description: "List the workspace's proposals: id, title, client, status, updated_at, slug.",
      inputSchema: {},
    },
    async () => {
      const { data, error } = await supa
        .from("proposals")
        .select("id, title, client_name, status, updated_at, slug")
        .eq("account_id", ctx.accountId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
      if (error) return err(error.message)
      return text(data)
    },
  )

  server.registerTool(
    "get_proposal",
    {
      description: "Fetch one proposal's full content (sections, custom sections, investment config, next steps) as JSON.",
      inputSchema: { proposalId: z.string().describe("Proposal id (uuid)") },
    },
    async ({ proposalId }) => {
      const row = await fetchProposal(supa, ctx.accountId, proposalId)
      if (!row) return err("Proposal not found in this workspace")
      return text(mergedProposal(row))
    },
  )

  server.registerTool(
    "create_proposal",
    {
      description: "Create a draft proposal seeded with the workspace defaults. Returns the new proposal's id and builder URL.",
      inputSchema: {
        title: z.string().describe("Admin/email title, e.g. 'Jan & Jul: Wholesale build'"),
        clientName: z.string().describe("Client display name"),
      },
    },
    async ({ title, clientName }) => {
      const { data: account } = await supa.from("accounts").select("*").eq("id", ctx.accountId).maybeSingle()
      const id = randomUUID()
      const data = defaultProposalData(id, title, clientName, account)
      // Mirrors the builder's auto-save column shape; cta_email and the
      // brand colors are NOT NULL in the proposals table.
      const { error } = await supa.from("proposals").insert({
        id,
        account_id: ctx.accountId,
        user_id: ctx.userId,
        slug: id,
        title,
        client_name: clientName,
        brand_color_1: data.brandColor1,
        brand_color_2: data.brandColor2,
        cta_email: data.ctaEmail ?? "",
        status: "draft",
        sections: data.sections,
        data,
      })
      if (error) return err(error.message)
      return text({ id, builderUrl: `${APP_ORIGIN}/builder/${id}` })
    },
  )

  server.registerTool(
    "set_section_content",
    {
      description:
        "Write one section verbatim, no AI in the loop. Reserved section names 'Tagline', 'Hero description', and 'Next steps' fill those fields; any other name creates or replaces a custom section with that title. Content lands byte for byte.",
      inputSchema: {
        proposalId: z.string(),
        section: z.string().describe("Section name, e.g. 'Tagline' or 'Warranty and support'"),
        content: z.string().describe("Verbatim body text (plain text, newlines preserved)"),
      },
    },
    async ({ proposalId, section, content }) => {
      const row = await fetchProposal(supa, ctx.accountId, proposalId)
      if (!row) return err("Proposal not found in this workspace")
      const proposal = mergedProposal(row)
      const parsed = parseImportDoc(`## SECTION: ${section}\n${content}`, proposal.customSections)
      const next = applyImportToProposal(proposal, parsed.sections)
      const saveError = await saveProposal(supa, ctx.accountId, proposalId, next)
      if (saveError) return err(saveError)
      return text({ ok: true, section, target: parsed.sections[0]?.target, chars: content.length })
    },
  )

  server.registerTool(
    "import_document",
    {
      description:
        "Import a whole markdown document verbatim (same engine as set_section_content, one call for many sections). Split with '## SECTION: <name>' headings. Reserved names Tagline / Hero description / Next steps fill typed fields; other headings become custom sections. Re-imported headings replace matching sections instead of duplicating.",
      inputSchema: {
        proposalId: z.string(),
        markdown: z.string().describe("The full document, any length"),
      },
    },
    async ({ proposalId, markdown }) => {
      const row = await fetchProposal(supa, ctx.accountId, proposalId)
      if (!row) return err("Proposal not found in this workspace")
      const proposal = mergedProposal(row)
      const parsed = parseImportDoc(markdown, proposal.customSections)
      if (parsed.sections.length === 0) return err("No '## SECTION:' headings found in the document")
      const next = applyImportToProposal(proposal, parsed.sections)
      const saveError = await saveProposal(supa, ctx.accountId, proposalId, next)
      if (saveError) return err(saveError)
      return text({
        ok: true,
        imported: parsed.sections.map((s) => ({ heading: s.heading, target: s.target, chars: s.body.length })),
      })
    },
  )

  server.registerTool(
    "set_investment",
    {
      description:
        "Replace the proposal's investment config: packages (with optional validUntil/priceLockNote), addOnCategories, addOns (negative price + note = credit line), optional retainer/postLaunch. Optionally set the ISO currency code.",
      inputSchema: {
        proposalId: z.string(),
        investment: z.record(z.string(), z.unknown()).describe("The full investment object (packages, addOnCategories, addOns, retainer?, postLaunch?)"),
        currency: z.string().optional().describe("ISO 4217 code like 'CAD'"),
      },
    },
    async ({ proposalId, investment, currency }) => {
      const invalid = validateInvestment(investment)
      if (invalid) return err(invalid)
      const row = await fetchProposal(supa, ctx.accountId, proposalId)
      if (!row) return err("Proposal not found in this workspace")
      const proposal = mergedProposal(row)
      const next = {
        ...proposal,
        investment: investment as ProposalData["investment"],
        ...(currency ? { currency: currency.toUpperCase() } : {}),
      }
      const saveError = await saveProposal(supa, ctx.accountId, proposalId, next)
      if (saveError) return err(saveError)
      return text({ ok: true, packages: (investment as { packages: unknown[] }).packages.length })
    },
  )

  server.registerTool(
    "set_next_steps",
    {
      description: "Replace the numbered Next Steps list at the end of the proposal (2-5 short imperative lines).",
      inputSchema: {
        proposalId: z.string(),
        steps: z.array(z.string()).min(1).describe("The steps, in order"),
      },
    },
    async ({ proposalId, steps }) => {
      const row = await fetchProposal(supa, ctx.accountId, proposalId)
      if (!row) return err("Proposal not found in this workspace")
      const proposal = mergedProposal(row)
      const next = { ...proposal, cta: { steps } }
      const saveError = await saveProposal(supa, ctx.accountId, proposalId, next)
      if (saveError) return err(saveError)
      return text({ ok: true, steps })
    },
  )

  server.registerTool(
    "add_context_source",
    {
      description: "Attach a text context source (brief, transcript, notes) the builder AI reads on every turn.",
      inputSchema: {
        proposalId: z.string(),
        name: z.string().describe("Short source name"),
        content: z.string().describe("The full text, no length ceiling"),
      },
    },
    async ({ proposalId, name, content }) => {
      const row = await fetchProposal(supa, ctx.accountId, proposalId)
      if (!row) return err("Proposal not found in this workspace")
      const { error } = await supa.from("proposal_context").insert({
        proposal_id: proposalId,
        source_type: "paste",
        name,
        extracted_text: content,
        // Legacy columns, still NOT NULL until the 20260705 migration runs
        // everywhere (see INT-15).
        label: name,
        content,
      })
      if (error) return err(error.message)
      return text({ ok: true, name, chars: content.length })
    },
  )

  server.registerTool(
    "get_preview_url",
    {
      description: "Get the shareable client-view URL and the builder URL for a proposal.",
      inputSchema: { proposalId: z.string() },
    },
    async ({ proposalId }) => {
      const row = await fetchProposal(supa, ctx.accountId, proposalId)
      if (!row) return err("Proposal not found in this workspace")
      return text({
        previewUrl: `${APP_ORIGIN}/p/${row.slug}`,
        builderUrl: `${APP_ORIGIN}/builder/${row.id}`,
      })
    },
  )

  return server
}

// ---------------------------------------------------------------------------
// HTTP handler (Vercel Node runtime; also mounted by the vite dev middleware)

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  if (req.method !== "POST") {
    // Stateless server: no SSE stream to GET, no session to DELETE.
    res.statusCode = 405
    res.setHeader("Content-Type", "application/json")
    res.setHeader("Allow", "POST")
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed" }, id: null }))
    return
  }

  const ctx = await resolveToken(req)
  if (!ctx) {
    res.statusCode = 401
    res.setHeader("Content-Type", "application/json")
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message: "Unauthorized: pass a valid API token as 'Authorization: Bearer ppk_...' (create one in Proposl account settings)" }, id: null }))
    return
  }

  try {
    const server = buildServer(ctx)
    const transport = new StreamableHTTPServerTransport({
      // Stateless: no session ids, plain JSON responses (no SSE).
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    })
    res.on("close", () => {
      void transport.close()
      void server.close()
    })
    await server.connect(transport)
    // Vercel pre-parses the body onto req.body; in dev the stream is unread
    // and the transport parses it itself.
    await transport.handleRequest(req, res, req.body)
  } catch (e) {
    console.error("mcp handler error:", e)
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32603, message: "Internal server error" }, id: null }))
    }
  }
}
