/**
 * WaitlistForm — email capture for the landing page while Proposl is in
 * invite-only beta.
 *
 * Hits the submit-waitlist edge function (anon-permitted). Dedupes on
 * lowercased email server-side, so repeat submissions show the same
 * "you're on the list" confirmation instead of an error.
 *
 * Two sizes: "hero" is the big prominent one on the top of the page,
 * "compact" is the smaller inline one we render inside the bottom CTA
 * block. Both share the same submission logic.
 */

import { useState } from "react"
import { supabase } from "@/lib/supabase"

interface WaitlistFormProps {
  variant?: "hero" | "compact"
  autoFocus?: boolean
}

export default function WaitlistForm({ variant = "hero", autoFocus = false }: WaitlistFormProps) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) return
    setStatus("submitting")
    setErrorMsg(null)
    try {
      const { data, error } = await supabase.functions.invoke("submit-waitlist", {
        body: { email: trimmed },
      })
      if (error) {
        setStatus("error")
        setErrorMsg(error.message || "Something went wrong. Please try again.")
        return
      }
      if (data?.error) {
        setStatus("error")
        setErrorMsg(data.error)
        return
      }
      setStatus("success")
    } catch (err) {
      setStatus("error")
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.")
    }
  }

  // ── Success state ─────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <div className={variant === "hero" ? "mx-auto max-w-[440px] text-center" : "text-center"}>
        <p
          className="text-[13px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-forest)" }}
        >
          You're on the list.
        </p>
        <p
          className="mt-3 text-[14px] leading-[1.55]"
          style={{ color: "var(--color-ink-soft)" }}
        >
          We're letting new studios in a handful at a time. You'll hear from us directly when your invite is ready.
        </p>
      </div>
    )
  }

  const inputClass =
    variant === "hero"
      ? "w-full flex-1 rounded-full border bg-white/60 px-5 py-3.5 text-[15px] outline-none transition-colors focus:border-[var(--color-forest)]"
      : "w-full flex-1 rounded-full border bg-white/60 px-4 py-3 text-[14px] outline-none transition-colors focus:border-[var(--color-forest)]"

  const buttonClass =
    variant === "hero"
      ? "rounded-full px-7 py-3.5 text-[14px] font-medium transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
      : "rounded-full px-6 py-3 text-[13px] font-medium transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"

  return (
    <form
      onSubmit={handleSubmit}
      className={variant === "hero" ? "mx-auto max-w-[520px]" : "mx-auto max-w-[440px]"}
    >
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          required
          autoFocus={autoFocus}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={status === "submitting"}
          placeholder="you@studio.com"
          className={inputClass}
          style={{ borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
        />
        <button
          type="submit"
          disabled={status === "submitting" || !email.trim()}
          className={buttonClass}
          style={{
            background: "var(--color-forest)",
            color: "var(--color-cream)",
          }}
        >
          {status === "submitting" ? "Sending..." : "Request access"}
        </button>
      </div>
      {errorMsg && (
        <p
          className="mt-3 text-[12px]"
          style={{ color: "#A33B28" }}
        >
          {errorMsg}
        </p>
      )}
      <p
        className="mt-4 text-center text-[11px] uppercase tracking-[0.14em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
      >
        INVITE-ONLY BETA · WE'LL EMAIL WHEN YOUR SPOT OPENS
      </p>
    </form>
  )
}
