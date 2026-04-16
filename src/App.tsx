import { BrowserRouter, Routes, Route } from "react-router-dom"
import { lazy, Suspense } from "react"
import { Toaster } from "sonner"
import AuthProvider from "@/contexts/AuthContext"
import AccountProvider from "@/contexts/AccountContext"
import ProposalViewer from "@/pages/ProposalViewer"
import ProposalsDashboard from "@/pages/ProposalsDashboard"
import ProposalDetailPage from "@/pages/ProposalDetailPage"
import DeletedProposalsPage from "@/pages/DeletedProposalsPage"
import BuilderHome from "@/pages/BuilderHome"
import IntakePage from "@/pages/IntakePage"
import LoginPage from "@/pages/LoginPage"
import LandingPage from "@/pages/LandingPage"
import NotFound from "@/pages/NotFound"
import SettingsShell from "@/pages/SettingsShell"

// Lazy-load pages that are not needed on initial load
const SignupPage = lazy(() => import("@/pages/SignupPage"))
const OnboardingPage = lazy(() => import("@/pages/OnboardingPage"))
const InviteAcceptPage = lazy(() => import("@/pages/InviteAcceptPage"))
const ResetPasswordPage = lazy(() => import("@/pages/ResetPasswordPage"))
const AccountTab = lazy(() => import("@/pages/settings/AccountTab"))
const TeamTab = lazy(() => import("@/pages/settings/TeamTab"))

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
              <Route path="/builder/new" element={<IntakePage />} />
              <Route path="/builder/:id" element={<BuilderHome />} />
              <Route path="/settings" element={<SettingsShell />}>
                <Route index element={<AccountTab />} />
                <Route path="team" element={<TeamTab />} />
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
