// src/lib/parseDraftReadyMarker.ts

const MARKER_PATTERN = /\s*\[\[DRAFT_READY\]\]\s*$/

/**
 * Inspect an assistant message for the [[DRAFT_READY]] trailer marker.
 *
 * The marker is emitted by the intake AI when it judges it has enough
 * context to begin drafting. The UI strips the marker from the visible
 * text and uses the `isReady` flag to render a "Draft v1" button
 * attached to that assistant message bubble.
 *
 * Tolerant of trailing whitespace and partial streams. Returns
 * `isReady: false` when the marker isn't fully present, so a streaming
 * assistant message only flips the button on once the marker has
 * fully arrived.
 */
export function parseDraftReadyMarker(content: string): {
  displayText: string
  isReady: boolean
} {
  if (!content) return { displayText: "", isReady: false }
  const isReady = MARKER_PATTERN.test(content)
  const displayText = isReady ? content.replace(MARKER_PATTERN, "") : content
  return { displayText, isReady }
}
