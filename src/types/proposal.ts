export interface ConfirmedSelection {
  packageId: string
  packageLabel: string
  packagePrice: number
  addOns: { id: string; label: string; price: number }[]
  retainerHours?: number
  retainerRate?: number
  grandTotal: number
}

export interface ContextBlob {
  id: string
  label: string
  content: string
}

export interface AISuggestedAddOn {
  label: string
  description: string
  category: string
}

export interface AISuggestions {
  title?: string
  clientName?: string
  tagline?: string
  heroDescription?: string
  recommendation?: string
  summary?: {
    studioTagline?: string
    studioDescription?: string
    studioDescription2?: string
    projectOverview?: string
    projectDetail?: string
    projectDetail2?: string
    pillarsTagline?: string
    pillars?: { label: string; description: string }[]
  }
  scope?: {
    outcomes?: string[]
    responsibilities?: string[]
  }
  timeline?: {
    subtitle?: string
    phases?: { name: string; duration: string; description: string }[]
  }
  addOns?: AISuggestedAddOn[]
}

export interface ProposalPackage {
  id: string
  label: string
  basePrice: number
  baseDiscount?: number // deprecated — auto-calculated from included add-ons in renderer
  isRecommended?: boolean
  highlights: string[]
  /** Date this price holds until (e.g. "July 31, 2026"). Rendered on the card. */
  validUntil?: string
  /** Free-text price lock condition (e.g. "Retail price held through the
   * wholesale build"). Takes precedence over validUntil when both are set. */
  priceLockNote?: string
}

export interface AddOnPackageConfig {
  price?: number
  included?: boolean
}

export interface AddOn {
  id: string
  label: string
  description: string
  category: string
  packages: { [packageId: string]: AddOnPackageConfig }
  highlightInPackage?: string[]
  /**
   * Small-print annotation under the description. Used mainly on credits
   * (negative-price add-ons) to explain a carve-out, e.g. "We keep
   * migration, code, and QA".
   */
  note?: string
}

export interface AddOnCategory {
  id: string
  label: string
}

export interface RetainerConfig {
  hourlyRate: number
  minHours: number
  maxHours: number
  requiredMonths: number
  // Optional copy overrides. When any of these is blank, a sensible default is
  // generated based on the number of packages in the proposal.
  title?: string
  description?: string
  rateNote?: string
  features?: string[]
}

export interface PostLaunchConfig {
  monthlyPrice: number
  description: string
  features: string[]
  includedInPackage?: string
  includedWeeks?: number
}

export interface InvestmentConfig {
  packages: ProposalPackage[]
  addOnCategories: AddOnCategory[]
  addOns: AddOn[]
  retainer?: RetainerConfig
  postLaunch?: PostLaunchConfig
}

export interface TimelinePhase {
  name: string
  duration: string
  description: string
}

export interface ScopeConfig {
  outcomes: string[]
  responsibilities: string[]
}

export interface CTAConfig {
  /** The numbered "Next Steps" list. Editable per proposal. */
  steps: string[]
}

/**
 * Fallback next steps for proposals created before cta.steps existed (and
 * the seed for new ones). Rendered verbatim when a proposal has no cta
 * data, so legacy proposals keep looking exactly as they did.
 */
export const DEFAULT_CTA_STEPS: string[] = [
  "Confirm package selection and any add-ons",
  "Review and sign the Master Services Agreement",
  "Schedule kickoff to align on workflows, timelines, and responsibilities",
]

export type SectionKey =
  | "summary"
  | "scope"
  | "timeline"
  | "investment"
  | "cta"

/**
 * Entry in proposal.sections. Either a typed SectionKey or a custom section
 * id ("custom-..."), which points into proposal.customSections. Stored in
 * the proposals.sections text[] column either way, so no schema change.
 */
export type SectionId = string

export interface CustomSection {
  /** "custom-" + 8 hex chars. Doubles as the DOM anchor and nav href. */
  id: string
  title: string
  /** Plain text, rendered whitespace-pre-wrap. Import paths write it verbatim. */
  body: string
}

export const TYPED_SECTION_KEYS: SectionKey[] = ["summary", "scope", "timeline", "investment", "cta"]

export const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  scope: "Scope",
  timeline: "Timeline",
  investment: "Investment",
  cta: "Next Steps",
}

export function isTypedSection(id: string): id is SectionKey {
  return (TYPED_SECTION_KEYS as string[]).includes(id)
}

/** Display label for any section id: the typed label, or the custom section's title. */
export function sectionLabel(id: string, customSections?: CustomSection[]): string {
  if (isTypedSection(id)) return SECTION_LABELS[id]
  return customSections?.find((s) => s.id === id)?.title.trim() || "Untitled section"
}

export interface ProposalMeta {
  id: string
  slug: string
  title: string
  clientName: string
  brandColor1: string
  brandColor2: string
  heroImageUrl?: string
  /**
   * AI-authored keyword string used by /api/hero-image when sourcing an
   * Unsplash background during v1 generation. The AI teases this out of
   * the user during intake (visual direction / mood / vibe) so we can
   * search for something more evocative than just "client name + tagline".
   * Never rendered in the proposal; internal only.
   */
  heroImageQuery?: string
  clientLogoUrl?: string
  heroLogoLarge?: boolean // show large logo in hero instead of client name text
  tagline: string
  heroDescription: string
  ctaEmail: string
  currency?: string // ISO 4217 code, e.g. "USD", "GBP", "EUR"
  recommendation?: string
  studioName?: string // header text, e.g. "Tomorrow Studios x Obra"
  studioLogoUrl?: string // studio logo, denormalized from account.logoUrl at save time
  status?: "draft" | "sent" | "viewed" // proposal lifecycle status
  brief?: string // AI-synthesised working understanding of the client and project
  contextBlobs?: ContextBlob[] // persisted deal context
  sections: SectionId[]
  /** Free-form sections referenced by id from `sections`. Optional for
   * proposals saved before custom sections existed. */
  customSections?: CustomSection[]
  createdAt: string
  updatedAt: string
}

export interface ProposedEdit {
  fieldPath: string
  oldValue: unknown
  newValue: unknown
  label: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  edits?: ProposedEdit[]
  editsApplied?: boolean
  createdAt: string
}

export interface ProposalData extends ProposalMeta {
  summary: {
    studioTagline: string
    studioDescription: string
    studioDescription2: string
    projectOverview: string
    projectDetail: string
    projectDetail2?: string
    pillarsTagline: string
    pillars: { label: string; description: string }[]
  }
  scope: ScopeConfig
  timeline: {
    subtitle: string
    phases: TimelinePhase[]
  }
  investment: InvestmentConfig
  /** Optional for proposals saved before this field existed; the CTA
   * section falls back to DEFAULT_CTA_STEPS when absent. */
  cta?: CTAConfig
}

export interface ProposalContextSource {
  id: string
  proposalId: string
  sourceType: "file" | "url" | "paste"
  name: string
  url?: string
  fileSize?: number
  extractedText: string
  createdAt: string
}

export interface ProposalMessage {
  id: string
  proposalId: string
  role: "user" | "assistant"
  content: string
  sectionContext?: string
  createdAt: string
}

export interface ProposalSnapshot {
  id: string
  proposalId: string
  data: ProposalData
  trigger: string
  createdAt: string
}
