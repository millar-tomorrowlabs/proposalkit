/**
 * /api/hero-image — Unsplash hero image search (Vercel Edge)
 *
 * When the AI populates a new proposal (tagline, client name, etc.), the
 * builder calls this endpoint with a derived query string and applies the
 * returned URL as the heroImageUrl field. Keeps the image-sourcing flow
 * that originally lived in the now-deleted WizardPage generate-proposal
 * path, wired into the new streaming chat model.
 *
 * Auth: Bearer Supabase session token. Rate-limited per user.
 * Returns: { url: string | null, debug?: object }
 */

import { createClient } from "@supabase/supabase-js"

export const config = { runtime: "edge" }

// --- Rate limiting (in-memory, resets on cold start) -----------------------
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 30

function checkRateLimit(userId: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX) return false
  entry.count++
  return true
}

// --- Auth ------------------------------------------------------------------
async function verifyAuth(req: Request): Promise<string> {
  const authHeader = req.headers.get("authorization")
  if (!authHeader?.startsWith("Bearer ")) throw new Error("UNAUTHORIZED")

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const token = authHeader.slice(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) throw new Error("UNAUTHORIZED")
  return user.id
}

// --- Unsplash search -------------------------------------------------------
async function searchUnsplash(query: string): Promise<{ url: string | null; debug: Record<string, unknown> }> {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY
  const debug: Record<string, unknown> = { attempted: false }

  if (!unsplashKey) {
    debug.error = "UNSPLASH_ACCESS_KEY not configured"
    return { url: null, debug }
  }

  debug.attempted = true

  // Extract 2-3 keywords — strip punctuation, drop short words, cap at 3.
  // Matches the original generate-proposal heuristic.
  const keywords = query
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3)
    .join(" ")

  debug.keywords = keywords

  if (!keywords.trim()) {
    debug.error = "No usable keywords extracted from query"
    return { url: null, debug }
  }

  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keywords)}&orientation=landscape&per_page=1`,
      { headers: { Authorization: `Client-ID ${unsplashKey}` } },
    )
    debug.status = response.status

    if (!response.ok) {
      const errText = await response.text()
      debug.error = errText.slice(0, 500)
      return { url: null, debug }
    }

    const data = await response.json()
    const url = data.results?.[0]?.urls?.regular ?? null
    if (!url) debug.error = `No results for "${keywords}"`
    return { url, debug }
  } catch (err) {
    debug.error = String(err).slice(0, 500)
    return { url: null, debug }
  }
}

// --- Handler ---------------------------------------------------------------
export default async function handler(req: Request) {
  const origin = req.headers.get("origin") ?? ""
  const allowedOrigins = [
    "https://proposl.app",
    "https://www.proposl.app",
    "http://localhost:5173",
    "http://localhost:5174",
  ]
  const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]

  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": corsOrigin,
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

  let userId: string
  try {
    userId = await verifyAuth(req)
  } catch {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!checkRateLimit(userId)) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    })
  }

  try {
    const { query } = (await req.json()) as { query?: string }
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "query required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      })
    }
    // Cap query length so malicious or accidental huge payloads bounce.
    const bounded = query.slice(0, 500)

    const result = await searchUnsplash(bounded)
    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": corsOrigin,
      },
    })
  } catch (err) {
    console.error("hero-image error:", err)
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
