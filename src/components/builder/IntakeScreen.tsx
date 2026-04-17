// src/components/builder/IntakeScreen.tsx

import IntakePanel, {
  type ContextChip,
  type IntakePanelMessage,
} from "./IntakePanel"

interface IntakeScreenProps {
  messages: IntakePanelMessage[]
  loading: boolean
  onSend: (text: string) => void
  onAttach: () => void
  onDraftReady: () => void
  onDraftNow: () => void
  contextChips: ContextChip[]
}

export default function IntakeScreen({
  messages,
  loading,
  onSend,
  onAttach,
  onDraftReady,
  onDraftNow,
  contextChips,
}: IntakeScreenProps) {
  const conversationStarted = messages.some((m) => m.role === "user")
  const hasContext = contextChips.length > 0

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col items-center px-4 pb-10 pt-8 sm:px-6">
      <div
        className={`intake-hero w-full ${
          conversationStarted ? "intake-hero--active" : ""
        }`}
      >
        <div className="intake-hero__text">
          <div
            className="mb-3 text-[11px] uppercase tracking-[0.14em]"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-mute)" }}
          >
            NEW PROPOSAL
          </div>
          <h1
            className="text-center text-[36px] leading-[1.05] tracking-[-0.01em] sm:text-[56px]"
            style={{
              fontFamily: "var(--font-merchant-display)",
              fontWeight: 500,
              color: "var(--color-ink)",
            }}
          >
            What are we proposing?
          </h1>
        </div>
      </div>

      <div className="w-full">
        <IntakePanel
          messages={messages}
          loading={loading}
          onSend={onSend}
          onAttach={onAttach}
          onDraftReady={onDraftReady}
          contextChips={contextChips}
        />
      </div>

      <div className="mt-4 flex w-full max-w-[640px] flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-3">
        <button
          onClick={onAttach}
          className="rounded-full border px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-colors hover:bg-black/5"
          style={{
            background: "var(--color-paper)",
            borderColor: "var(--color-rule)",
            color: "var(--color-ink-soft)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {hasContext ? "ADD MORE CONTEXT" : "ATTACH CONTEXT"}
        </button>
        <button
          onClick={onDraftNow}
          className="rounded-full px-3.5 py-1.5 text-[10px] uppercase tracking-[0.14em] transition-opacity hover:opacity-70"
          style={{
            color: "var(--color-ink-mute)",
            fontFamily: "var(--font-mono)",
          }}
        >
          {conversationStarted ? "DRAFT NOW" : "SKIP · START BLANK"}
        </button>
      </div>
    </div>
  )
}
