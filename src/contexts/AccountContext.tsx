import { createContext, useContext, useEffect, useState } from "react"
import { Outlet, Navigate } from "react-router-dom"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/contexts/AuthContext"
import type { Account, AccountMember, MemberRole } from "@/types/account"

interface AccountContextValue {
  account: Account
  membership: AccountMember
  isOwner: boolean
  refreshAccount: () => Promise<void>
}

const AccountContext = createContext<AccountContextValue | null>(null)

export const useAccount = () => {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error("useAccount must be used within AccountProvider")
  return ctx
}

// Convert snake_case DB row to camelCase Account
function toAccount(row: Record<string, unknown>): Account {
  return {
    id: row.id as string,
    studioName: row.studio_name as string,
    legalEntity: row.legal_entity as string | undefined,
    website: row.website as string | undefined,
    logoUrl: row.logo_url as string | undefined,
    notifyEmail: row.notify_email as string,
    ccEmail: row.cc_email as string | undefined,
    senderName: row.sender_name as string | undefined,
    defaultCtaEmail: row.default_cta_email as string | undefined,
    defaultBrandColor1: row.default_brand_color_1 as string || "#000000",
    defaultBrandColor2: row.default_brand_color_2 as string || "#6b7280",
    defaultStudioTagline: row.default_studio_tagline as string | undefined,
    defaultStudioDescription: row.default_studio_description as string | undefined,
    defaultStudioDescription2: row.default_studio_description_2 as string | undefined,
    voiceDescription: row.voice_description as string | undefined,
    voiceExamples: row.voice_examples as string | undefined,
    bannedPhrases: row.banned_phrases as string | undefined,
    defaultHourlyRate: row.default_hourly_rate as number | undefined,
    defaultCurrency: row.default_currency as string | undefined,
    // Default: allow AI to tailor bio. Column is non-null in DB with default
    // true, but we tolerate undefined rows for forward-compat.
    aiTailorAgencyBio: row.ai_tailor_agency_bio === undefined ? true : !!row.ai_tailor_agency_bio,
  }
}

function toMembership(row: Record<string, unknown>): AccountMember {
  return {
    id: row.id as string,
    accountId: row.account_id as string,
    userId: row.user_id as string,
    role: row.role as MemberRole,
    displayName: row.display_name as string | undefined,
  }
}

const AccountProvider = () => {
  const { userId } = useAuth()
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "no_account" }
    | { status: "ready"; account: Account; membership: AccountMember }
  >({ status: "loading" })

  const loadAccount = async () => {
    const { data, error } = await supabase
      .from("account_members")
      .select("*, accounts(*)")
      .eq("user_id", userId)
      .maybeSingle()

    if (error || !data || !data.accounts) {
      setState({ status: "no_account" })
      return
    }

    setState({
      status: "ready",
      account: toAccount(data.accounts as Record<string, unknown>),
      membership: toMembership(data),
    })
  }

  useEffect(() => {
    loadAccount()
  }, [userId])

  if (state.status === "loading") return null
  if (state.status === "no_account") return <Navigate to="/onboarding" replace />

  return (
    <AccountContext.Provider
      value={{
        account: state.account,
        membership: state.membership,
        isOwner: state.membership.role === "owner",
        refreshAccount: loadAccount,
      }}
    >
      <Outlet />
    </AccountContext.Provider>
  )
}

export default AccountProvider
