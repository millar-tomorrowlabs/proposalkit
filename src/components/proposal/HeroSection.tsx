import React from "react"
import { useScrollReveal } from "@/hooks/useScrollReveal"
import { ChevronDown } from "lucide-react"
import InlineEditable from "./InlineEditable"
import AskAIGhost from "./AskAIGhost"

interface HeroSectionProps {
  clientName: string
  heroImageUrl?: string
  clientLogoUrl?: string
  heroLogoLarge?: boolean
  tagline: string
  description: string
  /** When true and no heroImageUrl yet, render a branded loading state. */
  imageLoading?: boolean
}

const HeroSection = ({ clientName, heroImageUrl, clientLogoUrl, heroLogoLarge, tagline, description, imageLoading }: HeroSectionProps) => {
  const ref = useScrollReveal()

  // Large logo mode: show logo prominently, hide client name text
  const showLargeLogo = heroLogoLarge && clientLogoUrl
  const showClientName = !showLargeLogo

  return (
    <section className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        {heroImageUrl ? (
          <>
            <img
              src={heroImageUrl}
              alt={clientName}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40" />
          </>
        ) : imageLoading ? (
          <HeroImageSkeleton />
        ) : (
          <div
            className="h-full w-full"
            style={{ background: "linear-gradient(135deg, var(--brand-1) 0%, var(--brand-2) 100%)" }}
          />
        )}
      </div>

      <div
        ref={ref}
        className="scroll-reveal relative flex min-h-screen flex-col items-center justify-center px-6 text-center"
      >
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.35em] text-white/60">
          Prepared for
        </p>

        {/* Large logo mode — replaces client name entirely */}
        {showLargeLogo && (
          <img
            src={clientLogoUrl}
            alt={clientName}
            className="mb-12 h-16 w-auto object-contain opacity-90 md:h-24"
          />
        )}

        {/* Small logo + client name mode */}
        {!showLargeLogo && clientLogoUrl && (
          <img
            src={clientLogoUrl}
            alt={clientName}
            className="mb-6 h-10 w-auto object-contain opacity-90 md:h-12"
          />
        )}

        {showClientName && clientName && (
          <div data-field-path="clientName" className="mb-12 flex flex-col items-center gap-2 md:flex-row md:items-baseline md:gap-4">
            {clientName.split("+").map((name, i, arr) => (
              <React.Fragment key={name}>
                <span
                  className={`font-merchant-display text-3xl tracking-wide text-white md:text-5xl ${
                    i === 0 ? "font-semibold" : "font-light"
                  }`}
                >
                  {name.trim().toUpperCase()}
                </span>
                {i < arr.length - 1 && (
                  <span
                    key={`sep-${i}`}
                    className="self-center text-xl font-light text-white/30 md:text-3xl"
                  >
                    +
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        <InlineEditable
          fieldPath="tagline"
          value={tagline}
          tag="h1"
          className="font-serif text-3xl font-semibold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl"
        />
        <AskAIGhost value={tagline} prompt="Write a compelling tagline for this proposal. Short, confident, and client-focused. Never use em dashes." />

        <InlineEditable
          fieldPath="heroDescription"
          value={description}
          multiline
          tag="p"
          className="mt-6 max-w-lg text-base leading-relaxed text-white/70 md:text-lg"
        />
        <AskAIGhost value={description} prompt="Write a 1 to 2 sentence hero description for this proposal. Summarize what the project delivers for the client. Never use em dashes." />

        <div className="mt-10 flex items-center gap-3">
          <div className="h-1 w-12 rounded-full bg-brand-1" />
          <div className="h-1 w-12 rounded-full bg-brand-2" />
        </div>
      </div>

      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-gentle-bounce">
        <ChevronDown className="h-5 w-5 text-white/50" />
      </div>
    </section>
  )
}

export default HeroSection

/**
 * Branded loading state shown while /api/hero-image is being fetched in the
 * builder. Kept inside this file so it travels with the hero. Uses the
 * Studio Editorial palette tokens (cream/ink) plus a soft shimmer, paired
 * with small mono caption text so it reads as "intentional" rather than
 * "something broke".
 */
function HeroImageSkeleton() {
  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: "var(--color-cream)" }}>
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background:
            "linear-gradient(110deg, transparent 10%, rgba(255,255,255,0.4) 30%, transparent 50%)",
          backgroundSize: "200% 100%",
          animation: "hero-shimmer 2.4s ease-in-out infinite",
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 30%, rgba(0,0,0,0.04) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(0,0,0,0.04) 0%, transparent 40%)",
        }}
      />
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2.5">
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--color-ink-mute)", animation: "hero-dot 1.4s ease-in-out infinite" }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.18em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          Finding an image
        </span>
      </div>
      <style>{`
        @keyframes hero-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes hero-dot {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
