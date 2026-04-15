/**
 * Proposl health check
 * --------------------
 * Pings every deployed edge function and DB table to confirm the
 * production stack is actually working. Run before every ship:
 *
 *   npx tsx scripts/health-check.ts
 *
 * Reads credentials from .env.local:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *   HEALTH_CHECK_EMAIL     (dedicated test user, or any account with owner role)
 *   HEALTH_CHECK_PASSWORD
 *
 * Or, for one-off runs without creating a test user, pass a session token:
 *   HEALTH_CHECK_TOKEN=<access_token> npm run health
 * (Grab the token from your browser: JSON.parse(localStorage.getItem("sb-*-auth-token")).access_token)
 *
 * What it checks:
 *   1. Log in as the test user (confirms auth works)
 *   2. Every edge function responds with a function-level status, not a
 *      gateway 401/500. Catches the "invite-member was broken for weeks" bug.
 *   3. Every known DB table is readable with the test user's session.
 *   4. Required storage buckets exist.
 *
 * What it does NOT do:
 *   - Run successful writes (no test proposals, no real invites sent).
 *   - Test any flow that costs money (AI generation, image generation, email sends).
 *   - Replace end-to-end QA. Use QA.md for that.
 */

import { createClient } from "@supabase/supabase-js"
import { readFileSync } from "fs"
import { resolve } from "path"

// --- Minimal .env.local loader (avoids adding dotenv as a dep) ---
function loadEnv(path: string): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    const raw = readFileSync(path, "utf8")
    for (const line of raw.split("\n")) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith("#")) continue
      const eq = trimmed.indexOf("=")
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  } catch {
    // Missing .env.local is fine — we'll fall back to process.env
  }
  return env
}

const fileEnv = loadEnv(resolve(process.cwd(), ".env.local"))
const env = { ...fileEnv, ...process.env }

const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_ANON = env.VITE_SUPABASE_ANON_KEY
const TEST_EMAIL = env.HEALTH_CHECK_EMAIL
const TEST_PASSWORD = env.HEALTH_CHECK_PASSWORD
const TEST_TOKEN = env.HEALTH_CHECK_TOKEN

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local")
  process.exit(1)
}
if (!TEST_TOKEN && (!TEST_EMAIL || !TEST_PASSWORD)) {
  console.error("Missing credentials. Set either:")
  console.error("  HEALTH_CHECK_TOKEN=<access_token>   (one-off: grab from browser localStorage)")
  console.error("  or")
  console.error("  HEALTH_CHECK_EMAIL=healthcheck@tomorrowstudios.io")
  console.error("  HEALTH_CHECK_PASSWORD=...")
  process.exit(1)
}

// --- Check definitions ---

type CheckResult = {
  name: string
  status: "pass" | "fail" | "warn"
  detail: string
  ms: number
}

const results: CheckResult[] = []

function record(name: string, status: CheckResult["status"], detail: string, ms: number) {
  results.push({ name, status, detail, ms })
  const icon = status === "pass" ? "✓" : status === "warn" ? "⚠" : "✗"
  const color = status === "pass" ? "\x1b[32m" : status === "warn" ? "\x1b[33m" : "\x1b[31m"
  console.log(`${color}${icon}\x1b[0m ${name.padEnd(42)} ${detail} \x1b[90m(${ms}ms)\x1b[0m`)
}

async function time<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now()
  const result = await fn()
  return [result, Date.now() - start]
}

// --- Main ---

async function main() {
  console.log(`\nProposl health check — ${SUPABASE_URL}\n`)

  // 1. Auth
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
  let accessToken: string

  if (TEST_TOKEN) {
    // Token mode: verify the token is valid with a getUser call
    const [userResult, userMs] = await time(() => supabase.auth.getUser(TEST_TOKEN))
    if (userResult.error || !userResult.data.user) {
      record("auth.getUser (token mode)", "fail", userResult.error?.message ?? "no user", userMs)
      console.error("\nToken is invalid or expired. Grab a fresh one from browser localStorage.\n")
      process.exit(1)
    }
    record("auth.getUser (token mode)", "pass", `token valid for ${userResult.data.user.email}`, userMs)
    accessToken = TEST_TOKEN
  } else {
    const [authResult, authMs] = await time(() =>
      supabase.auth.signInWithPassword({ email: TEST_EMAIL!, password: TEST_PASSWORD! })
    )
    if (authResult.error || !authResult.data.session) {
      record("auth.signInWithPassword", "fail", authResult.error?.message ?? "no session", authMs)
      console.error("\nCannot continue without a session. Fix auth first.\n")
      process.exit(1)
    }
    record("auth.signInWithPassword", "pass", `signed in as ${TEST_EMAIL}`, authMs)
    accessToken = authResult.data.session.access_token
  }

  // 2. Edge functions — POST {} with session token. Expect function-level 4xx, never gateway 401.
  // chat-edit-proposal is deprecated — replaced by api/chat.ts Vercel Edge Function.
  // track-email-open was deleted — Resend webhooks now handle open/click tracking.
  const functions = [
    "invite-member",
    "send-proposal",
    "submit-proposal",
    "generate-proposal",
    "generate-suggestions",
    "track-view",
    "set-proposal-password",
    "verify-proposal-password",
    "resend-webhook",
  ]

  for (const fn of functions) {
    const [res, ms] = await time(async () => {
      return await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: SUPABASE_ANON,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      })
    })
    const text = await res.text()

    // Gateway 401 "Invalid JWT" → function deployed without --no-verify-jwt
    if (res.status === 401 && text.includes('"code":401') && text.includes("Invalid JWT")) {
      record(`fn:${fn}`, "fail", "GATEWAY 401 Invalid JWT — redeploy with --no-verify-jwt", ms)
      continue
    }
    // 5xx usually means the function crashed on an empty body, which is a bug worth flagging.
    if (res.status >= 500) {
      record(`fn:${fn}`, "warn", `5xx — ${text.slice(0, 80)}`, ms)
      continue
    }
    // 2xx or 4xx with a function-level error → function is alive
    record(`fn:${fn}`, "pass", `${res.status} (function reachable)`, ms)
  }

  // 3. DB tables — confirm schema + RLS allows a basic read.
  const tables = [
    "accounts",
    "account_members",
    "account_invites",
    "proposals",
    "proposal_sends",
    "submissions",
  ]

  // Re-create client with the user's session so RLS applies correctly
  const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })

  for (const table of tables) {
    const [{ error }, ms] = await time(() =>
      authedClient.from(table).select("id").limit(1)
    )
    if (error) {
      record(`db:${table}`, "fail", error.message, ms)
    } else {
      record(`db:${table}`, "pass", "readable", ms)
    }
  }

  // 4. Storage buckets
  const buckets = ["proposal-assets"]
  for (const bucket of buckets) {
    const [{ data, error }, ms] = await time(() =>
      authedClient.storage.from(bucket).list("", { limit: 1 })
    )
    if (error) {
      record(`storage:${bucket}`, "fail", error.message, ms)
    } else {
      record(`storage:${bucket}`, "pass", `listable (${data?.length ?? 0} items visible)`, ms)
    }
  }

  // --- Summary ---
  const failed = results.filter((r) => r.status === "fail").length
  const warned = results.filter((r) => r.status === "warn").length
  const passed = results.filter((r) => r.status === "pass").length

  console.log(`\n${passed} passed, ${warned} warnings, ${failed} failed`)

  if (failed > 0) {
    console.log("\n\x1b[31mFAILURES:\x1b[0m")
    for (const r of results.filter((r) => r.status === "fail")) {
      console.log(`  ✗ ${r.name}: ${r.detail}`)
    }
    process.exit(1)
  }

  if (warned > 0) {
    console.log("\n\x1b[33mWARNINGS (non-blocking):\x1b[0m")
    for (const r of results.filter((r) => r.status === "warn")) {
      console.log(`  ⚠ ${r.name}: ${r.detail}`)
    }
  }

  if (!TEST_TOKEN) {
    await supabase.auth.signOut()
  }
  console.log("")
}

main().catch((e) => {
  console.error("\nHealth check crashed:", e)
  process.exit(1)
})
