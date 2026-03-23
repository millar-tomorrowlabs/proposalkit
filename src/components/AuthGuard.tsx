import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    // Get current session immediately
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    // Keep in sync if session changes (logout in another tab, token refresh, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Still checking — render nothing to avoid flash
  if (session === undefined) return null

  if (!session) return <Navigate to="/login" replace />

  return <>{children}</>
}

export default AuthGuard
