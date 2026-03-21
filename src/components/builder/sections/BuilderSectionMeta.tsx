import { useBuilderStore } from "@/store/builderStore"
import BuilderField from "../BuilderField"

const BuilderSectionMeta = () => {
  const { proposal, updateField } = useBuilderStore()

  return (
    <div className="space-y-5">
      <h2 className="text-sm font-semibold text-foreground">Proposal details</h2>

      <BuilderField label="Title">
        <input
          type="text"
          value={proposal.title}
          onChange={(e) => updateField("title", e.target.value)}
          placeholder="Flush & Seawards — Shopify Migration"
          className="builder-input"
        />
      </BuilderField>

      <BuilderField label="Client name">
        <input
          type="text"
          value={proposal.clientName}
          onChange={(e) => updateField("clientName", e.target.value)}
          placeholder="Flush + Seawards"
          className="builder-input"
        />
      </BuilderField>

      <BuilderField label="Slug" hint="Used in the proposal URL: /p/your-slug">
        <input
          type="text"
          value={proposal.slug}
          onChange={(e) => updateField("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))}
          placeholder="flush-seawards"
          className="builder-input"
        />
      </BuilderField>

      <BuilderField label="CTA email">
        <input
          type="email"
          value={proposal.ctaEmail}
          onChange={(e) => updateField("ctaEmail", e.target.value)}
          placeholder="you@yourcompany.com"
          className="builder-input"
        />
      </BuilderField>

      <div className="grid grid-cols-2 gap-4">
        <BuilderField label="Brand color 1">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={proposal.brandColor1}
              onChange={(e) => updateField("brandColor1", e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
            />
            <input
              type="text"
              value={proposal.brandColor1}
              onChange={(e) => updateField("brandColor1", e.target.value)}
              className="builder-input flex-1 font-mono text-xs"
            />
          </div>
        </BuilderField>
        <BuilderField label="Brand color 2">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={proposal.brandColor2}
              onChange={(e) => updateField("brandColor2", e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-border bg-transparent"
            />
            <input
              type="text"
              value={proposal.brandColor2}
              onChange={(e) => updateField("brandColor2", e.target.value)}
              className="builder-input flex-1 font-mono text-xs"
            />
          </div>
        </BuilderField>
      </div>

      <hr className="border-border" />
      <h2 className="text-sm font-semibold text-foreground">Hero</h2>

      <BuilderField label="Tagline">
        <input
          type="text"
          value={proposal.tagline}
          onChange={(e) => updateField("tagline", e.target.value)}
          placeholder="Two stores. One platform."
          className="builder-input"
        />
      </BuilderField>

      <BuilderField label="Hero description">
        <textarea
          value={proposal.heroDescription}
          onChange={(e) => updateField("heroDescription", e.target.value)}
          rows={3}
          placeholder="A brief description shown under the tagline..."
          className="builder-input resize-none"
        />
      </BuilderField>

      <BuilderField label="Recommendation" hint="Our recommendation is to... (continues the phrase)">
        <textarea
          value={proposal.recommendation ?? ""}
          onChange={(e) => updateField("recommendation", e.target.value)}
          rows={4}
          placeholder="proceed with the Total package to ensure..."
          className="builder-input resize-none"
        />
      </BuilderField>
    </div>
  )
}

export default BuilderSectionMeta
