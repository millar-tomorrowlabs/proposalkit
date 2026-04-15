import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface SendBody {
  proposalId?: string
  recipientName: string
  recipientEmail: string
  proposalTitle: string
  clientName?: string
  proposalUrl: string
  studioName?: string
  brandColor1?: string
  brandColor2?: string
  website?: string
  senderName?: string
  personalMessage?: string
  sendType?: "initial" | "reminder"
  subject?: string
}

function buildSendEmailHtml(body: SendBody): string {
  const accent = body.brandColor1 ?? "#111"
  const studio = body.studioName ?? ""
  const website = body.website ?? "proposl.app"
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
      <p style="margin:0 0 24px;font-size:14px;color:#333;line-height:1.6">Your proposal for <strong>${body.clientName ?? body.proposalTitle}</strong> is ready to review.</p>
      ${messageHtml}
      <div style="text-align:center;margin:32px 0">
        <a href="${body.proposalUrl}" style="display:inline-block;background:${accent};color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px">View Proposal</a>
      </div>
      <p style="margin:0;font-size:13px;color:#999;line-height:1.6;text-align:center">If the button doesn't work, copy this link:<br><a href="${body.proposalUrl}" style="color:${accent};word-break:break-all">${body.proposalUrl}</a></p>
    </div>
    <p style="text-align:center;margin-top:20px;font-size:12px;color:#aaa">${studio} · ${website}</p>
  </div>
  ${body.proposalId ? `<img src="${Deno.env.get("SUPABASE_URL")}/functions/v1/track-email-open?pid=${body.proposalId}" width="1" height="1" style="display:block" alt="" />` : ""}
</body>
</html>`
}

function buildReminderEmailHtml(body: SendBody): string {
  const accent = body.brandColor1 ?? "#111"
  const studio = body.studioName ?? ""
  const website = body.website ?? "proposl.app"
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
      <p style="margin:0 0 24px;font-size:14px;color:#333;line-height:1.6">Just following up on the proposal for <strong>${body.clientName ?? body.proposalTitle}</strong>. Wanted to make sure you had a chance to take a look.</p>
      ${messageHtml}
      <div style="text-align:center;margin:32px 0">
        <a href="${body.proposalUrl}" style="display:inline-block;background:${accent};color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px">View Proposal</a>
      </div>
      <p style="margin:0;font-size:13px;color:#999;line-height:1.6;text-align:center">If the button doesn't work, copy this link:<br><a href="${body.proposalUrl}" style="color:${accent};word-break:break-all">${body.proposalUrl}</a></p>
    </div>
    <p style="text-align:center;margin-top:20px;font-size:12px;color:#aaa">${studio} · ${website}</p>
  </div>
  ${body.proposalId ? `<img src="${Deno.env.get("SUPABASE_URL")}/functions/v1/track-email-open?pid=${body.proposalId}" width="1" height="1" style="display:block" alt="" />` : ""}
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

    // JWT verification + ownership check
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const token = authHeader.replace("Bearer ", "")
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Verify the caller belongs to the proposal's account
    let accountId: string | null = null
    if (body.proposalId) {
      const { data: proposal } = await supabase
        .from("proposals")
        .select("account_id")
        .eq("id", body.proposalId)
        .single()

      if (proposal?.account_id) {
        accountId = proposal.account_id
        const { data: membership } = await supabase
          .from("account_members")
          .select("id")
          .eq("account_id", proposal.account_id)
          .eq("user_id", user.id)
          .maybeSingle()

        if (!membership) {
          return new Response(
            JSON.stringify({ error: "Not authorized to send this proposal" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          )
        }
      }
    }

    const resendKey = Deno.env.get("RESEND_API_KEY")
    if (!resendKey) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const isReminder = body.sendType === "reminder"
    const emailSubject = body.subject
      || (isReminder ? `Following up: ${body.proposalTitle}` : `Your proposal: ${body.proposalTitle}`)
    const senderName = body.senderName ?? body.studioName ?? "Proposals"

    // CC the person who clicked Send so they get immediate confirmation in their inbox.
    // Also set reply_to so client replies route directly to them instead of a dead address.
    // `user.email` is the authenticated sender from the JWT check above.
    const senderEmail = user.email
    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <notifications@proposl.app>`,
        to: [body.recipientEmail],
        ...(senderEmail ? { cc: [senderEmail], reply_to: senderEmail } : {}),
        subject: emailSubject,
        html: isReminder ? buildReminderEmailHtml(body) : buildSendEmailHtml(body),
      }),
    })

    if (!emailRes.ok) {
      const errText = await emailRes.text()
      console.error("Resend error:", emailRes.status, errText)
      // Surface common Resend errors as user-friendly messages
      let userMessage = "Failed to send email"
      if (errText.includes("not verified")) {
        userMessage = "Email domain not verified in Resend. Check the Resend dashboard."
      } else if (errText.includes("API key")) {
        userMessage = "Resend API key issue. Check Supabase secrets."
      }
      return new Response(
        JSON.stringify({ error: userMessage }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Record send in proposal_sends
    let sendId: string | null = null
    if (body.proposalId && accountId) {
      const { data: sendRecord } = await supabase
        .from("proposal_sends")
        .insert({
          proposal_id: body.proposalId,
          account_id: accountId,
          recipient_email: body.recipientEmail,
          recipient_name: body.recipientName,
          subject: emailSubject,
          personal_message: body.personalMessage || null,
          send_type: body.sendType || "initial",
          sent_by: user.id,
        })
        .select("id")
        .single()

      sendId = sendRecord?.id ?? null

      // Auto-update status to "sent" (only upgrades drafts, won't overwrite "viewed")
      await supabase
        .from("proposals")
        .update({ status: "sent" })
        .eq("id", body.proposalId)
        .or("status.is.null,status.eq.draft")
    }

    return new Response(
      JSON.stringify({ success: true, sendId }),
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
