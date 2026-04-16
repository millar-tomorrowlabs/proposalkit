import { Monitor, Tablet, Smartphone } from "lucide-react"

export type Viewport = "desktop" | "tablet" | "mobile"

const VIEWPORT_WIDTHS: Record<Viewport, string | undefined> = {
  desktop: undefined,    // full width
  tablet: "768px",
  mobile: "375px",
}

interface ViewportSwitcherProps {
  viewport: Viewport
  onChange: (v: Viewport) => void
}

export { VIEWPORT_WIDTHS }

export default function ViewportSwitcher({ viewport, onChange }: ViewportSwitcherProps) {
  const items: { key: Viewport; icon: typeof Monitor; label: string }[] = [
    { key: "desktop", icon: Monitor, label: "Desktop" },
    { key: "tablet", icon: Tablet, label: "Tablet" },
    { key: "mobile", icon: Smartphone, label: "Mobile" },
  ]

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border p-0.5"
      style={{ borderColor: "var(--color-rule)" }}
    >
      {items.map(({ key, icon: Icon, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          title={label}
          className="flex items-center justify-center rounded-full p-1.5 transition-colors"
          style={{
            background: viewport === key ? "var(--color-forest)" : "transparent",
            color: viewport === key ? "var(--color-cream)" : "var(--color-ink-mute)",
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
