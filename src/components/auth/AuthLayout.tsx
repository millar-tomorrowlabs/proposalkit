/**
 * AuthLayout — shared wrapper for login / signup / reset / onboarding.
 *
 * Provides the Studio Editorial frame:
 *   - Nav with ProposlMark + wordmark (links to /)
 *   - Top-right link (usually "Sign in" / "Sign up" for the other side)
 *   - Centered content column
 *   - Cormorant eyebrow + headline
 *   - Satoshi body
 *   - Form slot (children)
 *   - Footer with Tomorrow Studios credit
 *
 * Keeps individual auth pages focused on the form logic, not the chrome.
 */

import { Link } from "react-router-dom"
import type { ReactNode } from "react"
import ProposlMark from "@/components/brand/ProposlMark"

interface Props {
  eyebrow?: string
  headline: string
  subhead?: string
  /** Right-side nav link. Usually "Sign in" or "Sign up". Optional. */
  topLinkLabel?: string
  topLinkTo?: string
  /** Narrower default width; override if needed (e.g. onboarding). */
  maxWidth?: number
  children: ReactNode
}

export default function AuthLayout({
  eyebrow,
  headline,
  subhead,
  topLinkLabel,
  topLinkTo,
  maxWidth = 440,
  children,
}: Props) {
  return (
    <div
      className="flex min-h-screen flex-col"
      style={{
        background: "var(--color-cream)",
        color: "var(--color-ink)",
        fontFamily: "var(--font-sans)",
      }}
    >
      {/* Nav */}
      <header className="mx-auto flex w-full max-w-[1200px] items-center justify-between px-6 pt-8 pb-6 md:px-10">
        <Link to="/" className="flex items-center gap-2.5" style={{ color: "var(--color-forest)" }}>
          <ProposlMark size={32} />
          <span
            className="text-[22px] leading-none"
            style={{
              fontFamily: "var(--font-merchant-display)",
              fontWeight: 500,
              letterSpacing: "-0.01em",
            }}
          >
            proposl
          </span>
        </Link>
        {topLinkLabel && topLinkTo && (
          <Link
            to={topLinkTo}
            className="text-[13px] transition-colors hover:opacity-70"
            style={{ color: "var(--color-ink-soft)" }}
          >
            {topLinkLabel}
          </Link>
        )}
      </header>

      {/* Main content */}
      <main className="flex flex-1 items-center justify-center px-6 py-12 md:px-10">
        <div className="w-full" style={{ maxWidth: `${maxWidth}px` }}>
          {eyebrow && (
            <p
              className="mb-4 text-[11px] uppercase tracking-[0.18em]"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-ink-mute)",
              }}
            >
              {eyebrow}
            </p>
          )}
          <h1
            className="text-[36px] leading-[1.1] tracking-[-0.015em] md:text-[44px]"
            style={{
              fontFamily: "var(--font-merchant-display)",
              fontWeight: 500,
              color: "var(--color-ink)",
            }}
          >
            {headline}
          </h1>
          {subhead && (
            <p
              className="mt-4 text-[15px] leading-[1.55]"
              style={{ color: "var(--color-ink-soft)" }}
            >
              {subhead}
            </p>
          )}
          <div className="mt-10">{children}</div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className="border-t px-6 py-8 md:px-10"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-center">
          <p
            className="text-[11px] uppercase tracking-[0.14em]"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-ink-mute)",
            }}
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
        </div>
      </footer>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthField — shared styled input wrapper used by all auth forms
// ─────────────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string
  children: ReactNode
}

export function AuthField({ label, children }: FieldProps) {
  return (
    <label className="block space-y-1.5">
      <span
        className="text-[11px] uppercase tracking-[0.14em]"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink-mute)",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  )
}

// Input with the cream-paper shared look
export function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-lg border bg-white/50 px-4 py-3 text-[14px] outline-none transition-colors focus:border-[var(--color-forest)]"
      style={{
        borderColor: "var(--color-rule)",
        color: "var(--color-ink)",
        ...props.style,
      }}
    />
  )
}

// Primary CTA button
export function AuthButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-medium transition-transform hover:scale-[1.01] disabled:opacity-50 disabled:hover:scale-100"
      style={{
        background: "var(--color-forest)",
        color: "var(--color-cream)",
      }}
    >
      {children}
    </button>
  )
}
