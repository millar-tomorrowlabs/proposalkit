import "jsr:@supabase/functions-js/edge-runtime.d.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface SendBody {
  recipientName: string
  recipientEmail: string
  proposalTitle: string
  proposalUrl: string
  studioName?: string
  brandColor1?: string
  brandColor2?: string
  senderName?: string
  personalMessage?: string
}

function buildSendEmailHtml(body: SendBody): string {
  const accent = body.brandColor1 ?? "#111"
  const studio = body.studioName ?? "Tomorrow Studios."
  const firstName = body.recipientName.split(" ")[0]

  const messageHtml = body.personalMessage
    ? `<p style="margin:0 0 24px;font-size:14px;color:#333;line-height:1.6;white-space:pre-line">${body.personalMessage}</p>`
    : ""

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#111;padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:500;letter-spacing:-0.01em;color:#fff">${studio}</h1>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,${accent},${body.brandColor2 ?? accent})"></div>
    <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px;border:1px solid #e5e5e5;border-top:none">
      <p style="margin:0 0 16px;font-size:16px;color:#111">Hi ${firstName},</p>
      <p style="margin:0 0 24px;font-size:14px;color:#333;line-height:1.6">Your proposal for <strong>${body.proposalTitle}</strong> is ready to review.</p>
      ${messageHtml}
      <div style="text-align:center;margin:32px 0">
        <a href="${body.proposalUrl}" style="display:inline-block;background:${accent};color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px">View Proposal</a>
      </div>
      <p style="margin:0;font-size:13px;color:#999;line-height:1.6;text-align:center">If the button doesn't work, copy this link:<br><a href="${body.proposalUrl}" style="color:${accent};word-break:break-all">${body.proposalUrl}</a></p>
    </div>
    <p style="text-align:center;margin-top:20px;font-size:12px;color:#aaa">${studio} · tomorrowstudios.io</p>
  </div>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const body: SendBody = await req.json()

    if (!body.recipientEmail || !body.recipientName || !body.proposalUrl || !body.proposalTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: recipientName, recipientEmail, proposalUrl, proposalTitle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const resendKey = Deno.env.get("RESEND_API_KEY")
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const senderName = body.senderName ?? "Tomorrow Studios"
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <notifications@tomorrowstudios.io>`,
        to: [body.recipientEmail],
        subject: `Your proposal: ${body.proposalTitle}`,
        html: buildSendEmailHtml(body),
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error("Resend error:", emailRes.status, errText)
      return new Response(
        JSON.stringify({ error: "Failed to send email" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (e) {
    console.error("send-proposal error:", e)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
