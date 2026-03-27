import { createContext, useContext, useEffect, useState } from "react"
import { Outlet, Navigate } from "react-router-dom"
import type { Session } from "@supabase/supabase-js"
import { supabase } from "@/lib/supabase"

interface AuthContextValue {
  userId: string
  session: Session
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}

const AuthProvider = () => {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Still checking — render nothing to avoid flash
  if (session === undefined) return null

  if (!session) return <Navigate to="/login" replace />

  return (
    <AuthContext.Provider value={{ userId: session.user.id, session }}>
      <Outlet />
    </AuthContext.Provider>
  )
}

export default AuthProvider
