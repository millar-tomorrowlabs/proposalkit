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
        setProposal({ ...data, ...data.data } as ProposalData)
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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
