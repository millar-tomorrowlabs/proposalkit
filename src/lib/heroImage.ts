/**
 * Client helper for the /api/hero-image Unsplash search endpoint.
 *
 * Used after the AI generates a v1 proposal, to source a landscape
 * hero image that matches the project. Returns null if no image was
 * found or any step failed — callers should treat that as "leave the
 * hero empty" rather than a hard error.
 */

import { supabase } from "@/lib/supabase"

export async function fetchHeroImage(query: string): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return null

    const res = await fetch("/api/hero-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    })

    if (!res.ok) return null
    const body = (await res.json()) as { url: string | null }
    return body.url ?? null
  } catch {
    return null
  }
}
