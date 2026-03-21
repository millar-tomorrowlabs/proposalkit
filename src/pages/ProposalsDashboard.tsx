import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { Plus } from "lucide-react"

interface ProposalRow {
  id: string
  slug: string
  title: string
  client_name: string
  created_at: string
}

const ProposalsDashboard = () => {
  const [proposals, setProposals] = useState<ProposalRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("proposals")
        .select("id, slug, title, client_name, created_at")
        .order("created_at", { ascending: false })
      setProposals(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

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
          <Link
            to="/builder"
            className="flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:bg-foreground/80 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New proposal
          </Link>
        </div>

        <div className="mt-10">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : proposals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No proposals yet.</p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {proposals.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{p.client_name}</p>
                  </div>
                  <div className="flex items-center gap-3">
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ProposalsDashboard
