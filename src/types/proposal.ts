export interface ProposalPackage {
  id: string
  label: string
  basePrice: number
  baseDiscount: number
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
  heroImageUrl: string
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
