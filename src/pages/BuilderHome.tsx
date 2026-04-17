import { useEffect, useRef, useCallback, useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import { useAuth } from "@/contexts/AuthContext"
import { useAccount } from "@/contexts/AccountContext"
import { useBuilderStore } from "@/store/builderStore"
import BuilderPreviewContext from "@/contexts/BuilderPreviewContext"
import ProposalWrapper from "@/components/proposal/ProposalWrapper"
import SendProposalDialog from "@/components/proposal/SendProposalDialog"
import BuilderTopBar from "@/components/builder/BuilderTopBar"
import FloatingComposer from "@/components/builder/FloatingComposer"
import SettingsPopover from "@/components/builder/SettingsPopover"
import ContextDialog from "@/components/builder/ContextDialog"
import HistoryPopover from "@/components/builder/HistoryPopover"
import DraftingReveal from "@/components/builder/DraftingReveal"
import { VIEWPORT_WIDTHS } from "@/components/builder/ViewportSwitcher"
import { stripStreamingEditsBlock } from "@/lib/proposalEdits"
import { fetchHeroImage } from "@/lib/heroImage"
import type { ProposalData, SectionKey } from "@/types/proposal"
import IntakeScreen from "@/components/builder/IntakeScreen"
import {
  loadIntake,
  saveIntake,
  clearIntake,
} from "@/lib/intakePersistence"

const DEBOUNCE_PREVIEW_MS = 300
const DEBOUNCE_SAVE_MS = 2000

const ALL_SECTIONS: SectionKey[] = ["summary", "scope", "timeline", "investment", "cta"]

const BuilderHome = () => {
  const { id } = useParams<{ id?: string }>()
  const { userId, session } = useAuth()
  const { account } = useAccount()
  const navigate = useNavigate()
  const {
    proposal,
    previewProposal,
    saveStatus,
    isDirty,
    flushToPreview,
    setSaveStatus,
    initNew,
    initExisting,
    contextBlobs,
    updateField,
    composerVisible,
    setComposerVisible,
    viewport,
    setViewport,
    pendingChatPrompt,
    setPendingChatPrompt,
    autoSendChatPrompt,
    setAutoSendChatPrompt,
  } = useBuilderStore()

  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const proposalRef = useRef(proposal)
  proposalRef.current = proposal

  // Loading state for existing proposals
  const [isLoading, setIsLoading] = useState(!!id)

  // Context sources attached to this proposal. The AI system prompt
  // receives name + excerpt for each source so it can reference them
  // when drafting or refining.
  const [contextSources, setContextSources] = useState<
    Array<{ name: string; sourceType: "file" | "url" | "paste"; excerpt: string }>
  >([])

  const loadContextSources = useCallback(async () => {
    if (!proposal.id) return
    const { data } = await supabase
      .from("proposal_context")
      .select("name, source_type, extracted_text")
      .eq("proposal_id", proposal.id)
      .order("created_at", { ascending: true })
    if (!data) return
    // Truncate each source's excerpt so the full prompt stays well under
    // the model's context window. 4,000 chars ≈ 1,000 tokens per source,
    // and we expect <5 sources per proposal typically.
    const EXCERPT_LIMIT = 4000
    setContextSources(
      data.map((r) => ({
        name: r.name,
        sourceType: r.source_type as "file" | "url" | "paste",
        excerpt:
          r.extracted_text.length > EXCERPT_LIMIT
            ? r.extracted_text.slice(0, EXCERPT_LIMIT) + "\n\n[...truncated...]"
            : r.extracted_text,
      })),
    )
  }, [proposal.id])

  // Reload context sources whenever the proposal id changes (i.e. loaded)
  // and once more when the ContextDialog closes (so fresh adds land in
  // the next AI call).
  useEffect(() => {
    loadContextSources()
  }, [loadContextSources])

  // ── AI chat (replaces deleted ChatPanel) ────────────────────────────────
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async () => {
          const { data } = await supabase.auth.getSession()
          const token = data.session?.access_token ?? session.access_token
          return { Authorization: `Bearer ${token}` }
        },
        body: {
          proposal,
          accountContext: {
            studioName: account.studioName,
            // Default studio description seeds the AI's agency bio handling.
            // The aiTailorAgencyBio flag controls whether the AI is allowed
            // to adjust it per-proposal or must render it verbatim.
            studioDescription: account.defaultStudioDescription,
            studioTagline: account.defaultStudioTagline,
            voiceDescription: account.voiceDescription,
            voiceExamples: account.voiceExamples,
            bannedPhrases: account.bannedPhrases,
            defaultHourlyRate: account.defaultHourlyRate,
            defaultCurrency: account.defaultCurrency,
            aiTailorAgencyBio: account.aiTailorAgencyBio !== false,
            brief: proposal.brief,
          },
          contextSources,
        },
      }),
    [proposal, account, session, contextSources],
  )

  const initialIntakeMessages = useMemo(
    () => loadIntake(proposal.id) ?? undefined,
    // Only load at mount. We don't want to reset the conversation mid-session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const {
    messages: uiMessages,
    sendMessage,
    status: chatStatus,
  } = useChat({
    id: `chat-${proposal.id}`,
    transport,
    messages: initialIntakeMessages,
    onError: (err) => {
      console.error("Chat error:", err)
      toast.error("AI request failed. Please try again.")
    },
  })

  const isStreaming = chatStatus === "streaming" || chatStatus === "submitted"

  // Auto-send chat prompt (triggered by AskAIGhost buttons and Skip-intake).
  // Separate from pendingChatPrompt so the text doesn't also get stuffed into
  // the composer input — this path bypasses the input entirely.
  useEffect(() => {
    if (autoSendChatPrompt && !isStreaming) {
      const prompt = autoSendChatPrompt
      setAutoSendChatPrompt(null)
      setComposerVisible(true)
      setTimeout(() => sendMessage({ text: prompt }), 0)
    }
  }, [autoSendChatPrompt, isStreaming, setAutoSendChatPrompt, setComposerVisible, sendMessage])

  // Document-first editor state
  const [previewMode, setPreviewMode] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showContext, setShowContext] = useState(false)
  const [showSendDialog, setShowSendDialog] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const historyButtonRef = useRef<HTMLButtonElement>(null)

  // Snapshot-based undo for AI edits
  const [canRevert, setCanRevert] = useState(false)

  // Drafting reveal overlay — shown between user confirming a v1 draft
  // and the first edits landing. Only triggers on the empty → populated
  // transition (first draft); refinement edits don't get the ceremony.
  const [isDrafting, setIsDrafting] = useState(false)

  // A proposal is "empty" when the user hasn't drafted anything yet --
  // no tagline, no scope outcomes, no investment packages. In that state
  // we render the intake screen over the builder instead of the empty
  // proposal template, so the experience feels like Lovable's first-run
  // (one screen, one chat, no separate wizard).
  const isProposalEmpty =
    (!proposal.tagline || proposal.tagline.trim() === "") &&
    (proposal.scope?.outcomes?.length ?? 0) === 0 &&
    (proposal.investment?.packages?.length ?? 0) === 0

  const saveSnapshot = useCallback(async (trigger: string) => {
    if (!proposal.id) return
    await supabase.from("proposal_snapshots").insert({
      proposal_id: proposal.id,
      data: proposal,
      trigger,
    })
    // Prune to the latest 200 snapshots. We treat history as persistent
    // now (the HistoryPopover lets users restore any of the recent 30),
    // but we still cap to prevent unbounded growth. Run occasionally
    // (1-in-10 saves) because it's maintenance, not consistency.
    //
    // Deletes are chunked: Supabase/PostgREST rejects DELETEs with very
    // long IN clauses (the request URL can exceed server limits), which
    // previously flooded the console with 400s. 50 per batch keeps the
    // URL well under 8 KB even with dashed UUIDs.
    if (Math.random() < 0.1) {
      const { data: all } = await supabase
        .from("proposal_snapshots")
        .select("id")
        .eq("proposal_id", proposal.id)
        .order("created_at", { ascending: false })
      if (all && all.length > 200) {
        const toDelete = all.slice(200).map((s: { id: string }) => s.id)
        const CHUNK = 50
        for (let i = 0; i < toDelete.length; i += CHUNK) {
          const batch = toDelete.slice(i, i + CHUNK)
          await supabase.from("proposal_snapshots").delete().in("id", batch)
        }
      }
    }
  }, [proposal])

  const revertToLatestSnapshot = useCallback(async () => {
    if (!proposal.id) return
    // Save CURRENT state first so the revert is itself undoable from the
    // history panel. Then swap in the most recent snapshot. We no longer
    // delete the snapshot on revert — the History popover lets users step
    // through any version.
    const store = useBuilderStore.getState()
    await supabase.from("proposal_snapshots").insert({
      proposal_id: proposal.id,
      data: store.proposal,
      trigger: "before-restore",
    })
    const { data } = await supabase
      .from("proposal_snapshots")
      .select("*")
      .eq("proposal_id", proposal.id)
      .eq("trigger", "ai-edit")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      const snapshotData = data.data as unknown as ProposalData
      store.setProposal(snapshotData)
      setCanRevert(false)
      toast.info("Reverted to previous version. Open history for older versions.")
    }
  }, [proposal.id])

  // DraftingReveal trigger: the moment the AI starts its reply with
  // "Drafting now." during streaming, flip into the reveal overlay so the
  // user sees ceremony instead of a stalled textarea. Only fires for v1
  // drafts (when the proposal is still effectively empty). Safety net: a
  // long-timer fallback so we never get stuck in the overlay if edits
  // fail to arrive.
  useEffect(() => {
    if (isDrafting || uiMessages.length === 0) return
    const last = uiMessages[uiMessages.length - 1]
    if (last.role !== "assistant") return
    const text = last.parts
      ?.map((p) => (p.type === "text" ? p.text : ""))
      .join("") ?? ""
    if (!/drafting now/i.test(text)) return
    const p = useBuilderStore.getState().proposal
    const isEmpty =
      (!p.tagline || p.tagline.trim() === "") &&
      (p.scope?.outcomes?.length ?? 0) === 0 &&
      (p.investment?.packages?.length ?? 0) === 0
    if (!isEmpty) return
    setIsDrafting(true)
  }, [uiMessages, isDrafting])

  // Safety fallback: if the drafting reveal stays up longer than 90s (AI
  // errored, edits block malformed, network stall) drop it so the user
  // isn't stuck staring at the mark.
  useEffect(() => {
    if (!isDrafting) return
    const t = setTimeout(() => setIsDrafting(false), 90_000)
    return () => clearTimeout(t)
  }, [isDrafting])

  // Persist intake conversation to localStorage (debounced) while the
  // proposal is empty. Clear once drafting starts or the proposal gets
  // populated. The transcript is no longer useful post-draft.
  useEffect(() => {
    if (!proposal.id) return
    if (!isProposalEmpty || isDrafting) {
      clearIntake(proposal.id)
      return
    }
    const t = setTimeout(() => {
      saveIntake(proposal.id, uiMessages)
    }, 200)
    return () => clearTimeout(t)
  }, [proposal.id, uiMessages, isProposalEmpty, isDrafting])

  // Sync UIMessages back to the store + auto-apply any new AI edits.
  // The store extracts edits both from tool parts AND from `proposal-edits`
  // code blocks the AI streams in text. When a fresh assistant message
  // arrives with edits, we save a snapshot first (so revert works), then
  // apply the edits to the live proposal so the document updates instantly.
  useEffect(() => {
    if (uiMessages.length === 0 || chatStatus !== "ready") return

    const store = useBuilderStore.getState()
    store.syncChatFromUIMessages(uiMessages)

    // Apply any unapplied edits on assistant messages
    const refreshed = useBuilderStore.getState()
    const applied = refreshed.appliedEditIds
    const unapplied = uiMessages.filter(
      (m) => m.role === "assistant" && !applied.has(m.id) && refreshed._uiChatEdits[m.id]?.length,
    )
    if (unapplied.length > 0) {
      // Snapshot once before the batch applies, so revert restores the
      // pre-AI state in one click.
      saveSnapshot("ai-edit").then(() => {
        for (const m of unapplied) {
          // Stagger the edits so the document visibly populates one field
          // at a time instead of popping in all at once. 120ms feels
          // alive without feeling sluggish for a typical v1 (10-15 edits).
          useBuilderStore.getState().applyChatEdits(m.id, { staggerMs: 120 })
        }
        // Exit the drafting reveal the instant stagger begins. The overlay
        // backdrop takes 700ms to fade, during which the first ~5 staggered
        // edits land — so the document materialises behind the dissolving
        // cream. Mark finishes migrating to the top-bar at ~800ms.
        setIsDrafting(false)
        setCanRevert(true)
        // After applying edits, if the AI just populated a previously-empty
        // proposal but didn't set a hero image (it can't generate images),
        // source one from Unsplash using the client name + tagline as a
        // keyword query. Silent fail is fine — we just leave the hero
        // empty and the user can set one manually.
        const after = useBuilderStore.getState().proposal
        const hasContent = !!(after.tagline && after.tagline.trim())
        const missingHero = !after.heroImageUrl
        if (hasContent && missingHero) {
          // Prefer the AI's intake-derived visual direction if it set one.
          // Fall back to clientName + tagline so we always have SOMETHING
          // to search on.
          const query = (after.heroImageQuery && after.heroImageQuery.trim())
            ? after.heroImageQuery.trim()
            : `${after.clientName ?? ""} ${after.tagline ?? ""}`.trim()
          useBuilderStore.getState().setHeroImageLoading(true)
          fetchHeroImage(query)
            .then((url) => {
              if (url) useBuilderStore.getState().updateField("heroImageUrl", url)
            })
            .finally(() => {
              useBuilderStore.getState().setHeroImageLoading(false)
            })
        }
      })
    }
  }, [uiMessages, chatStatus, saveSnapshot])

  // Init on mount
  useEffect(() => {
    if (id) {
      // Load existing proposal
      setIsLoading(true)
      supabase
        .from("proposals")
        .select("*")
        .eq("id", id)
        .single()
        .then(({ data }) => {
          if (data) {
            // Ownership guard -- only account members can edit
            if (data.account_id && data.account_id !== account.id) {
              navigate("/proposals")
              return
            }
            const merged = { ...data, ...data.data } as ProposalData
            // Backfill studio branding from account if missing (for proposals created
            // before denormalization was added). This auto-heals existing rows: the
            // auto-save will persist the patch on next dirty flush.
            if (!merged.studioName && account.studioName) {
              merged.studioName = account.studioName
            }
            if (!merged.studioLogoUrl && account.logoUrl) {
              merged.studioLogoUrl = account.logoUrl
            }
            initExisting(merged, data.chat_messages ?? [])
            // Restore persisted context blobs (without triggering auto-save)
            if (merged.contextBlobs?.length) {
              useBuilderStore.setState({ contextBlobs: merged.contextBlobs, isDirty: false })
            }
          }
          setIsLoading(false)
        })
    } else {
      initNew({
        studioName: account.studioName,
        studioLogoUrl: account.logoUrl,
        ctaEmail: account.defaultCtaEmail,
        brandColor1: account.defaultBrandColor1,
        brandColor2: account.defaultBrandColor2,
      })
      setIsLoading(false)
    }
  }, [id])

  // (The sync/auto-apply effect higher up also handles snapshots + canRevert
  // when an assistant response actually contains edits. We don't snapshot for
  // pure-text assistant replies because there's nothing to revert.)

  // Debounce preview flush
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current)
    previewTimer.current = setTimeout(() => {
      flushToPreview()
    }, DEBOUNCE_PREVIEW_MS)
    return () => { if (previewTimer.current) clearTimeout(previewTimer.current) }
  }, [proposal])

  // Undo / redo keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod || e.key.toLowerCase() !== "z") return

      e.preventDefault()
      const store = useBuilderStore.getState()
      if (e.shiftKey) {
        // Ctrl/Cmd+Shift+Z = redo
        if (store.canRedo()) {
          store.redo()
          toast.info("Redo")
        }
      } else {
        // Ctrl/Cmd+Z = undo
        if (store.canUndo()) {
          store.undo()
          toast.info("Undo")
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // Debounce auto-save
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    if (!isDirty) return // skip save triggered by init/load
    if (!proposal.slug && !proposal.title) return // don't save empty state

    setSaveStatus("saving")
    saveTimer.current = setTimeout(async () => {
      const { error } = await supabase
        .from("proposals")
        .upsert({
          id: proposal.id,
          account_id: account.id,
          user_id: userId,
          slug: proposal.slug || proposal.id,
          title: proposal.title || "Untitled",
          client_name: proposal.clientName || "Unknown",
          brand_color_1: proposal.brandColor1,
          brand_color_2: proposal.brandColor2,
          hero_image_url: proposal.heroImageUrl,
          cta_email: proposal.ctaEmail,
          status: proposal.status || "draft",
          sections: proposal.sections,
          data: { ...proposal, contextBlobs: useBuilderStore.getState().contextBlobs },
          chat_messages: useBuilderStore.getState().chatMessages,
        })
      if (error) {
        setSaveStatus("error")
        toast.error(friendlyError(error.message))
      } else {
        setSaveStatus("saved")
      }
    }, DEBOUNCE_SAVE_MS)

    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [proposal, contextBlobs])

  // Section management for BuilderPreviewContext
  const addSection = useCallback((relativeTo: SectionKey, position: "above" | "below") => {
    const current = useBuilderStore.getState().proposal.sections
    const available = ALL_SECTIONS.filter((s) => !current.includes(s))
    if (available.length === 0) return
    const newSection = available[0]
    const idx = current.indexOf(relativeTo)
    if (idx === -1) return
    const updated = [...current]
    updated.splice(position === "above" ? idx : idx + 1, 0, newSection)
    useBuilderStore.getState().updateField("sections", updated)
  }, [])

  const removeSection = useCallback((key: SectionKey) => {
    const current = useBuilderStore.getState().proposal.sections
    useBuilderStore.getState().updateField(
      "sections",
      current.filter((s) => s !== key),
    )
  }, [])

  // Reflect a successful send locally so the top bar status updates immediately
  const handleSendComplete = useCallback(() => {
    if (!proposal.status || proposal.status === "draft") {
      useBuilderStore.getState().updateField("status", "sent")
    }
    setShowSendDialog(false)
  }, [proposal.status])

  // Show nothing while loading existing proposal
  if (isLoading) return null

  return (
    <BuilderPreviewContext.Provider
      value={{
        isEditable: !previewMode,
        updateField: useBuilderStore.getState().updateField,
        updateAtPath: useBuilderStore.getState().updateAtPath,
        addSection,
        removeSection,
        focusComposer: (prefill?: string) => {
          setComposerVisible(true)
          if (prefill) {
            setAutoSendChatPrompt(prefill)
          }
        },
      }}
    >
      <div className="min-h-screen" style={{ background: "var(--color-paper)" }}>
        <DraftingReveal active={isDrafting} />
        <BuilderTopBar
          title={proposal.title}
          onTitleChange={(t) => updateField("title", t)}
          status={proposal.status || "draft"}
          viewport={viewport}
          onViewportChange={setViewport}
          previewMode={previewMode}
          onTogglePreview={() => {
            setPreviewMode(!previewMode)
            if (!previewMode) setComposerVisible(false)
            else setComposerVisible(true)
          }}
          onOpenSettings={() => setShowSettings(!showSettings)}
          onOpenContext={() => setShowContext(true)}
          onOpenHistory={() => setShowHistory(!showHistory)}
          onSend={() => setShowSendDialog(true)}
          saveStatus={saveStatus}
          settingsButtonRef={settingsButtonRef}
          historyButtonRef={historyButtonRef}
        />

        {/* Settings popover -- positioned below top bar, right-aligned */}
        <div className="relative">
          <div className="absolute right-4 top-0 z-50">
            <SettingsPopover
              open={showSettings}
              onClose={() => setShowSettings(false)}
              anchorRef={settingsButtonRef}
            />
          </div>
        </div>

        {/* History popover -- same anchor rail as Settings */}
        <div className="relative">
          <div className="absolute right-4 top-0 z-50">
            <HistoryPopover
              open={showHistory}
              onClose={() => setShowHistory(false)}
              proposalId={proposal.id}
              anchorRef={historyButtonRef}
            />
          </div>
        </div>

        {/* Document area — either the empty-state intake hero or the
            populated proposal. "Empty" means the user hasn't drafted
            anything yet; the AI's first response will populate sections
            and this view will swap to the full document in the same frame. */}
        <div className="pt-11">
          {isProposalEmpty ? (
            <IntakeScreen
              messages={uiMessages.map((m) => {
                const textParts = m.parts.filter((p) => p.type === "text") as Array<{
                  type: "text"
                  text: string
                }>
                const raw = textParts.map((p) => p.text).join("")
                const visible =
                  m.role === "assistant" ? stripStreamingEditsBlock(raw) : raw
                return {
                  id: m.id,
                  role: m.role as "user" | "assistant",
                  content: visible,
                }
              })}
              loading={isStreaming}
              onSend={(text) => sendMessage({ text })}
              onAttach={() => setShowContext(true)}
              onDraftReady={() => {
                // Path B: user clicked the AI-emitted "Draft v1" button.
                // Mirrors Path A. Send the affirmation as a real message so
                // the AI's next turn emits the proposal-edits block, and
                // fire the reveal overlay.
                setIsDrafting(true)
                sendMessage({ text: "Go ahead with the draft." })
              }}
              onDraftNow={() => {
                // Path C: escape hatch. Force draft regardless of AI state.
                setIsDrafting(true)
                setAutoSendChatPrompt(
                  "Skip the questions and draft v1 with whatever you have.",
                )
              }}
              contextChips={contextSources.map((c) => ({
                id: c.name,
                label: c.name,
              }))}
            />
          ) : (
            <div
              className="builder-preview mx-auto transition-all duration-200"
              style={{
                maxWidth: VIEWPORT_WIDTHS[viewport] || undefined,
              }}
            >
              <ProposalWrapper proposal={previewProposal} isPreview viewportWidth={viewport === "tablet" ? 768 : viewport === "mobile" ? 375 : undefined} />
            </div>
          )}
        </div>

        {/* Floating composer */}
        {!previewMode && !isProposalEmpty && (
          <FloatingComposer
            messages={uiMessages.map((m) => {
              const textParts = m.parts.filter((p) => p.type === "text") as Array<{ type: "text"; text: string }>
              const raw = textParts.map((p) => p.text).join("")
              // Hide the `proposal-edits` JSON block from the user — they
              // see the document update instead. While streaming, the
              // closing fence may not have arrived yet, so strip the
              // unterminated block too.
              const visible = m.role === "assistant" ? stripStreamingEditsBlock(raw) : raw
              return {
                id: m.id,
                role: m.role as "user" | "assistant",
                content: visible,
                createdAt: new Date().toISOString(),
              }
            })}
            loading={isStreaming}
            onSend={(text) => sendMessage({ text })}
            onAttach={() => setShowContext(true)}
            onRevert={revertToLatestSnapshot}
            canRevert={canRevert}
            visible={composerVisible}
            onToggle={() => setComposerVisible(!composerVisible)}
            pendingPrompt={pendingChatPrompt}
            onClearPendingPrompt={() => setPendingChatPrompt(null)}
          />
        )}

        {/* Context dialog. Refetches sources on close so the next AI turn
            sees freshly-added briefs/transcripts in the system prompt. */}
        <ContextDialog
          open={showContext}
          onClose={() => {
            setShowContext(false)
            loadContextSources()
          }}
          proposalId={proposal.id}
          brief={proposal.brief}
        />

        {/* Send dialog */}
        <SendProposalDialog
          open={showSendDialog}
          onClose={() => setShowSendDialog(false)}
          proposal={proposal}
          account={{
            id: account.id,
            studioName: account.studioName,
            senderName: account.senderName,
            website: account.website,
            maxMonthlySends: account.maxMonthlySends,
            plan: account.plan,
          }}
          onSendComplete={handleSendComplete}
        />
      </div>
    </BuilderPreviewContext.Provider>
  )
}

export default BuilderHome

