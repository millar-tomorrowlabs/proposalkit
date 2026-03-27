import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import AuthProvider from "@/contexts/AuthContext"
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
        <Route element={<AuthProvider />}>
          <Route path="/" element={<Navigate to="/proposals" replace />} />
          <Route path="/proposals" element={<ProposalsDashboard />} />
          <Route path="/new" element={<WizardPage />} />
          <Route path="/builder" element={<BuilderHome />} />
          <Route path="/builder/:id" element={<BuilderHome />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
