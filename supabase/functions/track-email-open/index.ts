import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

// 1×1 transparent PNG (68 bytes)
const PIXEL = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
  0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])

Deno.serve(async (req) => {
  // This endpoint is loaded as an <img> src from email clients — only GET
  const url = new URL(req.url)
  const proposalId = url.searchParams.get("pid")

  // Always return the pixel immediately (fire-and-forget tracking)
  const pixelResponse = new Response(PIXEL, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      // CORS not needed — loaded as <img>, not fetch
    },
  })

  if (!proposalId) return pixelResponse

  // Fire-and-forget: update proposal status
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    )

    // Only upgrade "sent" → "viewed"
    await supabase
      .from("proposals")
      .update({ status: "viewed" })
      .eq("id", proposalId)
      .eq("status", "sent")
  } catch (e) {
    console.error("track-email-open error:", e)
    // Silently fail — don't break the pixel response
  }

  return pixelResponse
})
