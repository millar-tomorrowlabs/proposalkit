import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import AuthGuard from "@/components/AuthGuard"
import ProposalViewer from "@/pages/ProposalViewer"
import ProposalsDashboard from "@/pages/ProposalsDashboard"
import BuilderHome from "@/pages/BuilderHome"
import WizardPage from "@/pages/WizardPage"
import LoginPage from "@/pages/LoginPage"
import NotFound from "@/pages/NotFound"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/p/:slug" element={<ProposalViewer />} />

        {/* Protected */}
        <Route path="/" element={<AuthGuard><Navigate to="/proposals" replace /></AuthGuard>} />
        <Route path="/proposals" element={<AuthGuard><ProposalsDashboard /></AuthGuard>} />
        <Route path="/new" element={<AuthGuard><WizardPage /></AuthGuard>} />
        <Route path="/builder" element={<AuthGuard><BuilderHome /></AuthGuard>} />
        <Route path="/builder/:id" element={<AuthGuard><BuilderHome /></AuthGuard>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
