import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from "jsr:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

const SENDER_DOMAIN = "proposl.app"

interface InviteBody {
  accountId: string
  email: string
  role?: "owner" | "member"
}

function buildInviteEmailHtml(opts: {
  accountName: string
  inviterName: string
  role: string
  token: string
  appUrl: string
}): string {
  const inviteUrl = `${opts.appUrl}/invite/${opts.token}`

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
      <p style="margin:0 0 16px;font-size:16px;color:#111">You've been invited</p>
      <p style="margin:0 0 24px;font-size:14px;color:#333;line-height:1.6">
        <strong>${opts.inviterName}</strong> has invited you to join <strong>${opts.accountName}</strong> on Proposl as a ${opts.role}.
      </p>
      <div style="text-align:center;margin:32px 0">
        <a href="${inviteUrl}" style="display:inline-block;background:#111;color:#fff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:50px">Accept Invitation</a>
      </div>
      <p style="margin:0;font-size:13px;color:#999;line-height:1.6;text-align:center">
        This invite expires in 7 days.<br>
        If you weren't expecting this, you can safely ignore it.
      </p>
    </div>
    <p style="text-align:center;margin-top:20px;font-size:12px;color:#aaa">Proposl · proposl.app</p>
  </div>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const body: InviteBody = await req.json()

    if (!body.accountId || !body.email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: accountId, email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Authenticate caller
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

    // Verify caller is an owner of this account
    const { data: callerMembership } = await supabase
      .from("account_members")
      .select("role, display_name")
      .eq("account_id", body.accountId)
      .eq("user_id", user.id)
      .single()

    if (!callerMembership || callerMembership.role !== "owner") {
      return new Response(
        JSON.stringify({ error: "Only account owners can send invites" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Check if user is already a member
    const { data: existingMember } = await supabase
      .from("account_members")
      .select("id")
      .eq("account_id", body.accountId)
      .eq("user_id", (
        // Look up user by email
        await supabase.auth.admin.listUsers()
      ).data?.users?.find(u => u.email === body.email.toLowerCase())?.id ?? "00000000-0000-0000-0000-000000000000")
      .maybeSingle()

    if (existingMember) {
      return new Response(
        JSON.stringify({ error: "This user is already a member of this account" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Check for existing pending invite
    const { data: existingInvite } = await supabase
      .from("account_invites")
      .select("id")
      .eq("account_id", body.accountId)
      .eq("email", body.email.toLowerCase())
      .is("accepted_at", null)
      .maybeSingle()

    if (existingInvite) {
      return new Response(
        JSON.stringify({ error: "An invite has already been sent to this email" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Get account name for the email
    const { data: account } = await supabase
      .from("accounts")
      .select("studio_name, sender_name")
      .eq("id", body.accountId)
      .single()

    if (!account) {
      return new Response(
        JSON.stringify({ error: "Account not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Create invite
    const role = body.role ?? "member"
    const { data: invite, error: insertError } = await supabase
      .from("account_invites")
      .insert({
        account_id: body.accountId,
        email: body.email.toLowerCase(),
        role,
        invited_by: user.id,
      })
      .select("id, token")
      .single()

    if (insertError || !invite) {
      console.error("Insert invite error:", insertError)
      return new Response(
        JSON.stringify({ error: "Failed to create invite" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Send invite email via Resend
    const resendKey = Deno.env.get("RESEND_API_KEY")
    let emailSent = false

    if (resendKey) {
      const appUrl = "https://proposl.app"
      const senderName = account.sender_name ?? account.studio_name ?? "Proposl"
      const inviterName = callerMembership.display_name ?? user.email ?? "A team member"

      try {
        const emailRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: `${senderName} <notifications@${SENDER_DOMAIN}>`,
            to: [body.email],
            subject: `You're invited to join ${account.studio_name} on Proposl`,
            html: buildInviteEmailHtml({
              accountName: account.studio_name,
              inviterName,
              role,
              token: invite.token,
              appUrl,
            }),
          }),
        })

        emailSent = emailRes.ok
        if (!emailRes.ok) {
          const errText = await emailRes.text()
          console.error("Resend invite email error:", emailRes.status, errText)
        }
      } catch (e) {
        console.error("Resend invite email failed:", e)
      }
    }

    return new Response(
      JSON.stringify({ success: true, inviteId: invite.id, emailSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (e) {
    console.error("invite-member error:", e)
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
