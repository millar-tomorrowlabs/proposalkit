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
}

export interface InvestmentConfig {
  packages: ProposalPackage[]
  addOnCategories: AddOnCategory[]
  addOns: AddOn[]
  retainer?: RetainerConfig
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

export type SectionKey =
  | "summary"
  | "scope"
  | "timeline"
  | "investment"
  | "cta"

export interface ProposalMeta {
  id: string
  slug: string
  title: string
  clientName: string
  brandColor1: string
  brandColor2: string
  heroImageUrl?: string
  clientLogoUrl?: string
  tagline: string
  heroDescription: string
  ctaEmail: string
  recommendation?: string
  sections: SectionKey[]
  createdAt: string
  updatedAt: string
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
}
