/**
 * Maps raw error messages (from Supabase, edge functions, network, etc.)
 * to friendly, client-facing messages. Never expose database internals.
 */

const ERROR_PATTERNS: [RegExp, string][] = [
  // Auth & RLS
  [/row.level security/i, "Unable to save. Please try signing out and back in."],
  [/JWT expired/i, "Your session has expired. Please sign in again."],
  [/Invalid token/i, "Your session has expired. Please sign in again."],
  [/not authorized/i, "You don't have permission to do that."],
  [/Missing authorization/i, "Please sign in to continue."],

  // Validation
  [/duplicate key/i, "This name is already taken. Please choose another."],
  [/violates unique constraint/i, "This name is already taken. Please choose another."],
  [/Missing required fields/i, "Please fill in all required fields."],
  [/not_null_violation/i, "A required field is missing. Please check your inputs."],

  // Network
  [/Failed to fetch/i, "Connection issue. Please check your internet and try again."],
  [/NetworkError/i, "Connection issue. Please check your internet and try again."],
  [/ECONNREFUSED/i, "The server is temporarily unavailable. Please try again in a moment."],
  [/timeout/i, "The request took too long. Please try again."],
  [/ERR_NETWORK/i, "Connection issue. Please check your internet and try again."],

  // Edge function / API
  [/RESEND_API_KEY not configured/i, "Email service is not configured. Please contact support."],
  [/ANTHROPIC_API_KEY/i, "AI service is not configured. Please contact support."],
  [/Failed to send email/i, "Email couldn't be sent. Please try again."],
  [/Incorrect email or password/i, "Incorrect email or password."],
  // Supabase client wraps any non-2xx function response with this generic
  // string. It's a leaky abstraction — users shouldn't see "edge function"
  // anywhere. Callers extract the real error body; this is the fallback.
  [/Edge Function returned/i, "Something didn't save. Please try again."],
  [/non-2xx status/i, "Something didn't save. Please try again."],
  [/FunctionsHttpError/i, "Something didn't save. Please try again."],

  // Rate limiting
  [/rate.limit/i, "Too many requests. Please wait a moment and try again."],
  [/429/i, "Too many requests. Please wait a moment and try again."],
]

export function friendlyError(raw: string | undefined | null): string {
  if (!raw) return "Something went wrong. Please try again."

  for (const [pattern, message] of ERROR_PATTERNS) {
    if (pattern.test(raw)) return message
  }

  // Don't leak anything that looks like a database/technical error
  if (
    raw.includes("ERROR:") ||
    raw.includes("pg_") ||
    raw.includes("supabase") ||
    raw.includes("postgres") ||
    raw.includes("relation ") ||
    raw.includes("column ") ||
    raw.includes("constraint ")
  ) {
    return "Something went wrong. Please try again."
  }

  // If it's short and doesn't look technical, pass it through
  if (raw.length < 100 && !/[_{}()[\]]/.test(raw)) {
    return raw
  }

  return "Something went wrong. Please try again."
}

/**
 * Extract the real error message from a Supabase `functions.invoke()`
 * error. supabase-js wraps any non-2xx edge-function response in a
 * generic `FunctionsHttpError` with a useless `Edge Function returned
 * a non-2xx status code` message. The actual `{ error: "..." }` body
 * from the function lives on `.context` (a Fetch `Response`).
 *
 * Returns a message already run through `friendlyError()`.
 */
export async function extractEdgeFunctionError(
  fnError: { message?: string } | null | undefined,
): Promise<string> {
  if (!fnError) return friendlyError(null)
  let message = fnError.message
  const ctx = (fnError as { context?: Response }).context
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json()
      if (body?.error) message = body.error
    } catch {
      /* fall through with the generic message */
    }
  }
  return friendlyError(message)
}
