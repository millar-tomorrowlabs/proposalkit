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
  aiStudioDescription?: string
  aiStudioTagline?: string
  defaultCtaEmail?: string
  defaultBrandColor1: string
  defaultBrandColor2: string
  defaultStudioTagline?: string
  defaultStudioDescription?: string
  defaultStudioDescription2?: string
}

export interface AccountMember {
  id: string
  accountId: string
  userId: string
  role: MemberRole
  displayName?: string
}
