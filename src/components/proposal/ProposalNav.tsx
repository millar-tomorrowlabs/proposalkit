import { useState, useEffect } from "react"
import { Lock, Menu, X } from "lucide-react"
import type { SectionKey } from "@/types/proposal"

const sectionLabels: Record<SectionKey, string> = {
  summary: "Summary",
  scope: "Scope",
  timeline: "Timeline",
  investment: "Investment",
  cta: "Next Steps",
}

interface ProposalNavProps {
  sections: SectionKey[]
  studioName: string
}

const ProposalNav = ({ sections, studioName }: ProposalNavProps) => {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > window.innerHeight * 0.8)
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const navItems = sections.map((key) => ({
    label: sectionLabels[key],
    href: `#${key}`,
  }))

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-40 border-b backdrop-blur-md transition-colors duration-300 ${
        scrolled
          ? "border-border bg-background/90"
          : "border-white/10 bg-black/30"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
        <a
          href="#"
          className={`font-serif text-base font-medium tracking-tight transition-opacity hover:opacity-60 ${
            scrolled ? "text-foreground" : "text-white"
          }`}
        >
          {studioName}
        </a>

        <div className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-xs font-medium uppercase tracking-[0.15em] transition-colors ${
                scrolled
                  ? "text-muted-foreground hover:text-foreground"
                  : "text-white/60 hover:text-white"
              }`}
            >
              {item.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3 md:hidden">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`p-1 transition-colors ${
              scrolled ? "text-foreground" : "text-white"
            }`}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <div
          className={`hidden items-center gap-1.5 text-xs md:flex ${
            scrolled ? "text-muted-foreground" : "text-white/40"
          }`}
        >
          <Lock className="h-3 w-3" />
          Confidential
        </div>
      </div>

      {mobileOpen && (
        <div
          className={`border-t px-6 py-4 md:hidden ${
            scrolled
              ? "border-border bg-background/95"
              : "border-white/10 bg-black/80"
          }`}
        >
          <div className="flex flex-col gap-4">
            {navItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`text-sm font-medium uppercase tracking-[0.15em] transition-colors ${
                  scrolled
                    ? "text-muted-foreground hover:text-foreground"
                    : "text-white/70 hover:text-white"
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
          <div
            className={`mt-4 flex items-center gap-1.5 border-t pt-4 text-xs ${
              scrolled
                ? "border-border text-muted-foreground"
                : "border-white/10 text-white/40"
            }`}
          >
            <Lock className="h-3 w-3" />
            Confidential
          </div>
        </div>
      )}
    </nav>
  )
}

export default ProposalNav
