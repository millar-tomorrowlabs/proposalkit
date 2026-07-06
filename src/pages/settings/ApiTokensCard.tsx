/**
 * API tokens for the Proposl MCP server (INT-26).
 *
 * Tokens are generated in the browser (crypto random), shown exactly once,
 * and only their SHA-256 hash is stored, guarded by RLS (owners mint and
 * revoke, members can view metadata). The MCP server at /api/mcp hashes the
 * presented bearer token and matches it against api_tokens.
 */

import { useCallback, useEffect, useState } from "react"
import { Copy, Plus, Check } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import { useAccount } from "@/contexts/AccountContext"
import { useAuth } from "@/contexts/AuthContext"

const labelClass = "mb-1.5 block text-[10px] uppercase tracking-[0.12em]"
const labelStyle = { fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }
const inputClass = "w-full rounded-lg border bg-white/50 px-3 py-2.5 text-[14px] outline-none focus:ring-1"
const inputStyle = { borderColor: "var(--color-rule)", color: "var(--color-ink)" }

interface TokenRow {
  id: string
  label: string
  token_prefix: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

function randomToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
  return `ppk_${hex}`
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("")
}

export default function ApiTokensCard() {
  const { account } = useAccount()
  const { userId } = useAuth()
  const [tokens, setTokens] = useState<TokenRow[]>([])
  const [label, setLabel] = useState("")
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** The freshly minted token, shown exactly once. */
  const [mintedToken, setMintedToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("api_tokens")
      .select("id, label, token_prefix, created_at, last_used_at, revoked_at")
      .eq("account_id", account.id)
      .order("created_at", { ascending: false })
    if (data) setTokens(data as TokenRow[])
  }, [account.id])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async () => {
    if (!label.trim()) return
    setCreating(true)
    setError(null)
    const token = randomToken()
    const hash = await sha256Hex(token)
    const { error: insertError } = await supabase.from("api_tokens").insert({
      account_id: account.id,
      user_id: userId,
      label: label.trim(),
      token_hash: hash,
      token_prefix: token.slice(0, 10),
    })
    setCreating(false)
    if (insertError) {
      setError(friendlyError(insertError.message))
      return
    }
    setMintedToken(token)
    setLabel("")
    await load()
  }

  const handleRevoke = async (id: string) => {
    const { error: revokeError } = await supabase
      .from("api_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", id)
    if (revokeError) {
      setError(friendlyError(revokeError.message))
      return
    }
    await load()
  }

  const copyMinted = async () => {
    if (!mintedToken) return
    await navigator.clipboard.writeText(mintedToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="space-y-5">
      <div>
        <p
          className="text-[11px] uppercase tracking-[0.14em]"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
        >
          API tokens
        </p>
        <p className="mt-1.5 text-[13px]" style={{ color: "var(--color-ink-soft)" }}>
          Let Claude read and write proposals through the Proposl MCP server. Add it with:{" "}
          <code style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>
            claude mcp add --transport http proposl https://proposl.app/api/mcp --header "Authorization: Bearer &lt;token&gt;"
          </code>
        </p>
      </div>

      {/* One-time reveal of a freshly minted token */}
      {mintedToken && (
        <div
          className="rounded-lg border p-4"
          style={{ borderColor: "var(--color-forest)", background: "var(--color-paper)" }}
        >
          <p className={labelClass} style={labelStyle}>
            Copy this token now. It will not be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 overflow-x-auto rounded border bg-white/60 px-3 py-2 text-[12px]"
              style={{ fontFamily: "var(--font-mono)", borderColor: "var(--color-rule)", color: "var(--color-ink)" }}
            >
              {mintedToken}
            </code>
            <button
              onClick={copyMinted}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-transform hover:scale-[1.02]"
              style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setMintedToken(null)}
            className="mt-2 text-[11px] transition-colors hover:opacity-70"
            style={{ color: "var(--color-ink-mute)" }}
          >
            I saved it, hide this
          </button>
        </div>
      )}

      {/* Token list */}
      {tokens.length > 0 && (
        <div className="space-y-1.5">
          {tokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border px-3 py-2 text-[12px]"
              style={{ borderColor: "var(--color-rule)", color: "var(--color-ink-soft)" }}
            >
              <div className="min-w-0">
                <p className="truncate font-medium" style={{ color: "var(--color-ink)" }}>
                  {t.label}
                  {t.revoked_at && (
                    <span className="ml-2 text-[10px] uppercase tracking-[0.1em]" style={{ color: "#b91c1c", fontFamily: "var(--font-mono)" }}>
                      Revoked
                    </span>
                  )}
                </p>
                <p className="text-[10px]" style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}>
                  {t.token_prefix}… · created {new Date(t.created_at).toLocaleDateString()}
                  {t.last_used_at ? ` · last used ${new Date(t.last_used_at).toLocaleDateString()}` : " · never used"}
                </p>
              </div>
              {!t.revoked_at && (
                <button
                  onClick={() => handleRevoke(t.id)}
                  className="shrink-0 text-[11px] font-medium transition-colors hover:opacity-70"
                  style={{ color: "#b91c1c" }}
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create */}
      <div>
        <label className={labelClass} style={labelStyle}>
          New token label
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Millar's Claude Code"
            className={inputClass}
            style={inputStyle}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !label.trim()}
            className="flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-medium transition-transform hover:scale-[1.02] disabled:opacity-40"
            style={{ background: "var(--color-forest)", color: "var(--color-cream)" }}
          >
            <Plus className="h-3 w-3" />
            {creating ? "Creating..." : "Create token"}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-[12px]" style={{ color: "#b91c1c" }} role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
