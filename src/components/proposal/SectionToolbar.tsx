import { Plus, Trash2 } from "lucide-react"

interface SectionToolbarProps {
  /** Display label — a typed section's fixed label or a custom section's title. */
  label: string
  onAddAbove: () => void
  onAddBelow: () => void
  onRemove: () => void
  canRemove: boolean
  canAdd: boolean
}

const SectionToolbar = ({
  label,
  onAddAbove,
  onAddBelow,
  onRemove,
  canRemove,
  canAdd,
}: SectionToolbarProps) => {
  return (
    <div className="section-toolbar" contentEditable={false}>
      <div className="section-toolbar-inner">
        <span className="section-toolbar-label">{label}</span>
        {canAdd && (
          <>
            <div className="section-toolbar-divider" />
            <button
              className="section-toolbar-btn"
              onClick={(e) => { e.stopPropagation(); onAddAbove() }}
              title="Add section above"
            >
              <Plus className="h-3 w-3" />
              <span className="section-toolbar-btn-text">Above</span>
            </button>
            <button
              className="section-toolbar-btn"
              onClick={(e) => { e.stopPropagation(); onAddBelow() }}
              title="Add section below"
            >
              <Plus className="h-3 w-3" />
              <span className="section-toolbar-btn-text">Below</span>
            </button>
          </>
        )}
        {canRemove && (
          <>
            <div className="section-toolbar-divider" />
            <button
              className="section-toolbar-btn section-toolbar-btn-danger"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              title="Remove section"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default SectionToolbar
