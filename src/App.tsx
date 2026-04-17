import { BrowserRouter, Routes, Route } from "react-router-dom"
import { lazy, Suspense } from "react"
import { Toaster } from "sonner"
import AuthProvider from "@/contexts/AuthContext"
import AccountProvider from "@/contexts/AccountContext"
import AdminProvider from "@/contexts/AdminContext"
import LandingPage from "@/pages/LandingPage"
import LoginPage from "@/pages/LoginPage"
import NotFound from "@/pages/NotFound"

// All authenticated / high-weight pages are lazy so a cold visit to the
// landing page doesn't pay for the builder, AI SDK, Supabase chain, or
// the editor's proposal section components up front.
const ProposalViewer = lazy(() => import("@/pages/ProposalViewer"))
const ProposalsDashboard = lazy(() => import("@/pages/ProposalsDashboard"))
const ProposalDetailPage = lazy(() => import("@/pages/ProposalDetailPage"))
const DeletedProposalsPage = lazy(() => import("@/pages/DeletedProposalsPage"))
const BuilderHome = lazy(() => import("@/pages/BuilderHome"))
const NewProposalRedirect = lazy(() => import("@/pages/NewProposalRedirect"))
const SettingsShell = lazy(() => import("@/pages/SettingsShell"))
const SignupPage = lazy(() => import("@/pages/SignupPage"))
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"))
const InviteAcceptPage = lazy(() => import("@/pages/InviteAcceptPage"))
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"))
const AccountTab = lazy(() => import("@/pages/settings/AccountTab"))
const TeamTab = lazy(() => import("@/pages/settings/TeamTab"))
const AdminShell = lazy(() => import("@/pages/admin/AdminShell"))
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"))
const AdminWaitlist = lazy(() => import("@/pages/admin/AdminWaitlist"))
const AdminInvites = lazy(() => import("@/pages/admin/AdminInvites"))
const AdminAccounts = lazy(() => import("@/pages/admin/AdminAccounts"))

function App() {
  return (
    <BrowserRouter>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { fontFamily: "inherit", fontSize: "13px" },
        }}
      />
      <Suspense fallback={null}>
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/invite/:token" element={<InviteAcceptPage />} />
          <Route path="/p/:slug" element={<ProposalViewer />} />

          {/* Authenticated but no account required */}
          <Route element={<AuthProvider />}>
            <Route path="/onboarding" element={<OnboardingPage />} />

            {/* Account-scoped */}
            <Route element={<AccountProvider />}>
              <Route path="/proposals" element={<ProposalsDashboard />} />
              <Route path="/proposals/deleted" element={<DeletedProposalsPage />} />
              <Route path="/proposals/:id" element={<ProposalDetailPage />} />
              <Route path="/builder" element={<BuilderHome />} />
              <Route path="/builder/new" element={<NewProposalRedirect />} />
              <Route path="/builder/:id" element={<BuilderHome />} />
              <Route path="/settings" element={<SettingsShell />}>
                <Route index element={<AccountTab />} />
                <Route path="team" element={<TeamTab />} />
              </Route>
            </Route>

            {/* Admin — gated by AdminProvider, not AccountProvider.
                Admins don't have to belong to an account. */}
            <Route element={<AdminProvider />}>
              <Route path="/admin" element={<AdminShell />}>
                <Route index element={<AdminDashboard />} />
                <Route path="waitlist" element={<AdminWaitlist />} />
                <Route path="invites" element={<AdminInvites />} />
                <Route path="accounts" element={<AdminAccounts />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
