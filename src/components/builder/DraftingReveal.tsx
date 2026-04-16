/**
 * DraftingReveal — cinematic overlay shown while the AI drafts v1.
 *
 * Fires between "Drafting now." and the first edits landing in the doc.
 * Shows the Proposl mark large + a rotating caption so the wait feels
 * purposeful instead of a stalled textarea.
 *
 * Exit uses option D: the mark shrinks and migrates to its spot in the
 * top bar (~left: 16px, top: 2px, 40px), backdrop fades. If the user
 * prefers reduced motion, the migration is skipped and the whole
 * overlay simply fades out (fallback option A).
 *
 * Lifecycle:
 *   active=true  → overlay mounted, phase="in" → "hold"
 *   active=false → phase="out", overlay unmounts after ~900ms
 */

import { useEffect, useRef, useState } from "react"
import ProposlMark from "@/components/brand/ProposlMark"

interface DraftingRevealProps {
  active: boolean
}

type Phase = "in" | "hold" | "out" | "done"

const CAPTIONS_PRIMARY = [
  "Reading your brief...",
  "Shaping the headline...",
  "Writing the overview...",
  "Mapping the timeline...",
  "Pricing the tiers...",
  "Drafting the add-ons...",
  "Finding a hero image...",
]

const CAPTION_STILL_WORKING = "Still working. Complex briefs take a moment."
const CAPTION_ROTATE_MS = 3500
const LONG_WAIT_MS = 20_000

export default function DraftingReveal({ active }: DraftingRevealProps) {
  const [phase, setPhase] = useState<Phase>("done")
  const [captionIndex, setCaptionIndex] = useState(0)
  const [showLongWait, setShowLongWait] = useState(false)
  const startedAtRef = useRef<number | null>(null)

  // Enter / exit state machine.
  useEffect(() => {
    if (active) {
      setPhase("in")
      setCaptionIndex(0)
      setShowLongWait(false)
      startedAtRef.current = Date.now()
      // Move to hold after the enter animation finishes (~300ms).
      const t = setTimeout(() => setPhase("hold"), 320)
      return () => clearTimeout(t)
    }
    // Only trigger exit if we were actually showing. Avoids the first-render
    // "active=false" path marking the phase as "out" pre-mount.
    setPhase((prev) => (prev === "done" ? "done" : "out"))
    // Unmount after the exit animation.
    const t = setTimeout(() => setPhase("done"), 900)
    return () => clearTimeout(t)
  }, [active])

  // Rotate captions while in hold.
  useEffect(() => {
    if (phase !== "hold") return
    const interval = setInterval(() => {
      setCaptionIndex((i) => (i + 1) % CAPTIONS_PRIMARY.length)
    }, CAPTION_ROTATE_MS)
    return () => clearInterval(interval)
  }, [phase])

  // Swap caption to the reassuring "still working" line once the wait
  // stretches past 20s. We use a separate flag rather than a caption index
  // so it pins once set, instead of rotating back into the normal cycle.
  useEffect(() => {
    if (phase !== "hold") return
    const t = setTimeout(() => setShowLongWait(true), LONG_WAIT_MS)
    return () => clearTimeout(t)
  }, [phase])

  if (phase === "done") return null

  const caption = showLongWait ? CAPTION_STILL_WORKING : CAPTIONS_PRIMARY[captionIndex]
  // Derived classes for CSS state.
  const overlayClass = `drafting-reveal drafting-reveal--${phase}`
  const markClass = `drafting-reveal__mark drafting-reveal__mark--${phase}`

  return (
    <div
      className={overlayClass}
      aria-live="polite"
      aria-busy={phase === "hold" || phase === "in"}
    >
      <div className={markClass}>
        <ProposlMark size={128} aria-label="Drafting your proposal" />
      </div>
      <div className="drafting-reveal__caption">
        <span key={caption} className="drafting-reveal__caption-text">
          {caption}
        </span>
      </div>
    </div>
  )
}
