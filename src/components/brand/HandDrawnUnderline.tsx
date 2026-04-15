/**
 * Hand-drawn underline SVG.
 *
 * Used as a personality accent on a single emphasized word in a headline.
 * Deliberately wobbly — matches the hand-drawn quality of the seal mark.
 *
 * Usage:
 *   <span className="relative inline-block">
 *     enjoy
 *     <HandDrawnUnderline className="absolute left-0 right-0 -bottom-2 text-forest" />
 *   </span>
 */
type Props = {
  className?: string
}

export default function HandDrawnUnderline({ className = "" }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 20"
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/*
        A single wobbly stroke with two overlapping passes for the
        "pen went over it twice" look. Uses currentColor so parent
        controls the hue.
      */}
      <path
        d="M 4 12
           C 28 7, 56 15, 82 10
           C 108 5, 134 14, 160 9
           C 178 6, 190 11, 196 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M 6 14
           C 32 9, 58 16, 84 12
           C 110 8, 136 15, 162 11
           C 180 8, 192 13, 194 12"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  )
}
