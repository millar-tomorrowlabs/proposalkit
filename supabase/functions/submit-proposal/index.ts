/**
 * submit-proposal: the public endpoint behind the proposal CTA form.
 *
 * POST {
 *   proposalId, proposalSlug, clientName, clientEmail, message?,
 *   confirmed: boolean,
 *   selection: { packageId, addOnIds[], retainerHours?, postLaunchSelected? } | null
 * }
 *
 * The caller sends identity and choice, nothing else. Every price, label,
 * colour, title and address in the emails is read back from the proposals row
 * and the owning account, so nothing a caller types can decide where mail goes
 * or what a package costs (INT-28). Older browser bundles still POST the legacy
 * shape with labels, prices and ctaEmail in it. Those requests are accepted and
 * every priced or addressed field in them is dropped.
 *
 * The submission row is always written, even when both emails fail, and the
 * response reports the two sends separately so the caller can tell a captured
 * lead from a delivered one (INT-31).
 *
 * Deploy: supabase functions deploy submit-proposal --no-verify-jwt \
 *   --project-ref nkygheptubvogevezpap
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient, SupabaseClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

const SENDER_DOMAIN = "proposl.app"

// Abuse controls. The proposal page is public so this function ships with
// --no-verify-jwt, which makes these caps the only thing standing between the
// endpoint and an open relay for DKIM signed mail (INT-28).
const MAX_BODY_BYTES = 16_000
const MAX_NAME_LENGTH = 200
const MAX_EMAIL_LENGTH = 254
const MAX_MESSAGE_LENGTH = 4_000
const MAX_ADD_ON_IDS = 40
const PROPOSAL_WINDOW_MINUTES = 10
const MAX_PER_PROPOSAL_PER_WINDOW = 5
const EMAIL_WINDOW_MINUTES = 60
const MAX_PER_EMAIL_PER_WINDOW = 20

const DEFAULT_ACCENT = "#111"
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ─────────────────────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────────────────────

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

/** Every value that lands in an email template goes through this first. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Brand colours are injected into style attributes, where escaping is not
 * enough. Anything that is not a plain hex value falls back to the default.
 */
function safeColor(value: unknown, fallback = DEFAULT_ACCENT): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback
}

/** Intl throws on a bad currency code, so only pass it a real one. */
function safeCurrency(value: unknown): string {
  const code = typeof value === "string" ? value.trim().toUpperCase() : ""
  return /^[A-Z]{3}$/.test(code) ? code : "USD"
}

/** Keeps stray newlines out of the From name and the subject line. */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim()
}

function formatPrice(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount)
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function asNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : fallback
}

// ─────────────────────────────────────────────────────────────────────────────
// Request parsing
// ─────────────────────────────────────────────────────────────────────────────

interface SelectionInput {
  packageId: string
  addOnIds: string[]
  retainerHours?: number
  postLaunchSelected: boolean
}

interface ParsedRequest {
  proposalId: string
  proposalSlug: string
  clientName: string
  clientEmail: string
  message: string | null
  confirmed: boolean
  selection: SelectionInput | null
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string }

function parseRequest(raw: unknown): Result<ParsedRequest> {
  const body = asRecord(raw)
  if (!body) return { ok: false, error: "Body must be a JSON object" }

  const proposalId = asText(body.proposalId).trim()
  const proposalSlug = asText(body.proposalSlug).trim()
  const clientName = asText(body.clientName).trim()
  const clientEmail = asText(body.clientEmail).trim().toLowerCase()

  if (!proposalId || !proposalSlug || !clientName || !clientEmail) {
    return {
      ok: false,
      error: "Missing required fields: proposalId, proposalSlug, clientName, clientEmail",
    }
  }
  if (clientName.length > MAX_NAME_LENGTH) {
    return { ok: false, error: "Name is too long" }
  }
  if (clientEmail.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(clientEmail)) {
    return { ok: false, error: "Please enter a valid email" }
  }

  const rawMessage = asText(body.message).trim()
  if (rawMessage.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: "Message is too long" }
  }
  const message = rawMessage.length > 0 ? rawMessage : null

  let confirmed = body.confirmed === true
  let selection: SelectionInput | null = null

  const selectionRec = asRecord(body.selection)
  if (selectionRec) {
    const packageId = asText(selectionRec.packageId).trim()
    if (!packageId) return { ok: false, error: "selection.packageId is required" }

    const addOnIds = uniqueIds(asArray(selectionRec.addOnIds))
    if (addOnIds.length > MAX_ADD_ON_IDS) {
      return { ok: false, error: "Too many add-ons selected" }
    }

    const retainerHours =
      selectionRec.retainerHours === undefined || selectionRec.retainerHours === null
        ? undefined
        : asNumber(selectionRec.retainerHours, NaN)
    if (retainerHours !== undefined && !Number.isFinite(retainerHours)) {
      return { ok: false, error: "selection.retainerHours must be a number" }
    }

    selection = {
      packageId,
      addOnIds,
      retainerHours,
      postLaunchSelected: selectionRec.postLaunchSelected === true,
    }
  } else if (asText(body.packageId).trim()) {
    // Legacy body from a cached bundle. Only the ids survive the trip, the
    // labels, prices, totals and ctaEmail that came with them are ignored and
    // recomputed below. A legacy body only ever carried a packageLabel when
    // the client had pressed Confirm selection, so that stands in for the
    // confirmed flag the old bundle does not send.
    const legacyAddOnIds = uniqueIds(
      asArray(body.addOns).map((entry) => asRecord(entry)?.id),
    )
    const legacyHours =
      body.retainerHours === undefined || body.retainerHours === null
        ? undefined
        : asNumber(body.retainerHours, NaN)

    selection = {
      packageId: asText(body.packageId).trim(),
      addOnIds: legacyAddOnIds.slice(0, MAX_ADD_ON_IDS),
      retainerHours: Number.isFinite(legacyHours) ? legacyHours : undefined,
      postLaunchSelected: false,
    }
    if (asText(body.packageLabel).trim()) confirmed = true
  }

  return {
    ok: true,
    value: { proposalId, proposalSlug, clientName, clientEmail, message, confirmed, selection },
  }
}

function uniqueIds(values: unknown[]): string[] {
  const seen = new Set<string>()
  for (const value of values) {
    const id = asText(value).trim()
    if (id) seen.add(id)
  }
  return Array.from(seen)
}

/**
 * Reads the body a chunk at a time and gives up the moment it goes past the
 * cap, so a chunked POST that declares no content-length cannot stream an
 * arbitrary amount into the isolate before anything checks it. Returns null
 * when the body is over the cap. Counting bytes rather than string length
 * matters too: a string counts UTF-16 units, so astral characters would slip
 * roughly four times the cap past a length check.
 */
async function readBodyCapped(req: Request, maxBytes: number): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array()

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > maxBytes) {
        await reader.cancel()
        return null
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

// ─────────────────────────────────────────────────────────────────────────────
// Investment config, read straight off the proposal row
// ─────────────────────────────────────────────────────────────────────────────

interface PackageConfig {
  id: string
  label: string
  basePrice: number
}

interface AddOnConfig {
  id: string
  label: string
  packages: Record<string, { price: number | null; included: boolean }>
}

interface RetainerConfig {
  hourlyRate: number
  minHours: number
  maxHours: number
}

interface PostLaunchConfig {
  monthlyPrice: number
}

interface InvestmentConfig {
  packages: PackageConfig[]
  addOns: AddOnConfig[]
  retainer: RetainerConfig | null
  postLaunch: PostLaunchConfig | null
}

function readInvestment(data: unknown): InvestmentConfig {
  const investment = asRecord(asRecord(data)?.investment)

  const packages: PackageConfig[] = asArray(investment?.packages)
    .map((entry) => asRecord(entry))
    .filter((rec): rec is Record<string, unknown> => rec !== null)
    .map((rec) => ({
      id: asText(rec.id),
      label: asText(rec.label),
      basePrice: asNumber(rec.basePrice),
    }))
    .filter((pkg) => pkg.id !== "")

  const addOns: AddOnConfig[] = asArray(investment?.addOns)
    .map((entry) => asRecord(entry))
    .filter((rec): rec is Record<string, unknown> => rec !== null)
    .map((rec) => {
      const perPackage: AddOnConfig["packages"] = {}
      for (const [packageId, value] of Object.entries(asRecord(rec.packages) ?? {})) {
        const cfg = asRecord(value)
        const price = cfg?.price
        perPackage[packageId] = {
          price: price === undefined || price === null ? null : asNumber(price),
          included: cfg?.included === true,
        }
      }
      return { id: asText(rec.id), label: asText(rec.label), packages: perPackage }
    })
    .filter((addOn) => addOn.id !== "")

  const retainerRec = asRecord(investment?.retainer)
  const retainer: RetainerConfig | null = retainerRec
    ? {
        hourlyRate: asNumber(retainerRec.hourlyRate),
        minHours: asNumber(retainerRec.minHours),
        maxHours: asNumber(retainerRec.maxHours),
      }
    : null

  const postLaunchRec = asRecord(investment?.postLaunch)
  const postLaunch: PostLaunchConfig | null = postLaunchRec
    ? { monthlyPrice: asNumber(postLaunchRec.monthlyPrice) }
    : null

  return { packages, addOns, retainer, postLaunch }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server side pricing
// ─────────────────────────────────────────────────────────────────────────────

interface PricedAddOn {
  id: string
  label: string
  price: number
}

interface PricedSelection {
  packageId: string
  packageLabel: string
  packagePrice: number
  addOns: PricedAddOn[]
  retainerHours: number | null
  retainerRate: number | null
  postLaunchSelected: boolean
  postLaunchMonthlyPrice: number | null
  grandTotal: number
  clamped: boolean
}

/**
 * Rebuilds the selection from the proposal's own investment config. Nothing
 * priced in the request body is read, so a caller cannot invent a package,
 * an add-on or a total.
 */
function priceSelection(input: SelectionInput, investment: InvestmentConfig): Result<PricedSelection> {
  const pkg = investment.packages.find((p) => p.id === input.packageId)
  if (!pkg) return { ok: false, error: "Unknown package selected" }

  const addOns: PricedAddOn[] = []
  for (const id of input.addOnIds) {
    const addOn = investment.addOns.find((a) => a.id === id)
    if (!addOn) return { ok: false, error: "Unknown add-on selected" }
    // Same rule the proposal page renders with: an add-on only exists on a
    // package that puts a price on it or marks it included. Anything else was
    // never on offer with this package, so accepting it would write scope the
    // proposal never quoted into the submission row and both emails.
    const offer = addOn.packages[pkg.id]
    if (!offer || (offer.price === null && !offer.included)) {
      return { ok: false, error: "That add-on is not available with the selected package" }
    }
    addOns.push({ id: addOn.id, label: addOn.label, price: offer.price ?? 0 })
  }

  let retainerHours: number | null = null
  let retainerRate: number | null = null
  let clamped = false
  if (investment.retainer && input.retainerHours !== undefined) {
    const { minHours, maxHours, hourlyRate } = investment.retainer
    const requested = Math.round(input.retainerHours)
    const upper = Math.max(minHours, maxHours)
    const bounded = Math.min(Math.max(requested, minHours), upper)
    clamped = bounded !== requested
    retainerHours = bounded
    retainerRate = hourlyRate
  }

  const postLaunch = investment.postLaunch
  const postLaunchSelected = input.postLaunchSelected && postLaunch !== null
  const grandTotal = pkg.basePrice + addOns.reduce((sum, addOn) => sum + addOn.price, 0)

  return {
    ok: true,
    value: {
      packageId: pkg.id,
      packageLabel: pkg.label,
      packagePrice: pkg.basePrice,
      addOns,
      retainerHours,
      retainerRate,
      postLaunchSelected,
      postLaunchMonthlyPrice: postLaunchSelected && postLaunch ? postLaunch.monthlyPrice : null,
      grandTotal,
      clamped,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email templates
// ─────────────────────────────────────────────────────────────────────────────

/**
 * confirmed:    the client pressed Confirm selection.
 * viewing:      a selection came through but it was never confirmed. The
 *               current bundle blocks submitting a proposal with packages
 *               until the client confirms, so this covers cached legacy
 *               bundles and anything posting to the endpoint directly.
 * none_chosen:  the proposal has packages, the client picked nothing.
 * no_packages:  the proposal has no packages at all, so there was nothing to pick.
 */
type SelectionState = "confirmed" | "viewing" | "none_chosen" | "no_packages"

interface EmailContext {
  studioName: string
  website: string
  proposalTitle: string
  clientName: string
  clientEmail: string
  message: string | null
  accent: string
  accent2: string
  currency: string
  state: SelectionState
  selection: PricedSelection | null
}

function buildSelectionTableHtml(ctx: EmailContext, selection: PricedSelection): string {
  const fp = (n: number) => formatPrice(n, ctx.currency)

  let html = `
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="border-bottom:1px solid #e5e5e5">
        <td style="padding:8px 0;color:#333">${escapeHtml(selection.packageLabel)} package</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#111">${fp(selection.packagePrice)}</td>
      </tr>`

  for (const addOn of selection.addOns) {
    html += `
      <tr style="border-bottom:1px solid #e5e5e5">
        <td style="padding:8px 0;color:#666">+ ${escapeHtml(addOn.label)}</td>
        <td style="padding:8px 0;text-align:right;color:#333">${fp(addOn.price)}</td>
      </tr>`
  }

  html += `
      <tr>
        <td style="padding:12px 0 8px;font-weight:600;color:#111">Project Total</td>
        <td style="padding:12px 0 8px;text-align:right;font-weight:700;font-size:18px;color:${ctx.accent}">${fp(selection.grandTotal)}</td>
      </tr>
    </table>`

  if (selection.retainerHours && selection.retainerRate) {
    html += `<p style="margin:0 0 8px;color:#666;font-size:14px">+ ${selection.retainerHours} hrs/mo retainer (${fp(selection.retainerHours * selection.retainerRate)}/mo)</p>`
  }

  if (selection.postLaunchSelected && selection.postLaunchMonthlyPrice) {
    html += `<p style="margin:0 0 8px;color:#666;font-size:14px">+ Post launch support (${fp(selection.postLaunchMonthlyPrice)}/mo)</p>`
  }

  return html
}

/**
 * The team block has to read differently in every state, because a confirmed
 * total and a total the client was only looking at are not the same news.
 */
function buildTeamSelectionBlockHtml(ctx: EmailContext): string {
  const label = (text: string) =>
    `<p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#999">${text}</p>`
  const note = (text: string) =>
    `<p style="margin:0;color:#666;font-size:14px;line-height:1.5">${text}</p>`

  if (ctx.selection && ctx.state === "confirmed") {
    return label("Confirmed selection") + buildSelectionTableHtml(ctx, ctx.selection)
  }

  if (ctx.selection && ctx.state === "viewing") {
    return (
      label("Viewing (not confirmed)") +
      note(
        "This is what the client had on screen when they submitted. They did not press Confirm selection, so read it as interest rather than agreement.",
      ) +
      buildSelectionTableHtml(ctx, ctx.selection)
    )
  }

  if (ctx.state === "no_packages") {
    return (
      label("Selection") +
      note("This proposal has no packages configured, so there was nothing for the client to select.")
    )
  }

  return label("Selection") + note("The client submitted without choosing a package.")
}

function buildTeamEmailHtml(ctx: EmailContext): string {
  const studio = escapeHtml(ctx.studioName)
  const messageHtml = ctx.message
    ? `<div style="margin-top:20px;padding:16px;background:#f9f9f9;border-radius:8px"><p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#999">Message</p><p style="margin:0;color:#333;white-space:pre-line">${escapeHtml(ctx.message)}</p></div>`
    : ""

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#111;padding:20px 24px;border-radius:12px 12px 0 0">
      <p style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:14px;font-weight:500;letter-spacing:-0.01em;color:rgba(255,255,255,0.5)">${studio}</p>
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600">New Proposal Submission</h1>
      <p style="margin:4px 0 0;color:#aaa;font-size:14px">${escapeHtml(ctx.proposalTitle)}</p>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,${ctx.accent},${ctx.accent2})"></div>
    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e5e5;border-top:none">
      <table style="width:100%;margin-bottom:20px">
        <tr>
          <td style="padding:4px 0;font-size:14px;color:#666">Name</td>
          <td style="padding:4px 0;font-size:14px;font-weight:600;color:#111;text-align:right">${escapeHtml(ctx.clientName)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:14px;color:#666">Email</td>
          <td style="padding:4px 0;font-size:14px;color:#111;text-align:right"><a href="mailto:${escapeHtml(ctx.clientEmail)}" style="color:${ctx.accent}">${escapeHtml(ctx.clientEmail)}</a></td>
        </tr>
      </table>
      <div style="border-top:2px solid #111;padding-top:16px">
        ${buildTeamSelectionBlockHtml(ctx)}
      </div>
      ${messageHtml}
    </div>
    <p style="text-align:center;margin-top:20px;font-size:12px;color:#aaa">${studio}</p>
  </div>
</body>
</html>`
}

function buildClientEmailHtml(ctx: EmailContext): string {
  const studio = escapeHtml(ctx.studioName)
  const firstName = escapeHtml(ctx.clientName.split(" ")[0] ?? ctx.clientName)
  // The client only ever sees a selection they confirmed. Showing them a
  // half made choice, or an empty block, reads as a quote they never gave.
  const selectionHtml =
    ctx.selection && ctx.state === "confirmed" ? buildSelectionTableHtml(ctx, ctx.selection) : ""

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#111;padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:500;letter-spacing:-0.01em;color:#fff">${studio}</h1>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,${ctx.accent},${ctx.accent2})"></div>
    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e5e5;border-top:none">
      <p style="margin:0 0 16px;font-size:16px;color:#111">Thanks ${firstName},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#333;line-height:1.6">We've received your submission for <strong>${escapeHtml(ctx.proposalTitle)}</strong>. Our team will review and follow up shortly with next steps.</p>
      ${selectionHtml ? `
      <div style="border-top:2px solid ${ctx.accent};padding-top:16px;margin-top:8px">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#999">Your selection</p>
        ${selectionHtml}
      </div>` : ""}
      <p style="margin:24px 0 0;font-size:14px;color:#333;line-height:1.6">If you have any questions in the meantime, just reply to this email.</p>
    </div>
    <p style="text-align:center;margin-top:20px;font-size:12px;color:#aaa">${studio} · ${escapeHtml(ctx.website)}</p>
  </div>
</body>
</html>`
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiting and delivery
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Counts recent submissions on one key. A failed count returns null and the
 * caller lets the request through: a broken lookup must not swallow a real
 * lead.
 */
async function countRecent(
  supabase: SupabaseClient,
  column: "proposal_id" | "client_email",
  value: string,
  minutes: number,
): Promise<number | null> {
  const since = new Date(Date.now() - minutes * 60_000).toISOString()
  const { count, error } = await supabase
    .from("submissions")
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .gte("created_at", since)

  if (error) {
    console.error("submit-proposal rate lookup failed:", error)
    return null
  }
  return count ?? 0
}

async function sendViaResend(
  apiKey: string,
  payload: Record<string, unknown>,
  label: string,
): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      console.error(`submit-proposal ${label} email failed:`, res.status, detail)
      return false
    }
    return true
  } catch (e) {
    console.error(`submit-proposal ${label} email threw:`, e)
    return false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" })
  }

  try {
    // The header is a free reject when it is there and honest. It is only a
    // claim though, and a chunked request carries no header at all, so the
    // read below is what actually holds the line.
    const declaredLength = Number(req.headers.get("content-length") ?? "0")
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return json(413, { error: "Request body is too large" })
    }

    const bodyBytes = await readBodyCapped(req, MAX_BODY_BYTES)
    if (bodyBytes === null) {
      return json(413, { error: "Request body is too large" })
    }
    const rawBody = new TextDecoder().decode(bodyBytes)

    let payload: unknown
    try {
      payload = JSON.parse(rawBody)
    } catch {
      return json(400, { error: "Body must be valid JSON" })
    }

    // Shape and length checks run first because they are free and they are
    // what tells us which proposal to look up.
    const parsed = parseRequest(payload)
    if (!parsed.ok) {
      return json(400, { error: parsed.error })
    }
    const input = parsed.value

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // The proposal row is the source of truth for everything that follows:
    // where mail goes, what the brand looks like, and what anything costs.
    const { data: proposalRow, error: proposalError } = await supabase
      .from("proposals")
      .select(
        "id, slug, title, cta_email, brand_color_1, brand_color_2, data, account_id, user_id, deleted_at",
      )
      .eq("id", input.proposalId)
      .maybeSingle()

    if (proposalError) {
      console.error("submit-proposal proposal lookup failed:", proposalError)
      return json(500, { error: "Could not load the proposal" })
    }
    if (!proposalRow || proposalRow.deleted_at !== null) {
      return json(410, { error: "This proposal is no longer accepting submissions" })
    }
    if (proposalRow.slug !== input.proposalSlug) {
      return json(400, { error: "Proposal slug does not match this proposal" })
    }

    const { data: accountRow } = proposalRow.account_id
      ? await supabase
          .from("accounts")
          .select("studio_name, website, notify_email, cc_email, sender_name, default_currency")
          .eq("id", proposalRow.account_id)
          .maybeSingle()
      : { data: null }

    // Rate limits. Deno Deploy hands us the caller IP in x-forwarded-for, but
    // submissions has no column to persist it in, so there is nothing to count
    // against on the next request. TODO(INT-28): add an ip_hash column plus an
    // index on (ip_hash, created_at) and turn this into a real per-IP limit.
    // Until then the per-email window is the closest stateless substitute and
    // the IP is logged only. The email window matches on the lowercased
    // address we now store, so it only counts rows written by this version.
    const clientIp = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim()

    const proposalCount = await countRecent(
      supabase,
      "proposal_id",
      proposalRow.id,
      PROPOSAL_WINDOW_MINUTES,
    )
    if (proposalCount !== null && proposalCount >= MAX_PER_PROPOSAL_PER_WINDOW) {
      console.warn("submit-proposal proposal rate limit hit:", proposalRow.id, clientIp)
      return json(429, { error: "Too many submissions for this proposal. Please try again shortly." })
    }

    const emailCount = await countRecent(
      supabase,
      "client_email",
      input.clientEmail,
      EMAIL_WINDOW_MINUTES,
    )
    if (emailCount !== null && emailCount >= MAX_PER_EMAIL_PER_WINDOW) {
      console.warn("submit-proposal email rate limit hit:", input.clientEmail, clientIp)
      return json(429, { error: "Too many submissions from this address. Please try again later." })
    }

    // Price the selection off the proposal's own config.
    const investment = readInvestment(proposalRow.data)
    let selection: PricedSelection | null = null
    if (input.selection) {
      const priced = priceSelection(input.selection, investment)
      if (!priced.ok) {
        return json(400, { error: priced.error })
      }
      selection = priced.value
      if (selection.clamped) {
        console.warn(
          "submit-proposal clamped retainer hours:",
          proposalRow.id,
          input.selection.retainerHours,
          "to",
          selection.retainerHours,
        )
      }
    }

    const state: SelectionState = selection
      ? input.confirmed
        ? "confirmed"
        : "viewing"
      : investment.packages.length === 0
        ? "no_packages"
        : "none_chosen"

    const proposalData = asRecord(proposalRow.data)
    const currency = safeCurrency(
      asText(proposalData?.currency) || asText(accountRow?.default_currency),
    )

    // Save first. An email problem must never lose the lead (INT-31).
    // TODO(INT-32): submissions needs a `confirmed boolean default false`
    // column so the dashboard can tell a confirmed selection from one the
    // client was only looking at. Until that lands the state lives in the
    // team email copy alone, and every row here looks the same to the UI.
    // TODO(INT-31): a `client_email_sent boolean` column would let us record
    // the client confirmation result too. email_sent below covers the team
    // notification only, and nothing in the current schema fits the second
    // flag without corrupting a column the dashboard reads.
    const { data: row, error: dbError } = await supabase
      .from("submissions")
      .insert({
        proposal_id: proposalRow.id,
        proposal_slug: proposalRow.slug,
        account_id: proposalRow.account_id ?? null,
        user_id: proposalRow.user_id,
        client_name: input.clientName,
        client_email: input.clientEmail,
        package_id: selection?.packageId ?? null,
        package_label: selection?.packageLabel ?? null,
        package_price: selection?.packagePrice ?? null,
        add_ons: selection?.addOns ?? [],
        retainer_hours: selection?.retainerHours ?? null,
        retainer_rate: selection?.retainerRate ?? null,
        total_price: selection?.grandTotal ?? null,
        currency,
        message: input.message,
      })
      .select("id")
      .single()

    if (dbError || !row?.id) {
      // Nothing is sent after a failed insert. The row is what makes this a
      // captured lead, and it is also the only thing the rate limit windows
      // count, so carrying on would put two DKIM signed emails on the wire per
      // attempt with nothing left to cap them.
      console.error("submit-proposal insert failed:", dbError)
      return json(500, {
        success: false,
        submissionId: null,
        teamEmailSent: false,
        clientEmailSent: false,
        error: "Failed to save submission",
      })
    }
    const submissionId: string = row.id

    // Then send. Both results are tracked separately and neither one is
    // allowed to stand in for the other.
    let teamEmailSent = false
    let clientEmailSent = false

    const resendKey = Deno.env.get("RESEND_API_KEY")
    if (!resendKey) {
      console.warn("submit-proposal: RESEND_API_KEY not set, submission saved without email")
    } else {
      const studioName = asText(proposalData?.studioName) || asText(accountRow?.studio_name)
      const ctx: EmailContext = {
        studioName,
        website: asText(accountRow?.website) || SENDER_DOMAIN,
        proposalTitle: asText(proposalRow.title) || proposalRow.slug,
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        message: input.message,
        accent: safeColor(proposalRow.brand_color_1),
        accent2: safeColor(proposalRow.brand_color_2, safeColor(proposalRow.brand_color_1)),
        currency,
        state,
        selection,
      }

      // The notify address is the account's own setting, which is where it has
      // always been. proposals.cta_email only stands in for a row with no
      // account behind it, so changing notify_email in settings still moves
      // every live proposal's leads. Nothing in the request body can point it
      // anywhere else. The client confirmation is the one caller supplied
      // recipient, and it only ever receives this fixed template, rate limited
      // by the windows above.
      const notifyEmail = asText(accountRow?.notify_email) || asText(proposalRow.cta_email)
      const ccEmail = asText(accountRow?.cc_email)
      // The client confirmation invites a reply, so it needs a reply address,
      // but only the account's own. proposals.cta_email is withheld from the
      // public read on purpose and must not travel back out in a header on a
      // mail addressed to whoever filled in the form.
      const clientReplyTo = asText(accountRow?.notify_email)
      const senderName =
        singleLine(asText(accountRow?.sender_name) || studioName || "Proposals").replace(
          /["<>]/g,
          " ",
        ) || "Proposals"
      const from = `${senderName} <notifications@${SENDER_DOMAIN}>`
      const subjectSuffix = singleLine(ctx.proposalTitle)

      const teamRecipients = [notifyEmail, ccEmail].filter((address) => address !== "")
      // The subject carries the state too. Whoever picks this up should know
      // before they open it whether anything was actually agreed.
      const teamSubject =
        state === "viewing"
          ? `New submission (selection not confirmed): ${subjectSuffix}`
          : state === "none_chosen"
            ? `New submission (no package selected): ${subjectSuffix}`
            : `New submission: ${subjectSuffix}`

      if (teamRecipients.length === 0) {
        console.error("submit-proposal: no notify address on proposal or account", proposalRow.id)
      }

      const sends: Promise<boolean>[] = [
        teamRecipients.length > 0
          ? sendViaResend(
              resendKey,
              { from, to: teamRecipients, subject: teamSubject, html: buildTeamEmailHtml(ctx) },
              "team",
            )
          : Promise.resolve(false),
        sendViaResend(
          resendKey,
          {
            from,
            // No CC. The recipient is whoever filled in the form, so every
            // header on this send is readable by a stranger who knows the
            // slug. The team notification above is the studio's record.
            to: [input.clientEmail],
            subject: `Thanks for your submission, ${subjectSuffix}`,
            html: buildClientEmailHtml(ctx),
            ...(clientReplyTo ? { reply_to: clientReplyTo } : {}),
          },
          "client",
        ),
      ]

      const [teamResult, clientResult] = await Promise.all(sends)
      teamEmailSent = teamResult
      clientEmailSent = clientResult
    }

    if (teamEmailSent) {
      const { error: flagError } = await supabase
        .from("submissions")
        .update({ email_sent: true })
        .eq("id", submissionId)
      if (flagError) {
        console.error("submit-proposal email_sent update failed:", flagError)
      }
    }

    // 200 means the lead is saved. The two booleans, not the status code, say
    // whether anyone was actually emailed.
    return json(200, { success: true, submissionId, teamEmailSent, clientEmailSent })
  } catch (e) {
    console.error("submit-proposal error:", e)
    return json(500, { error: "Internal server error" })
  }
})
