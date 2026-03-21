import { useBuilderStore } from "@/store/builderStore"
import BuilderSectionMeta from "./sections/BuilderSectionMeta"
import BuilderSectionSummary from "./sections/BuilderSectionSummary"
import BuilderSectionScope from "./sections/BuilderSectionScope"
import BuilderSectionTimeline from "./sections/BuilderSectionTimeline"
import BuilderSectionInvestment from "./sections/BuilderSectionInvestment"
import BuilderSectionContext from "./sections/BuilderSectionContext"

const NAV_ITEMS = [
  { id: "meta", label: "Proposal" },
  { id: "summary", label: "Summary" },
  { id: "scope", label: "Scope" },
  { id: "timeline", label: "Timeline" },
  { id: "investment", label: "Investment" },
  { id: "context", label: "Context" },
] as const

const BuilderForm = () => {
  const { activeSection, setActiveSection } = useBuilderStore()

  return (
    <div className="flex h-full flex-col">
      {/* Section tabs */}
      <div className="flex shrink-0 gap-1 border-b border-border px-4 py-2 overflow-x-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveSection(item.id)}
            className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeSection === item.id
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Active section form */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeSection === "meta" && <BuilderSectionMeta />}
        {activeSection === "summary" && <BuilderSectionSummary />}
        {activeSection === "scope" && <BuilderSectionScope />}
        {activeSection === "timeline" && <BuilderSectionTimeline />}
        {activeSection === "investment" && <BuilderSectionInvestment />}
        {activeSection === "context" && <BuilderSectionContext />}
      </div>
    </div>
  )
}

export default BuilderForm
