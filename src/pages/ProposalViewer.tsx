import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import ProposalWrapper from "@/components/proposal/ProposalWrapper"
import type { ProposalData } from "@/types/proposal"

// Temporary: seed data fallback while builder UI isn't built yet
import { flushProposal } from "@/data/seeds/flush"

const SEEDS: Record<string, ProposalData> = {
  flush: flushProposal,
}

const ProposalViewer = () => {
  const { slug } = useParams<{ slug: string }>()
  const [proposal, setProposal] = useState<ProposalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Password gate
  const [needsPassword, setNeedsPassword] = useState(false)
  const [passwordVerified, setPasswordVerified] = useState(false)
  const [passwordInput, setPasswordInput] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [proposalId, setProposalId] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return

    const load = async () => {
      // Try Supabase first
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("slug", slug)
        .single()

      if (data && !error) {
        setProposalId(data.id)

        // Check password protection
        if (data.password_hash) {
          const pwKey = `pw_${data.id}`
          if (sessionStorage.getItem(pwKey)) {
            setPasswordVerified(true)
          } else {
            setNeedsPassword(true)
            setLoading(false)
            return
          }
        }

        setProposal({ ...data, ...data.data } as ProposalData)

        // Track view (fire-and-forget, once per session)
        if (data.status === "sent") {
          const viewKey = `viewed_${data.id}`
          if (!sessionStorage.getItem(viewKey)) {
            sessionStorage.setItem(viewKey, "1")
            fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-view`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ proposalId: data.id }),
            }).catch(() => {}) // swallow errors — fire and forget
          }
        }
      } else if (SEEDS[slug]) {
        // Fall back to seed data
        setProposal(SEEDS[slug])
      } else {
        setError("Proposal not found")
      }

      setLoading(false)
    }

    load()
  }, [slug])

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordInput.trim() || !proposalId) return
    setVerifying(true)
    setPasswordError("")

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-proposal-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ proposalId, password: passwordInput }),
        }
      )
      const result = await res.json()

      if (result.access) {
        sessionStorage.setItem(`pw_${proposalId}`, "1")
        setPasswordVerified(true)
        setNeedsPassword(false)

        // Now load the proposal
        setLoading(true)
        const { data } = await supabase
          .from("proposals")
          .select("*")
          .eq("id", proposalId)
          .single()

        if (data) {
          setProposal({ ...data, ...data.data } as ProposalData)

          // Track view
          if (data.status === "sent") {
            const viewKey = `viewed_${data.id}`
            if (!sessionStorage.getItem(viewKey)) {
              sessionStorage.setItem(viewKey, "1")
              fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-view`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ proposalId: data.id }),
              }).catch(() => {})
            }
          }
        }
        setLoading(false)
      } else {
        setPasswordError("Incorrect password")
      }
    } catch {
      setPasswordError("Something went wrong. Please try again.")
    }
    setVerifying(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  // Password gate
  if (needsPassword && !passwordVerified) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <svg className="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="font-serif text-2xl font-light tracking-tight text-foreground">
            This proposal is protected
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter the password to view this proposal.
          </p>
          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-3">
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full rounded-lg border border-border bg-white px-4 py-3 text-sm text-foreground outline-none focus:border-foreground/30 transition-colors"
            />
            {passwordError && (
              <p className="text-sm text-red-600">{passwordError}</p>
            )}
            <button
              type="submit"
              disabled={verifying || !passwordInput.trim()}
              className="w-full rounded-full bg-foreground px-4 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "View proposal"}
            </button>
          </form>
        </div>
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">{error ?? "Proposal not found"}</p>
      </div>
    )
  }

  return <ProposalWrapper proposal={proposal} />
}

export default ProposalViewer
