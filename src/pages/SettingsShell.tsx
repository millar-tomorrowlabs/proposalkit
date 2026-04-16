/**
 * Settings shell — /settings
 *
 * Shared layout with horizontal tabs: Account | Team.
 * Styled in Studio Editorial. Extensible for future tabs.
 */

import { NavLink, Outlet, Link } from "react-router-dom"
import ProposlMark from "@/components/brand/ProposlMark"

const tabs = [
  { label: "Account", to: "/settings" },
  { label: "Team", to: "/settings/team" },
]

export default function SettingsShell() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-cream)", color: "var(--color-ink)" }}
    >
      {/* Header */}
      <header
        className="border-b px-6 py-5"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/proposals">
            <ProposlMark />
          </Link>
          <Link
            to="/proposals"
            className="text-[11px] uppercase tracking-[0.12em] transition-colors hover:opacity-70"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            &larr; Dashboard
          </Link>
        </div>
      </header>

      {/* Title + tabs */}
      <div className="mx-auto max-w-2xl px-6 pt-10">
        <h1
          className="text-[32px] leading-[1.1] tracking-[-0.01em]"
          style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
        >
          Settings
        </h1>

        <nav
          className="mt-6 flex gap-1 border-b"
          style={{ borderColor: "var(--color-rule)" }}
        >
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/settings"}
              className={({ isActive }) =>
                `relative px-4 py-2.5 text-[13px] font-medium transition-colors ${
                  isActive ? "" : "hover:opacity-70"
                }`
              }
              style={({ isActive }) => ({
                color: isActive ? "var(--color-forest)" : "var(--color-ink-mute)",
                fontFamily: "var(--font-sans)",
              })}
            >
              {({ isActive }) => (
                <>
                  {tab.label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full"
                      style={{ background: "var(--color-forest)" }}
                    />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-2xl px-6 py-8">
        <Outlet />
      </div>
    </div>
  )
}
