import { useScrollReveal } from "@/hooks/useScrollReveal"
import { ChevronDown } from "lucide-react"

interface HeroSectionProps {
  clientName: string
  heroImageUrl: string
  tagline: string
  description: string
}

const HeroSection = ({ clientName, heroImageUrl, tagline, description }: HeroSectionProps) => {
  const ref = useScrollReveal()

  return (
    <section className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0">
        <img
          src={heroImageUrl}
          alt={clientName}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>

      <div
        ref={ref}
        className="scroll-reveal relative flex min-h-screen flex-col items-center justify-center px-6 text-center"
      >
        <p className="mb-6 text-xs font-medium uppercase tracking-[0.35em] text-white/60">
          Prepared for
        </p>

        <div className="mb-12 flex flex-col items-center gap-2 md:flex-row md:items-baseline md:gap-4">
          {clientName.split("+").map((name, i, arr) => (
            <>
              <span
                key={name}
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
            </>
          ))}
        </div>

        <h1 className="font-serif text-3xl font-semibold leading-[1.1] tracking-tight text-white md:text-5xl lg:text-6xl">
          {tagline}
        </h1>

        <p className="mt-6 max-w-lg text-base leading-relaxed text-white/70 md:text-lg">
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
