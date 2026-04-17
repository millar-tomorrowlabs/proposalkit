export type MemberRole = "owner" | "member"

/**
 * Canonical list of Proposl plans. Kept as a `const` array so both the
 * string-union type and runtime validation share one source of truth.
 * Edge functions (e.g. admin-issue-invite, admin-update-account) and
 * admin UI modals should import from here rather than re-defining.
 */
export const PLANS = ["friends_family", "studio", "agency", "enterprise"] as const
export type Plan = (typeof PLANS)[number]

/** Claude model tiers; admin-controlled, server-only. */
export const AI_MODEL_TIERS = ["haiku", "sonnet", "opus"] as const
export type AiModelTier = (typeof AI_MODEL_TIERS)[number]

export interface Account {
  id: string
  studioName: string
  legalEntity?: string
  website?: string
  logoUrl?: string
  notifyEmail: string
  ccEmail?: string
  senderName?: string
  defaultCtaEmail?: string
  defaultBrandColor1: string
  defaultBrandColor2: string
  defaultStudioTagline?: string
  defaultStudioDescription?: string
  defaultStudioDescription2?: string
  // ── AI voice & pricing defaults ────────────────────────────────────────
  // Used to ground AI generation/refinement so output sounds like the studio.
  voiceDescription?: string   // e.g. "Direct, opinionated, plainspoken. Avoid jargon."
  voiceExamples?: string      // 1-3 sample paragraphs the AI matches in tone
  bannedPhrases?: string      // comma-separated; appended to the universal banned list
  defaultHourlyRate?: number  // used in pricing recommendations
  defaultCurrency?: string    // ISO 4217, e.g. "USD"
  /**
   * When true (default), the AI is permitted to tailor the agency bio
   * (summary.studioDescription etc.) on a per-proposal basis — keeping the
   * core of the defaultStudioDescription but adjusting phrasing to name the
   * client or project type. When false, the AI must use the default
   * description verbatim and never touch it.
   */
  aiTailorAgencyBio?: boolean
  // ── Plan metadata ──────────────────────────────────────────────────────
  // "Friends & Family - Feedback" / Studio / Agency / Enterprise. Used
  // for display + client-side seat/send enforcement. Server-side enforcement
  // happens in edge functions and /api/chat which re-read from the DB.
  plan?: string
  maxTeamSeats?: number
  maxMonthlySends?: number
  // ai_model_tier intentionally omitted: admin-controlled, server-only.
}

export interface AccountMember {
  id: string
  accountId: string
  userId: string
  role: MemberRole
  displayName?: string
}
