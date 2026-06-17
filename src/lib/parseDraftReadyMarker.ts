// src/lib/parseDraftReadyMarker.ts

// Matches the marker anywhere in the message, with any surrounding
// whitespace, all occurrences. The model is told to emit it as the final
// line, but when the user has already given the go-ahead it may emit the
// marker AND keep drafting in the same turn, leaving the marker mid-text.
// Stripping globally keeps it out of the visible bubble regardless.
const MARKER_PATTERN = /\s*\[\[DRAFT_READY\]\]\s*/g

/**
 * Inspect an assistant message for the [[DRAFT_READY]] signal.
 *
 * The marker is emitted by the intake AI when it judges it has enough
 * context to begin drafting. The UI strips the marker from the visible
 * text and uses the `isReady` flag to render a "Draft v1" button
 * attached to that assistant message bubble.
 *
 * Strips every occurrence wherever it appears (not just a trailing one),
 * and collapses the surrounding whitespace so the cleaned text reads
 * naturally. `isReady` is true whenever the marker is present at all.
 */
export function parseDraftReadyMarker(content: string): {
  displayText: string
  isReady: boolean
} {
  if (!content) return { displayText: "", isReady: false }
  // Reset lastIndex defensively — a global regex is stateful across .test().
  MARKER_PATTERN.lastIndex = 0
  const isReady = MARKER_PATTERN.test(content)
  if (!isReady) return { displayText: content, isReady: false }
  const displayText = content.replace(MARKER_PATTERN, " ").trim()
  return { displayText, isReady: true }
}
