/**
 * Admin shell — /admin/*
 *
 * Shared layout with horizontal tabs: Dashboard | Waitlist | Invites |
 * Accounts. Sits above the <Outlet /> so every admin page shares nav,
 * back-to-app link, and consistent padding. Styled in Studio Editorial.
 */

import { NavLink, Outlet, Link } from "react-router-dom"
import ProposlMark from "@/components/brand/ProposlMark"

const tabs = [
  { label: "Dashboard", to: "/admin" },
  { label: "Waitlist", to: "/admin/waitlist" },
  { label: "Invites", to: "/admin/invites" },
  { label: "Accounts", to: "/admin/accounts" },
]

export default function AdminShell() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--color-cream)", color: "var(--color-ink)" }}
    >
      <header
        className="border-b px-6 py-5"
        style={{ borderColor: "var(--color-rule)" }}
      >
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <Link to="/proposals" className="flex items-center gap-2.5" style={{ color: "var(--color-forest)" }}>
            <ProposlMark size={28} />
            <span
              className="text-[18px] leading-none"
              style={{
                fontFamily: "var(--font-merchant-display)",
                fontWeight: 500,
                letterSpacing: "-0.01em",
              }}
            >
              proposl / admin
            </span>
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

      <div className="mx-auto max-w-[1200px] px-6 pt-10 md:px-10">
        <h1
          className="text-[36px] leading-[1.1] tracking-[-0.01em] md:text-[44px]"
          style={{ fontFamily: "var(--font-merchant-display)", fontWeight: 500 }}
        >
          Admin
        </h1>
        <p
          className="mt-2 text-[13px]"
          style={{ color: "var(--color-ink-soft)" }}
        >
          Manage waitlist, invites, and account plans.
        </p>

        <nav
          className="mt-6 flex gap-1 overflow-x-auto border-b"
          style={{ borderColor: "var(--color-rule)" }}
        >
          {tabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === "/admin"}
              className={({ isActive }) =>
                `relative whitespace-nowrap px-4 py-2.5 text-[13px] font-medium transition-colors ${
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

      <div className="mx-auto max-w-[1200px] px-6 py-8 md:px-10">
        <Outlet />
      </div>
    </div>
  )
}
