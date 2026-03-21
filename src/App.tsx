import { BrowserRouter, Routes, Route } from "react-router-dom"
import ProposalViewer from "@/pages/ProposalViewer"
import ProposalsDashboard from "@/pages/ProposalsDashboard"
import BuilderHome from "@/pages/BuilderHome"
import NotFound from "@/pages/NotFound"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ProposalsDashboard />} />
        <Route path="/proposals" element={<ProposalsDashboard />} />
        <Route path="/builder" element={<BuilderHome />} />
        <Route path="/builder/:id" element={<BuilderHome />} />
        <Route path="/p/:slug" element={<ProposalViewer />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
