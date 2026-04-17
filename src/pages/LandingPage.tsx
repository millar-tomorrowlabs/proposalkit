/**
 * Landing page — V1 (Studio Editorial design language).
 *
 * Sections:
 *   1. Nav
 *   2. Hero
 *   3. Value props (three)
 *   4. How it works (four steps)
 *   5. CTA block
 *   6. Footer
 *
 * Signed-in users hitting `/` are redirected to `/proposals`.
 * Everyone else sees the page.
 */

import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import ProposlMark from "@/components/brand/ProposlMark"
import HandDrawnUnderline from "@/components/brand/HandDrawnUnderline"
import WaitlistForm from "@/components/landing/WaitlistForm"

export default function LandingPage() {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  // Gate: authed users redirect to /proposals
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate("/proposals", { replace: true })
      } else {
        setChecking(false)
      }
    })
  }, [navigate])

  // Avoid flash of landing page for authed users while we check
  if (checking) {
    return <div className="min-h-screen" style={{ background: "var(--color-cream)" }} />
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "var(--color-cream)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-sans)",
      }}
    >
      <Nav />
      <Hero />
      <ValueProps />
      <HowItWorks />
      <CTABlock />
      <Footer />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav
// ─────────────────────────────────────────────────────────────────────────────

function Nav() {
  // Anchor-scroll to #request-access lands the div at the top of the
  // viewport, which leaves the hero's big bottom padding as an awkward
  // blank strip below the form. Center the form vertically and focus
  // the input so the user can immediately type.
  const handleRequestAccess = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault()
    const target = document.getElementById("request-access")
    if (!target) return
    target.scrollIntoView({ behavior: "smooth", block: "center" })
    const input = target.querySelector<HTMLInputElement>('input[type="email"]')
    if (input) {
      // Delay focus until after the smooth scroll completes, so the
      // browser doesn't cancel the animation by snapping to the input.
      window.setTimeout(() => input.focus({ preventScroll: true }), 500)
    }
  }

  return (
    <header className="mx-auto flex max-w-[1200px] items-center justify-between px-6 pt-8 pb-6 md:px-10">
      <Link to="/" className="flex items-center gap-2.5" style={{ color: "var(--color-forest)" }}>
        <ProposlMark size={32} />
        <span
          className="text-[22px] leading-none"
          style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500, letterSpacing: "-0.01em" }}
        >
          proposl
        </span>
      </Link>
      <nav className="flex items-center gap-5">
        <Link
          to="/login"
          className="text-[14px] transition-colors hover:opacity-70"
          style={{ color: "var(--color-ink-soft)" }}
        >
          Sign in
        </Link>
        <a
          href="#request-access"
          onClick={handleRequestAccess}
          className="rounded-full px-5 py-2.5 text-[13px] font-medium transition-transform hover:scale-[1.02]"
          style={{
            background: "var(--color-forest)",
            color: "var(--color-cream)",
          }}
        >
          Request access
        </a>
      </nav>
    </header>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="mx-auto max-w-[1000px] px-6 pt-20 pb-28 text-center md:px-10 md:pt-28 md:pb-40">
      <h1
        className="mx-auto max-w-[18ch] text-[44px] leading-[1.08] tracking-[-0.015em] md:text-[64px] lg:text-[76px]"
        style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500, color: "var(--color-ink)" }}
      >
        The first proposal you'll actually{" "}
        <span className="relative inline-block" style={{ color: "var(--color-forest)" }}>
          enjoy
          <HandDrawnUnderline
            className="absolute left-[-4%] right-[-4%] -bottom-[10%] h-[0.3em] w-[108%]"
            // forest color inherited from parent span via currentColor
          />
        </span>{" "}
        making.
      </h1>

      <p
        className="mx-auto mt-8 max-w-[540px] text-[17px] leading-[1.55] md:text-[19px]"
        style={{ color: "var(--color-ink-soft)" }}
      >
        A proposal tool for freelancers and small studios who want to spend less time writing and more time making.
      </p>

      <div className="mt-12" id="request-access">
        <WaitlistForm variant="hero" />
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Value props
// ─────────────────────────────────────────────────────────────────────────────

const VALUE_PROPS = [
  {
    label: "01 · WRITE",
    title: "Write less. Send more.",
    body: "Paste your discovery notes, call transcripts, or a client's website. Proposl drafts the whole thing in about 60 seconds. You spend your time refining, not writing from scratch.",
  },
  {
    label: "02 · DESIGN",
    title: "Look incredible.",
    body: "Every proposal is branded to you. Custom colors, typography, and a client-facing view that looks like a magazine, not a PDF. No more sending Word docs with your logo in the corner.",
  },
  {
    label: "03 · TRACK",
    title: "Know what happened.",
    body: "See when your proposal was opened, how many times, and whether they clicked through. No guessing. No follow-up-to-check-they-saw-it emails.",
  },
]

function ValueProps() {
  return (
    <section
      className="border-t px-6 py-24 md:px-10 md:py-32"
      style={{ borderColor: "var(--color-rule)" }}
    >
      <div className="mx-auto max-w-[1100px]">
        <p
          className="mb-14 text-[11px] uppercase tracking-[0.18em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          WHAT IT DOES
        </p>
        <div className="grid gap-16 md:grid-cols-3 md:gap-10">
          {VALUE_PROPS.map((vp) => (
            <div key={vp.label}>
              <p
                className="mb-5 text-[11px] uppercase tracking-[0.14em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--color-forest)" }}
              >
                {vp.label}
              </p>
              <h3
                className="mb-4 text-[28px] leading-[1.1] tracking-[-0.01em]"
                style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500, color: "var(--color-ink)" }}
              >
                {vp.title}
              </h3>
              <p className="text-[15px] leading-[1.6]" style={{ color: "var(--color-ink-soft)" }}>
                {vp.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// How it works
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    title: "Paste context",
    body: "Drop in call notes, discovery docs, or the client's website. Whatever you've got.",
  },
  {
    n: "02",
    title: "Generate",
    body: "Claude reads everything and drafts your proposal in about 60 seconds.",
  },
  {
    n: "03",
    title: "Refine",
    body: "Edit anything inline or ask the AI to rewrite a section. Tweak the investment. Set the tone.",
  },
  {
    n: "04",
    title: "Send and track",
    body: "One click to email it. Watch as it gets opened, read, and clicked.",
  },
]

function HowItWorks() {
  return (
    <section
      className="border-t px-6 py-24 md:px-10 md:py-32"
      style={{
        borderColor: "var(--color-rule)",
        background: "var(--color-paper)",
      }}
    >
      <div className="mx-auto max-w-[900px]">
        <p
          className="mb-14 text-[11px] uppercase tracking-[0.18em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          HOW IT WORKS
        </p>
        <h2
          className="mb-16 max-w-[16ch] text-[36px] leading-[1.1] tracking-[-0.01em] md:text-[52px]"
          style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500, color: "var(--color-ink)" }}
        >
          From blank page to sent in under five minutes.
        </h2>
        <div className="space-y-14">
          {STEPS.map((step) => (
            <div key={step.n} className="grid grid-cols-[auto_1fr] gap-x-8 md:grid-cols-[80px_1fr] md:gap-x-12">
              <p
                className="pt-2 text-[11px] uppercase tracking-[0.14em]"
                style={{ fontFamily: "var(--font-mono)", color: "var(--color-forest)" }}
              >
                STEP {step.n}
              </p>
              <div>
                <h3
                  className="mb-2 text-[24px] leading-[1.2] tracking-[-0.01em] md:text-[28px]"
                  style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500, color: "var(--color-ink)" }}
                >
                  {step.title}
                </h3>
                <p
                  className="max-w-[44ch] text-[15px] leading-[1.6] md:text-[16px]"
                  style={{ color: "var(--color-ink-soft)" }}
                >
                  {step.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CTA block
// ─────────────────────────────────────────────────────────────────────────────

function CTABlock() {
  return (
    <section
      className="border-t px-6 py-28 text-center md:px-10 md:py-36"
      style={{ borderColor: "var(--color-rule)" }}
    >
      <div className="mx-auto max-w-[700px]">
        <h2
          className="mx-auto mb-6 max-w-[14ch] text-[40px] leading-[1.1] tracking-[-0.015em] md:text-[60px]"
          style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500, color: "var(--color-ink)" }}
        >
          Ready to stop dreading proposals?
        </h2>
        <p
          className="mx-auto mb-10 max-w-[460px] text-[16px] leading-[1.55] md:text-[18px]"
          style={{ color: "var(--color-ink-soft)" }}
        >
          Proposl is in invite-only beta. Drop your email and we'll get in touch when your spot opens.
        </p>
        <WaitlistForm variant="compact" />
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer
      className="border-t px-6 py-14 md:px-10"
      style={{ borderColor: "var(--color-rule)" }}
    >
      <div className="mx-auto flex max-w-[1200px] flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2.5" style={{ color: "var(--color-forest)" }}>
          <ProposlMark size={24} />
          <span
            className="text-[18px] leading-none"
            style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500, letterSpacing: "-0.01em" }}
          >
            proposl
          </span>
        </div>
        <p
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          MADE BY{" "}
          <a
            href="https://tomorrowstudios.io"
            target="_blank"
            rel="noreferrer"
            className="underline-offset-4 transition-colors hover:underline"
            style={{ color: "var(--color-ink-soft)" }}
          >
            TOMORROW STUDIOS
          </a>
          {" · VANCOUVER"}
        </p>
        <p
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          © 2026 TOMORROW LABS INC.
        </p>
      </div>
    </footer>
  )
}
