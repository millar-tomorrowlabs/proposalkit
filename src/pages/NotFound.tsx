import { Link } from "react-router-dom"
import ProposlMark from "@/components/brand/ProposlMark"

const NotFound = () => {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6 px-6"
      style={{ background: "var(--color-cream)", color: "var(--color-ink)" }}
    >
      <Link to="/" className="mb-4">
        <ProposlMark />
      </Link>
      <p
        className="text-[11px] uppercase tracking-[0.14em]"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
      >
        404
      </p>
      <h1
        className="text-center text-[36px] leading-[1.1] tracking-[-0.01em]"
        style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
      >
        Page not found.
      </h1>
      <Link
        to="/proposals"
        className="mt-2 inline-block text-[13px] font-medium transition-colors hover:opacity-70"
        style={{ color: "var(--color-forest)" }}
      >
        Back to proposals
      </Link>
    </div>
  )
}

export default NotFound
