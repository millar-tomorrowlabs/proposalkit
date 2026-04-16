/**
 * NewProposalRedirect — /builder/new
 *
 * Creates an empty proposal row in Supabase with the account's defaults,
 * then redirects to /builder/:id. The builder itself handles the "empty
 * proposal" state and shows an intake hero over the document.
 *
 * This replaces the old IntakePage (a separate wizard-style flow). The
 * unified model means there's only one chat thread, one URL, one document.
 * Matches the Lovable/v0 pattern where you never leave the editor.
 */

import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { v4 as uuidv4 } from "uuid"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import { useAccount } from "@/contexts/AccountContext"

export default function NewProposalRedirect() {
  const { userId } = useAuth()
  const { account } = useAccount()
  const navigate = useNavigate()
  // Guard against React's strict-mode double-invoke creating two proposals.
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const createAndRedirect = async () => {
      const id = uuidv4()
      const slug = id.slice(0, 8)
      const nowIso = new Date().toISOString()

      const { error } = await supabase.from("proposals").insert({
        id,
        account_id: account.id,
        user_id: userId,
        slug,
        title: "Untitled proposal",
        client_name: "",
        brand_color_1: account.defaultBrandColor1 || "#000000",
        brand_color_2: account.defaultBrandColor2 || "#6b7280",
        cta_email: account.defaultCtaEmail || "",
        status: "draft",
        sections: ["summary", "scope", "timeline", "investment", "cta"],
        // Store minimal nested data. The builder's auto-save will backfill
        // the full ProposalData shape once the user starts editing.
        data: {
          id,
          slug,
          title: "Untitled proposal",
          clientName: "",
          brandColor1: account.defaultBrandColor1 || "#000000",
          brandColor2: account.defaultBrandColor2 || "#6b7280",
          tagline: "",
          heroDescription: "",
          ctaEmail: account.defaultCtaEmail || "",
          sections: ["summary", "scope", "timeline", "investment", "cta"],
          createdAt: nowIso,
          updatedAt: nowIso,
          summary: {
            studioTagline: "",
            studioDescription: "",
            studioDescription2: "",
            projectOverview: "",
            projectDetail: "",
            pillarsTagline: "",
            pillars: [],
          },
          scope: { outcomes: [], responsibilities: [] },
          timeline: { subtitle: "", phases: [] },
          investment: { packages: [], addOnCategories: [], addOns: [] },
        },
      })

      if (error) {
        toast.error("Could not create proposal. Try again.")
        navigate("/proposals")
        return
      }

      navigate(`/builder/${id}`, { replace: true })
    }

    createAndRedirect()
  }, [userId, account.id, account.defaultBrandColor1, account.defaultBrandColor2, account.defaultCtaEmail, navigate])

  // Render nothing during the brief redirect window.
  return null
}
