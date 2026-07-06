/**
 * Verbatim markdown import (INT-18).
 *
 * Accepts a document split by `## SECTION: <name>` headings and maps each
 * block onto the proposal with ZERO rewriting: recognized names hit typed
 * targets, everything else becomes (or replaces) a custom section whose
 * body is the text between headings, byte for byte. Only structural
 * newlines around the block edges are trimmed; interior content, including
 * blank lines, is preserved exactly.
 */

import { v4 as uuidv4 } from "uuid"
import type { CustomSection, ProposalData } from "@/types/proposal"

export type ImportTargetKind = "tagline" | "heroDescription" | "ctaSteps" | "custom"

export interface ImportSection {
  /** The heading text after "## SECTION:", trimmed. */
  heading: string
  /** Verbatim body between this heading and the next. */
  body: string
  target: ImportTargetKind
  /** For "custom": the id of an existing custom section with the same title
   * that this block will replace instead of duplicating. */
  replacesId?: string
}

export interface ParsedImport {
  sections: ImportSection[]
  /** True when text appeared before the first heading (it is ignored). */
  hasPreamble: boolean
}

const HEADING_RE = /^##\s*SECTION:\s*(.+?)\s*$/

/** Reserved heading names that map to typed proposal fields. */
const TYPED_TARGETS: Record<string, ImportTargetKind> = {
  "tagline": "tagline",
  "hero": "heroDescription",
  "hero description": "heroDescription",
  "next steps": "ctaSteps",
}

export function targetLabel(s: ImportSection): string {
  switch (s.target) {
    case "tagline": return "Hero tagline"
    case "heroDescription": return "Hero description"
    case "ctaSteps": return "Next steps list"
    case "custom": return s.replacesId ? "Replaces existing section" : "New custom section"
  }
}

/** Trim only structural blank lines at the edges; interior stays verbatim. */
function trimEdges(lines: string[]): string {
  let start = 0
  let end = lines.length
  while (start < end && lines[start].trim() === "") start++
  while (end > start && lines[end - 1].trim() === "") end--
  return lines.slice(start, end).join("\n")
}

export function parseImportDoc(
  text: string,
  existingCustomSections?: CustomSection[],
): ParsedImport {
  // Normalize line endings once; bodies are byte-identical modulo CRLF.
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  const sections: ImportSection[] = []
  let currentHeading: string | null = null
  let currentBody: string[] = []
  let hasPreamble = false

  const close = () => {
    if (currentHeading === null) return
    const heading = currentHeading
    const body = trimEdges(currentBody)
    const target = TYPED_TARGETS[heading.toLowerCase()] ?? "custom"
    const section: ImportSection = { heading, body, target }
    if (target === "custom") {
      const existing = existingCustomSections?.find(
        (c) => c.title.trim().toLowerCase() === heading.toLowerCase(),
      )
      if (existing) section.replacesId = existing.id
    }
    sections.push(section)
  }

  for (const line of lines) {
    const match = HEADING_RE.exec(line)
    if (match) {
      close()
      currentHeading = match[1]
      currentBody = []
    } else if (currentHeading === null) {
      if (line.trim() !== "") hasPreamble = true
    } else {
      currentBody.push(line)
    }
  }
  close()

  return { sections, hasPreamble }
}

/** "Next steps" bodies are lists; strip common list markers per line. */
export function parseSteps(body: string): string[] {
  return body
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*]|\d+[.)])\s+/, "").trim())
    .filter((l) => l.length > 0)
}

/**
 * Pure apply: returns a new proposal with every import block landed
 * verbatim. Custom blocks replace an existing section when the title
 * matches (so re-importing an updated doc doesn't duplicate), otherwise
 * they append before the CTA.
 */
export function applyImportToProposal(
  proposal: ProposalData,
  sections: ImportSection[],
): ProposalData {
  let next: ProposalData = { ...proposal }
  const custom = [...(proposal.customSections ?? [])]
  const order = [...proposal.sections]

  for (const s of sections) {
    if (s.target === "tagline") {
      next = { ...next, tagline: s.body }
    } else if (s.target === "heroDescription") {
      next = { ...next, heroDescription: s.body }
    } else if (s.target === "ctaSteps") {
      next = { ...next, cta: { steps: parseSteps(s.body) } }
    } else {
      const existingIdx = s.replacesId
        ? custom.findIndex((c) => c.id === s.replacesId)
        : custom.findIndex((c) => c.title.trim().toLowerCase() === s.heading.toLowerCase())
      if (existingIdx !== -1) {
        custom[existingIdx] = { ...custom[existingIdx], title: s.heading, body: s.body }
      } else {
        const id = `custom-${uuidv4().slice(0, 8)}`
        custom.push({ id, title: s.heading, body: s.body })
        const ctaIdx = order.indexOf("cta")
        order.splice(ctaIdx >= 0 ? ctaIdx : order.length, 0, id)
      }
    }
  }

  return { ...next, customSections: custom, sections: order }
}
