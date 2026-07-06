/**
 * Client-side chat input limit. Keep in sync with MAX_MESSAGE_LENGTH in
 * api/chat.ts (the server-side backstop). The composers block sending and
 * show a warning above this size, because the server would otherwise cut
 * the message and the AI would only see the first part.
 */
export const MAX_CHAT_MESSAGE_LENGTH = 50_000

export function formatCharCount(n: number): string {
  return n.toLocaleString("en-US")
}
