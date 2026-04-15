/**
 * Pre-flight checks for proposals before sending to a client.
 *
 * Returns a list of warnings for sections that will render as empty or
 * show placeholder text to the recipient. The send modal displays these
 * so the sender can decide whether to go back and fill things in.
 *
 * These are warnings, not errors. Nothing here blocks sending.
 */

import type { ProposalData, SectionKey } from "@/types/proposal"

export type ProposalWarningSection = SectionKey | "hero" | "meta"

export type ProposalWarning = {
  section: ProposalWarningSection
  label: string
  reason: string
}

export function validateProposalForSend(proposal: ProposalData): ProposalWarning[] {
  const warnings: ProposalWarning[] = []
  const enabled = new Set(proposal.sections)

  // --- Meta (always checked, not gated by section list) ---
  if (!proposal.tagline?.trim()) {
    warnings.push({
      section: "meta",
      label: "Tagline",
      reason: "Hero headline is blank. The top of the proposal will look unfinished.",
    })
  }
  if (!proposal.heroDescription?.trim()) {
    warnings.push({
      section: "meta",
      label: "Hero description",
      reason: "The one to two sentences below the tagline are blank.",
    })
  }
  if (!proposal.heroImageUrl) {
    warnings.push({
      section: "hero",
      label: "Hero image",
      reason: "No hero image set. The top of the client view will look unfinished.",
    })
  }

  // --- Sections (gated by whether the section is enabled) ---
  if (enabled.has("summary")) {
    const s = proposal.summary
    const hasProject = Boolean(
      s?.projectOverview?.trim() || s?.projectDetail?.trim() || s?.projectDetail2?.trim(),
    )
    const hasPillars = (s?.pillars?.length ?? 0) > 0
    if (!hasProject && !hasPillars) {
      warnings.push({
        section: "summary",
        label: "About",
        reason: "No project overview, details, or pillars. The About section will look empty.",
      })
    }
  }

  if (enabled.has("scope")) {
    if (!proposal.scope?.outcomes?.length) {
      warnings.push({
        section: "scope",
        label: "Scope",
        reason: "No outcomes listed. The scope section will be empty.",
      })
    }
  }

  if (enabled.has("timeline")) {
    if (!proposal.timeline?.phases?.length) {
      warnings.push({
        section: "timeline",
        label: "Timeline",
        reason: "No phases defined. The timeline section will be empty.",
      })
    }
  }

  if (enabled.has("investment")) {
    if (!proposal.investment?.packages?.length) {
      warnings.push({
        section: "investment",
        label: "Investment",
        reason: "No packages configured. The client will see 'No packages configured yet'.",
      })
    }
  }

  if (enabled.has("cta")) {
    if (!proposal.ctaEmail?.trim()) {
      warnings.push({
        section: "cta",
        label: "Call to action",
        reason: "No CTA email set. Client submissions will not route anywhere.",
      })
    }
  }

  return warnings
}
