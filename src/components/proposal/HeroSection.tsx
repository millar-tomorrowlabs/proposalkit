import React from "react"
import { useScrollReveal } from "@/hooks/useScrollReveal"
import { ChevronDown } from "lucide-react"

interface HeroSectionProps {
  clientName: string
  heroImageUrl?: string
  clientLogoUrl?: string
  heroLogoLarge?: boolean
  tagline: string
  description: string
}

const HeroSection = ({ clientName, heroImageUrl, clientLogoUrl, heroLogoLarge, tagline, description }: HeroSectionProps) => {
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

        {showClientName && (
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

        <h1 data-field-path="tagline" className="font-serif text-3xl font-semibold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
          {tagline}
        </h1>

        <p data-field-path="heroDescription" className="mt-6 max-w-lg text-base leading-relaxed text-white/70 md:text-lg">
          {description}
        </p>

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
