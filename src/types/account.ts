export type MemberRole = "owner" | "member"

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
}

export interface AccountMember {
  id: string
  accountId: string
  userId: string
  role: MemberRole
  displayName?: string
}
