import { useRef, useCallback, useLayoutEffect, createElement } from "react"
import { useBuilderPreview } from "@/contexts/BuilderPreviewContext"

interface InlineEditableProps {
  fieldPath: string
  value: string
  multiline?: boolean
  className?: string
  tag?: "p" | "h1" | "h2" | "h3" | "h4" | "span" | "li" | "div"
  placeholder?: string
}

const InlineEditable = ({
  fieldPath,
  value,
  multiline = false,
  className = "",
  tag = "p",
  placeholder,
}: InlineEditableProps) => {
  const { isEditable, updateAtPath } = useBuilderPreview()
  const ref = useRef<HTMLElement>(null)
  const committedRef = useRef(value)
  const isEditingRef = useRef(false)

  // Set content via DOM — React doesn't manage contentEditable content
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || isEditingRef.current) return
    el.innerText = value || ""
    committedRef.current = value
  }, [value])

  const handleFocus = useCallback(() => {
    isEditingRef.current = true
    const el = ref.current
    // Clear placeholder text on focus
    if (el && !committedRef.current && placeholder) {
      el.innerText = ""
      el.style.color = ""
    }
  }, [placeholder])

  const handleBlur = useCallback(() => {
    isEditingRef.current = false
    const el = ref.current
    if (!el) return
    const newValue = el.innerText.trim()
    if (newValue !== committedRef.current) {
      committedRef.current = newValue
      updateAtPath(fieldPath, newValue)
    }
    // Show placeholder if empty
    if (!newValue && placeholder) {
      el.innerText = placeholder
      el.style.color = "var(--color-muted-foreground)"
    }
  }, [fieldPath, updateAtPath, placeholder])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        const el = ref.current
        if (el) {
          el.innerText = committedRef.current || ""
          isEditingRef.current = false
          el.blur()
        }
      }
      if (e.key === "Enter" && !multiline) {
        e.preventDefault()
        ref.current?.blur()
      }
    },
    [multiline]
  )

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const text = e.clipboardData.getData("text/plain")
    document.execCommand("insertText", false, text)
  }, [])

  // Non-editable mode (client-facing proposal viewer)
  if (!isEditable) {
    return createElement(tag, { className, "data-field-path": fieldPath }, value)
  }

  // Editable mode (builder preview)
  // Don't pass children — content is managed via ref + useLayoutEffect
  return createElement(tag, {
    ref,
    className: `${className} outline-none cursor-text`,
    contentEditable: true,
    suppressContentEditableWarning: true,
    "data-field-path": fieldPath,
    "data-inline-editable": "true",
    onFocus: handleFocus,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    onPaste: handlePaste,
  })
}

export default InlineEditable
