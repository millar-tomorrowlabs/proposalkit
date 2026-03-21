import { useEffect, useRef } from "react"

export function useScrollReveal<T extends HTMLElement = HTMLDivElement>(
  threshold = 0.15
) {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("revealed")
          observer.unobserve(el)
        }
      },
      { threshold }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  return ref
}

export function useScrollRevealAll({
  selector = ".scroll-reveal",
  threshold = 0.15,
  disabled = false,
} = {}) {
  useEffect(() => {
    // In preview mode, reveal all elements immediately (no animation)
    if (disabled) {
      document.querySelectorAll(selector).forEach((el) => el.classList.add("revealed"))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed")
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold }
    )

    const elements = document.querySelectorAll(selector)
    elements.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [selector, threshold, disabled])
}
