/**
 * Parse and strip `proposal-edits` code blocks from AI chat messages.
 *
 * The AI is instructed to emit edits as a hidden code block at the end of
 * each response, like:
 *
 *   ```proposal-edits
 *   [{"fieldPath": "tagline", "oldValue": "...", "newValue": "...", "label": "Tagline"}]
 *   ```
 *
 * The user never sees the block — it's stripped from the visible content
 * and the edits are applied to the proposal automatically.
 */

import type { ProposedEdit } from "@/types/proposal"

// Match a fenced ```proposal-edits ... ``` block (greedy on content, single
// occurrence per block, anchored on its own delimiters).
const EDITS_FENCE = /```proposal-edits\s*\n?([\s\S]*?)\n?```/g

/**
 * Extract all proposal-edits arrays from a message's text content.
 * Tolerates multiple blocks per message (concatenates them). Returns []
 * if nothing is found or the JSON is malformed.
 */
export function extractEditsFromText(text: string): ProposedEdit[] {
  if (!text || !text.includes("```proposal-edits")) return []

  const edits: ProposedEdit[] = []
  EDITS_FENCE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = EDITS_FENCE.exec(text))) {
    const json = match[1].trim()
    if (!json) continue
    try {
      const parsed = JSON.parse(json) as unknown
      if (Array.isArray(parsed)) {
        for (const e of parsed) {
          if (
            e &&
            typeof e === "object" &&
            typeof (e as ProposedEdit).fieldPath === "string" &&
            "newValue" in (e as object)
          ) {
            edits.push(e as ProposedEdit)
          }
        }
      }
    } catch {
      // Malformed JSON during streaming is expected — skip silently.
      // The block will reparse cleanly once streaming completes.
    }
  }
  return edits
}

/**
 * Remove proposal-edits blocks from text so they aren't shown to the user.
 * Also collapses any blank lines left behind.
 */
export function stripEditsBlocks(text: string): string {
  if (!text || !text.includes("```proposal-edits")) return text
  return text
    .replace(EDITS_FENCE, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * While the AI is streaming, the closing ``` may not have arrived yet. Hide
 * any in-progress fence by detecting an unterminated `proposal-edits` block
 * and stripping from the opening fence to end-of-text.
 */
export function stripStreamingEditsBlock(text: string): string {
  const cleaned = stripEditsBlocks(text)
  const openIdx = cleaned.lastIndexOf("```proposal-edits")
  if (openIdx === -1) return cleaned
  // Unterminated block: cut everything from the opening fence onward.
  return cleaned.slice(0, openIdx).trimEnd()
}
