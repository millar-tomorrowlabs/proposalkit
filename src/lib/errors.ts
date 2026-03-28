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
