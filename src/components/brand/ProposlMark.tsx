/**
 * Proposl seal mark (hand-drawn placeholder).
 *
 * A deliberately imperfect `pl` ligature inside a slightly irregular circle.
 * Placeholder until a designer re-draws this properly — the construction
 * logic and paths live here so swapping for the final version is a
 * one-file change.
 *
 * Uses `currentColor` for stroke so the parent controls the color via
 * className. Pass `className="text-forest"` or similar.
 *
 * Source: design/explorations/seal-handdrawn-placeholder.svg
 */
type Props = {
  size?: number
  className?: string
  "aria-label"?: string
}

export default function ProposlMark({ size = 40, className = "", ...rest }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={rest["aria-label"] ?? "Proposl"}
    >
      <g
        stroke="currentColor"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Slightly irregular circle with a pen-lift gap near the top */}
        <path
          d="M 108 28.5
             C 146 30, 171 61, 172 99
             C 173 141, 139 171, 100 171
             C 59 172, 29 139, 28.5 100
             C 28 59, 61 30, 99 28"
          strokeWidth="3.5"
        />

        {/* Shared stem: primary stroke */}
        <line x1="92" y1="42" x2="92" y2="158" strokeWidth="6.5" />
        {/* Shared stem: secondary pass, slightly offset — the "drawn twice" look */}
        <line x1="93.5" y1="44" x2="93" y2="158" strokeWidth="5" />

        {/* Top of the l: small flag serif across the stem top */}
        <line x1="86.5" y1="42.5" x2="99.5" y2="42" strokeWidth="3" />

        {/* Bottom serif foot (p descender foot + l foot) */}
        <line x1="85" y1="158.5" x2="100" y2="158" strokeWidth="3" />

        {/* The p's bowl, deliberately asymmetric */}
        <path
          d="M 93 85
             Q 134 82, 131 107
             Q 130 131, 92 130"
          strokeWidth="6"
        />
      </g>
    </svg>
  )
}
