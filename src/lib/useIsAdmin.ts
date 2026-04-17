/**
 * useIsAdmin — is the current user a Proposl admin?
 *
 * Queries public.proposl_admins for a row matching the session user's
 * email. The table has an RLS policy that only surfaces a user's own
 * admin row (if any), so this returns true/false with zero data leakage
 * for non-admins.
 *
 * Cached via module-level memo keyed by email so the check runs once
 * per session (not once per component mount).
 */

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"

const cache = new Map<string, boolean>()

export function useIsAdmin(): { loading: boolean; isAdmin: boolean } {
  const { session } = useAuth()
  const email = (session.user.email ?? "").toLowerCase()

  const [state, setState] = useState<{ loading: boolean; isAdmin: boolean }>(() => {
    const cached = cache.get(email)
    if (cached !== undefined) return { loading: false, isAdmin: cached }
    return { loading: true, isAdmin: false }
  })

  useEffect(() => {
    if (!email) {
      setState({ loading: false, isAdmin: false })
      return
    }
    const cached = cache.get(email)
    if (cached !== undefined) {
      setState({ loading: false, isAdmin: cached })
      return
    }

    let cancelled = false
    supabase
      .from("proposl_admins")
      .select("email")
      .eq("email", email)
      .maybeSingle()
      .then(({ data }) => {
        const isAdmin = !!data
        cache.set(email, isAdmin)
        if (!cancelled) setState({ loading: false, isAdmin })
      })

    return () => {
      cancelled = true
    }
  }, [email])

  return state
}
