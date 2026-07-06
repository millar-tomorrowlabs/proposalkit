import type { CustomSection } from "@/types/proposal"
import InlineEditable from "./InlineEditable"

interface CustomSectionBlockProps {
  section: CustomSection
  /** Index into proposal.customSections — the InlineEditable field paths
   * are positional (customSections.N.title / .body). */
  index: number
}

/**
 * Free-form proposal section: an editable title and a plain-text body.
 * The body renders whitespace-pre-wrap so imported/verbatim content keeps
 * its line structure in both the builder and the client view.
 */
const CustomSectionBlock = ({ section, index }: CustomSectionBlockProps) => {
  return (
    <section id={section.id} className="px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <InlineEditable
          fieldPath={`customSections.${index}.title`}
          value={section.title}
          tag="h2"
          className="scroll-reveal font-display text-5xl font-semibold leading-[1.05] tracking-tight text-foreground md:text-7xl lg:text-8xl"
          placeholder="Section title"
        />
        <InlineEditable
          fieldPath={`customSections.${index}.body`}
          value={section.body}
          multiline
          tag="div"
          className="scroll-reveal delay-100 mt-10 whitespace-pre-wrap text-base leading-relaxed text-foreground"
          placeholder="Write the section content..."
        />
      </div>
    </section>
  )
}

export default CustomSectionBlock
