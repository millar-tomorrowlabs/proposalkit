import { useCallback } from "react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Trash2, Plus } from "lucide-react"
import { useBuilderStore } from "@/store/builderStore"
import type { SectionKey } from "@/types/proposal"

const SECTION_LABELS: Record<SectionKey, string> = {
  summary: "Summary",
  scope: "Scope",
  timeline: "Timeline",
  investment: "Investment",
  cta: "Next Steps",
}

const ALL_SECTIONS: SectionKey[] = ["summary", "scope", "timeline", "investment", "cta"]

const SortableItem = ({ id, onRemove }: { id: SectionKey; onRemove: (id: SectionKey) => void }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <span className="flex-1 text-xs font-medium">{SECTION_LABELS[id]}</span>
      {id !== "cta" && (
        <button
          onClick={() => onRemove(id)}
          className="text-muted-foreground hover:text-red-500 transition-colors"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

const SectionOrder = () => {
  const { proposal, updateField } = useBuilderStore()
  const sections = proposal.sections

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const oldIndex = sections.indexOf(active.id as SectionKey)
      const newIndex = sections.indexOf(over.id as SectionKey)
      if (oldIndex === -1 || newIndex === -1) return
      updateField("sections", arrayMove(sections, oldIndex, newIndex))
    },
    [sections, updateField]
  )

  const handleRemove = useCallback(
    (id: SectionKey) => {
      updateField("sections", sections.filter((s) => s !== id))
    },
    [sections, updateField]
  )

  const handleAdd = useCallback(
    (id: SectionKey) => {
      // Insert before CTA if it exists, otherwise append
      const ctaIndex = sections.indexOf("cta")
      if (ctaIndex >= 0) {
        const next = [...sections]
        next.splice(ctaIndex, 0, id)
        updateField("sections", next)
      } else {
        updateField("sections", [...sections, id])
      }
    },
    [sections, updateField]
  )

  const available = ALL_SECTIONS.filter((s) => !sections.includes(s))

  return (
    <div className="space-y-2">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sections} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {sections.map((id) => (
              <SortableItem key={id} id={id} onRemove={handleRemove} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {available.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {available.map((id) => (
            <button
              key={id}
              onClick={() => handleAdd(id)}
              className="flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              <Plus className="h-3 w-3" /> {SECTION_LABELS[id]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default SectionOrder
