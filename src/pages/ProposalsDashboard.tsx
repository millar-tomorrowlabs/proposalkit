import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { Plus, Copy, Check, LogOut } from "lucide-react"

interface ProposalRow {
  id: string
  slug: string
  title: string
  client_name: string
  status: string | null
  created_at: string
}

const ProposalsDashboard = () => {
  const { userId } = useAuth()
  const [proposals, setProposals] = useState<ProposalRow[]>([])
  const [submissionCounts, setSubmissionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate("/login")
  }

  useEffect(() => {
    const load = async () => {
      const { data: proposalData } = await supabase
        .from("proposals")
        .select("id, slug, title, client_name, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })

      const rows = proposalData ?? []
      setProposals(rows)

      if (rows.length > 0) {
        const ids = rows.map((p) => p.id)
        const { data: subData } = await supabase
          .from("submissions")
          .select("proposal_id")
          .in("proposal_id", ids)

        const counts: Record<string, number> = {}
        ;(subData ?? []).forEach(({ proposal_id }) => {
          counts[proposal_id] = (counts[proposal_id] ?? 0) + 1
        })
        setSubmissionCounts(counts)
      }

      setLoading(false)
    }
    load()
  }, [])

  const copyLink = (slug: string, id: string) => {
    const url = `${window.location.origin}/p/${slug}`
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Tomorrow Studios
            </p>
            <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">
              Proposals
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
            <Link
              to="/new"
              className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/80 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New proposal
            </Link>
          </div>
        </div>

        <div className="mt-10">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : proposals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No proposals yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {proposals.map((p) => {
                const count = submissionCounts[p.id] ?? 0
                const copied = copiedId === p.id
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-5 py-4 gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === "sent"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : p.status === "viewed"
                            ? "bg-blue-500/10 text-blue-600"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {p.status === "sent" ? "Sent" : p.status === "viewed" ? "Viewed" : "Draft"}
                        </span>
                        {count > 0 && (
                          <span className="shrink-0 rounded-full bg-brand-1 px-2 py-0.5 text-xs font-medium text-white">
                            {count} {count === 1 ? "submission" : "submissions"}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{p.client_name}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <button
                        onClick={() => copyLink(p.slug, p.id)}
                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy proposal link"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-brand-1" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                        {copied ? "Copied!" : "Copy link"}
                      </button>
                      <Link
                        to={`/p/${p.slug}`}
                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        View
                      </Link>
                      <Link
                        to={`/builder/${p.id}`}
                        className="text-xs font-medium text-foreground hover:text-brand-1 transition-colors"
                      >
                        Edit
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProposalsDashboard
