/**
 * AdminProvider — route guard for /admin/*
 *
 * Sits under AuthProvider (not AccountProvider — admins don't need to
 * belong to an account to use the admin view). Checks if the current
 * user is in public.proposl_admins via useIsAdmin(). Non-admins are
 * redirected to /proposals with no error noise.
 */

import { Navigate, Outlet } from "react-router-dom"
import { useIsAdmin } from "@/lib/useIsAdmin"

const AdminProvider = () => {
  const { loading, isAdmin } = useIsAdmin()

  // Don't flash while the admin check is in flight.
  if (loading) return null
  if (!isAdmin) return <Navigate to="/proposals" replace />

  return <Outlet />
}

export default AdminProvider
