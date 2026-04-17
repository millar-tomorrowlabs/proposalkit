/**
 * admin-issue-invite — mint an invite code on behalf of an admin.
 *
 * POST body:
 *   email:       required, the invitee
 *   plan?:       friends_family | studio | agency | enterprise
 *                defaults to 'friends_family'
 *   notes?:      optional internal memo (not shown to invitee)
 *   sendEmail?:  default true — email the code to the invitee via Resend
 *
 * Returns:
 *   { code, expiresAt, emailSent }   on 200
 *   { error }                         on 4xx/5xx
 *
 * Auth: Bearer token. Caller must be in public.proposl_admins.
 *
 * Deploy:
 *   npx supabase functions deploy admin-issue-invite \
 *     --project-ref nkygheptubvogevezpap --no-verify-jwt
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import {
  adminClient,
  corsHeaders,
  jsonError,
  jsonOk,
  requireAdmin,
} from "../_shared/admin.ts"

const SENDER_DOMAIN = "proposl.app"
const ALLOWED_PLANS = new Set(["friends_family", "studio", "agency", "enterprise"])

interface Body {
  email?: string
  plan?: string
  notes?: string
  sendEmail?: boolean
}

function buildInviteEmailHtml(opts: {
  code: string
  expiresAt: string
  appUrl: string
}): string {
  const signupUrl = `${opts.appUrl}/signup?invite=${encodeURIComponent(opts.code)}`
  const expires = new Date(opts.expiresAt).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  })
  return `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#111;padding:24px;border-radius:12px 12px 0 0;text-align:center">
      <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:20px;font-weight:500;letter-spacing:-0.01em;color:#fff">Proposl</h1>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,#111,#444)"></div>
    <div style="background:#fff;padding:32px 24px;border-radius:0 0 12px 12px;border:1px solid #e5e5e5;border-top:none">
      <p style="margin:0 0 16px;font-size:16px;color:#111">You're invited to try Proposl.</p>
      <p style="margin:0 0 24px;font-size:14px;color:#333;line-height:1.6">
        Proposl is a proposal tool for studios and agencies. We're in invite-only beta right now. Your invite code is below.
      </p>
      <div style="text-align:center;margin:32px 0">
        <div style="display:inline-block;padding:16px 28px;background:#f7f7f4;border:1px dashed #bbb;border-radius:8px;font-family:'SF Mono',Menlo,monospace;font-size:18px;font-weight:600;letter-spacing:0.12em;color:#111">${opts.code}</div>
      </div>
      <div style="text-align:center;margin:24px 0 8px">
        <a href="${signupUrl}" style="display:inline-block;background:#111;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px">Claim your spot</a>
      </div>
      <p style="margin:16px 0 0;font-size:13px;color:#999;line-height:1.6;text-align:center">
        Code expires ${expires}. One code per person.<br>
        If you weren't expecting this, you can safely ignore it.
      </p>
    </div>
    <p style="text-align:center;margin-top:20px;font-size:12px;color:#aaa">Proposl · proposl.app</p>
  </div>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })
  if (req.method !== "POST") return jsonError(405, "Method not allowed")

  const admin = adminClient()
  const auth = await requireAdmin(req, admin)
  if (auth instanceof Response) return auth

  let body: Body
  try {
    body = await req.json()
  } catch {
    return jsonError(400, "Invalid JSON body")
  }

  const email = (body.email ?? "").trim().toLowerCase()
  const plan = (body.plan ?? "friends_family").trim()
  const notes = (body.notes ?? "").trim() || null
  const sendEmail = body.sendEmail !== false // default true

  if (!email) return jsonError(400, "Email is required")
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonError(400, "That doesn't look like a valid email")
  }
  if (!ALLOWED_PLANS.has(plan)) return jsonError(400, "Unknown plan")

  // Mint (or reuse) a code via the DB function. It handles dedupe,
  // expiry, and linking to waitlist_signups.
  const { data: issued, error: issueErr } = await admin.rpc("issue_invite", {
    p_email: email,
    p_plan: plan,
  })
  if (issueErr) {
    console.error("admin-issue-invite rpc error:", issueErr)
    return jsonError(500, "Could not issue invite")
  }

  const row = Array.isArray(issued) ? issued[0] : issued
  const code = row?.code as string | undefined
  const expiresAt = row?.expires_at as string | undefined
  if (!code || !expiresAt) {
    return jsonError(500, "Invite code generation failed")
  }

  // Optional: attach admin notes to the just-issued invite.
  if (notes) {
    await admin
      .from("invite_codes")
      .update({ notes })
      .eq("code", code)
  }

  // Optional email via Resend. Failures here don't fail the whole
  // request — the code is minted either way and surfaced in the
  // response so the admin can send manually if needed.
  let emailSent = false
  let emailError: string | null = null
  if (sendEmail) {
    const resendKey = Deno.env.get("RESEND_API_KEY")
    if (!resendKey) {
      emailError = "RESEND_API_KEY not configured"
    } else {
      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `Proposl <notifications@${SENDER_DOMAIN}>`,
            to: [email],
            subject: "You're invited to try Proposl",
            html: buildInviteEmailHtml({
              code,
              expiresAt,
              appUrl: "https://proposl.app",
            }),
          }),
        })
        emailSent = emailRes.ok
        if (!emailRes.ok) {
          emailError = `Resend returned ${emailRes.status}`
          console.error("Resend error:", emailRes.status, await emailRes.text())
        }
      } catch (e) {
        emailError = "Resend request failed"
        console.error("Resend fetch failed:", e)
      }
    }
  }

  return jsonOk({ code, expiresAt, emailSent, emailError })
})
