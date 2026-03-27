import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const NOTIFY_EMAILS = ["millar@tomorrowstudios.io"]

interface SubmissionBody {
  proposalId: string
  proposalSlug: string
  proposalTitle?: string
  studioName?: string
  brandColor1?: string
  brandColor2?: string
  clientName: string
  clientEmail: string
  currency?: string
  packageId?: string
  packageLabel?: string
  packagePrice?: number
  addOns?: { id: string; label: string; price: number }[]
  retainerHours?: number
  retainerRate?: number
  grandTotal?: number
  message?: string
  ctaEmail?: string
}

function formatPrice(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount)
}

function buildSelectionHtml(body: SubmissionBody): string {
  const currency = body.currency ?? "USD"
  const fp = (n: number) => formatPrice(n, currency)
  const accent = body.brandColor1 ?? "#111"

  if (!body.packageLabel) return `<p style="color:#666;font-style:italic">No package selected</p>`

  let html = `
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr style="border-bottom:1px solid #e5e5e5">
        <td style="padding:8px 0;color:#333">${body.packageLabel} package</td>
        <td style="padding:8px 0;text-align:right;font-weight:600;color:#111">${body.packagePrice != null ? fp(body.packagePrice) : "—"}</td>
      </tr>`

  if (body.addOns?.length) {
    for (const addon of body.addOns) {
      html += `
      <tr style="border-bottom:1px solid #e5e5e5">
        <td style="padding:8px 0;color:#666">+ ${addon.label}</td>
        <td style="padding:8px 0;text-align:right;color:#333">${fp(addon.price)}</td>
      </tr>`
    }
  }

  if (body.grandTotal != null) {
    html += `
      <tr>
        <td style="padding:12px 0 8px;font-weight:600;color:#111">Project Total</td>
        <td style="padding:12px 0 8px;text-align:right;font-weight:700;font-size:18px;color:${accent}">${fp(body.grandTotal)}</td>
      </tr>`
  }

  html += `</table>`

  if (body.retainerHours && body.retainerRate) {
    html += `<p style="margin:0 0 16px;color:#666;font-size:14px">+ ${body.retainerHours} hrs/mo retainer (${fp(body.retainerHours * body.retainerRate)}/mo)</p>`
  }

  return html
}

function buildEmailHtml(body: SubmissionBody): string {
  const accent = body.brandColor1 ?? "#111"
  const studio = body.studioName ?? "Tomorrow Studios."

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#111;padding:20px 24px;border-radius:12px 12px 0 0">
      <p style="margin:0 0 12px;font-family:Georgia,'Times New Roman',serif;font-size:14px;font-weight:500;letter-spacing:-0.01em;color:rgba(255,255,255,0.5)">${studio}</p>
      <h1 style="margin:0;color:#fff;font-size:18px;font-weight:600">New Proposal Submission</h1>
      <p style="margin:4px 0 0;color:#aaa;font-size:14px">${body.proposalTitle ?? body.proposalSlug}</p>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,${accent},${body.brandColor2 ?? accent})"></div>
    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e5e5;border-top:none">
      <table style="width:100%;margin-bottom:20px">
        <tr>
          <td style="padding:4px 0;font-size:14px;color:#666">Name</td>
          <td style="padding:4px 0;font-size:14px;font-weight:600;color:#111;text-align:right">${body.clientName}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:14px;color:#666">Email</td>
          <td style="padding:4px 0;font-size:14px;color:#111;text-align:right"><a href="mailto:${body.clientEmail}" style="color:${accent}">${body.clientEmail}</a></td>
        </tr>
      </table>
      <div style="border-top:2px solid #111;padding-top:16px">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#999">Selection</p>
        ${buildSelectionHtml(body)}
      </div>
      ${body.message ? `<div style="margin-top:20px;padding:16px;background:#f9f9f9;border-radius:8px"><p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#999">Message</p><p style="margin:0;color:#333">${body.message}</p></div>` : ""}
    </div>
    <p style="text-align:center;margin-top:20px;font-size:12px;color:#aaa">Sent by ProposalKit</p>
  </div>
</body>
</html>`
}

function buildClientEmailHtml(body: SubmissionBody): string {
  const accent = body.brandColor1 ?? "#111"
  const studio = body.studioName ?? "Tomorrow Studios."
  const firstName = body.clientName.split(" ")[0]
  const selectionHtml = body.packageLabel ? buildSelectionHtml(body) : ""

  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#111;padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:500;letter-spacing:-0.01em;color:#fff">${studio}</h1>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,${accent},${body.brandColor2 ?? accent})"></div>
    <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #e5e5e5;border-top:none">
      <p style="margin:0 0 16px;font-size:16px;color:#111">Thanks ${firstName},</p>
      <p style="margin:0 0 16px;font-size:14px;color:#333;line-height:1.6">We've received your submission for <strong>${body.proposalTitle ?? body.proposalSlug}</strong>. Our team will review and follow up shortly with next steps.</p>
      ${selectionHtml ? `
      <div style="border-top:2px solid ${accent};padding-top:16px;margin-top:8px">
        <p style="margin:0 0 4px;font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#999">Your selection</p>
        ${selectionHtml}
      </div>` : ""}
      <p style="margin:24px 0 0;font-size:14px;color:#333;line-height:1.6">If you have any questions in the meantime, just reply to this email.</p>
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
    const body: SubmissionBody = await req.json()

    // Validate required fields
    if (!body.proposalId || !body.proposalSlug || !body.clientName || !body.clientEmail) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: proposalId, proposalSlug, clientName, clientEmail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Insert into submissions table using service role key
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    // Look up proposal owner for user_id propagation
    const { data: proposalRow } = await supabase
      .from("proposals")
      .select("user_id")
      .eq("id", body.proposalId)
      .single()

    const { data: row, error: dbError } = await supabase.from("submissions").insert({
      proposal_id: body.proposalId,
      proposal_slug: body.proposalSlug,
      user_id: proposalRow?.user_id ?? null,
      client_name: body.clientName,
      client_email: body.clientEmail,
      package_id: body.packageId ?? null,
      package_label: body.packageLabel ?? null,
      package_price: body.packagePrice ?? null,
      add_ons: body.addOns ?? [],
      retainer_hours: body.retainerHours ?? null,
      retainer_rate: body.retainerRate ?? null,
      total_price: body.grandTotal ?? null,
      currency: body.currency ?? "USD",
      message: body.message ?? null,
    }).select("id").single()

    if (dbError) {
      console.error("DB insert failed:", dbError)
      return new Response(
        JSON.stringify({ error: "Failed to save submission", detail: dbError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Attempt email notification via Resend
    let emailSent = false
    const resendKey = Deno.env.get("RESEND_API_KEY")

    if (resendKey) {
      const replyTo = body.ctaEmail ?? NOTIFY_EMAILS[0]
      const sendEmail = (to: string[], subject: string, html: string, replyToAddr?: string) =>
        fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Tomorrow Studios <notifications@tomorrowstudios.io>",
            to,
            subject,
            html,
            ...(replyToAddr ? { reply_to: replyToAddr } : {}),
          }),
        })

      try {
        // Send team notification + client confirmation in parallel
        const [teamRes, clientRes] = await Promise.all([
          sendEmail(
            NOTIFY_EMAILS,
            `New submission: ${body.proposalTitle ?? body.proposalSlug}`,
            buildEmailHtml(body)
          ),
          sendEmail(
            [body.clientEmail],
            `Thanks for your submission — ${body.proposalTitle ?? body.proposalSlug}`,
            buildClientEmailHtml(body),
            replyTo
          ),
        ])

        emailSent = teamRes.ok || clientRes.ok
        if (!teamRes.ok) {
          const errText = await teamRes.text()
          console.error("Resend team email error:", teamRes.status, errText)
        }
        if (!clientRes.ok) {
          const errText = await clientRes.text()
          console.error("Resend client email error:", clientRes.status, errText)
        }
      } catch (e) {
        console.error("Resend email failed:", e)
      }

      // Update email_sent flag
      if (emailSent && row?.id) {
        await supabase
          .from("submissions")
          .update({ email_sent: true })
          .eq("id", row.id)
      }
    } else {
      console.warn("RESEND_API_KEY not set — skipping email notification")
    }

    return new Response(
      JSON.stringify({ success: true, emailSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (e) {
    console.error("submit-proposal error:", e)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
