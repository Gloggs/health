/**
 * Transactional email helpers.
 *
 * Uses Resend's HTTP API directly (no SDK dependency) so we don't add 200kb
 * to the Vercel function bundle just for one POST. Returns
 * `{ delivered: boolean, error: string|null }` from every helper - the
 * caller decides whether to surface failure to the user or fall back to
 * "copy-link to share manually."
 *
 * Required env:
 *   RESEND_API_KEY   - your re_*** key. When missing, every send is a no-op
 *                      that returns { delivered: false, error: 'no-api-key' }.
 *                      Lets the rest of the app function without Resend
 *                      configured (dev, or before billing is set up).
 *   EMAIL_FROM       - "Health <noreply@your-domain.com>" or similar. Required
 *                      with RESEND_API_KEY; falls back to "Health
 *                      <onboarding@resend.dev>" (Resend's test domain) if
 *                      not set so dev sends work without a verified domain.
 *   APP_URL          - public origin used to build links. Falls back to
 *                      "https://health.guilduk.com" in production, "http://localhost:3000"
 *                      in dev.
 */

import { getFamilyEmailAllowlist } from "@/lib/env";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

function fromAddress() {
  return process.env.EMAIL_FROM ?? "Health <onboarding@resend.dev>";
}

async function postEmail({ to, subject, html, text, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { delivered: false, error: "no-api-key" };
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: Array.isArray(to) ? to : [to],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject,
        html,
        text,
      }),
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.error(
        `[email] Resend returned ${res.status}: ${errBody.slice(0, 300)}`
      );
      return { delivered: false, error: `resend-${res.status}` };
    }
    return { delivered: true, error: null };
  } catch (err) {
    console.error("[email] fetch threw:", err?.message ?? err);
    return { delivered: false, error: "fetch-threw" };
  }
}

/**
 * Invite-to-join email. Plaintext + minimal HTML so it works in every
 * client (and in plain-text-only screen readers without the visual
 * embellishment getting in the way).
 *
 * The token in `joinUrl` is the secret. Don't include it anywhere else
 * in the body — if someone forwards the email, we want them to know
 * which link is the active one.
 */
export async function sendInviteEmail({ to, familyName, inviterName, joinUrl }) {
  const safeFamily = familyName || "Health";
  const safeInviter = inviterName || "your family";

  const subject = `${safeInviter} invited you to ${safeFamily} on Health`;

  const text = [
    `${safeInviter} invited you to join ${safeFamily} on Health.`,
    ``,
    `Health is a quick daily log for sleep, water, weight, workouts and`,
    `meals. You choose what the family can see.`,
    ``,
    `Open this link to accept:`,
    `${joinUrl}`,
    ``,
    `The link expires in 14 days. If you weren't expecting this, you can`,
    `ignore it. Nothing happens until you open it.`,
  ].join("\n");

  // Inline styles only — most email clients strip <style> blocks.
  const html = `
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F1F1EF;font-family:Arial,Helvetica,sans-serif;color:#142B38;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#F1F1EF;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="max-width:480px;width:100%;background:#fff;border:1px solid #D6D8D8;">
            <tr>
              <td style="padding:32px 28px 8px;">
                <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#586068;">An invite to</p>
                <h1 style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-weight:700;text-transform:uppercase;font-size:28px;line-height:1.1;color:#142B38;">${escapeHtml(safeFamily)}</h1>
                <p style="margin:16px 0 0;font-size:15px;line-height:1.55;color:#142B38;">
                  <strong>${escapeHtml(safeInviter)}</strong> wants you on their family health log.
                  Health is a quick daily log for sleep, water, weight, workouts and meals.
                  You choose what the family can see.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 8px;">
                <a href="${escapeAttr(joinUrl)}" style="display:inline-block;padding:14px 22px;background:#142B38;color:#F1F1EF;text-decoration:none;font-weight:700;font-size:15px;">Accept invite</a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 28px 28px;">
                <p style="margin:0;font-size:12px;line-height:1.55;color:#586068;">
                  Or paste this into your browser:<br>
                  <a href="${escapeAttr(joinUrl)}" style="color:#2F6B8A;word-break:break-all;">${escapeHtml(joinUrl)}</a>
                </p>
                <p style="margin:16px 0 0;font-size:11px;color:#586068;">
                  Expires in 14 days. If you weren't expecting this, ignore it. Nothing happens until you open it.
                </p>
              </td>
            </tr>
          </table>
          <p style="margin:18px 0 0;font-size:11px;color:#586068;">Health, health.guilduk.com</p>
        </td>
      </tr>
    </table>
  </body>
</html>`.trim();

  return postEmail({ to, subject, html, text });
}

function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(s) {
  return escapeHtml(s);
}

/**
 * Founder-facing notification when someone requests a private-beta invite
 * from /request-invite. Sent to INVITE_NOTIFY_EMAIL, or the first address in
 * FAMILY_EMAILS as a sensible default (the founder's inbox). reply_to is set
 * to the requester so the founder can reply straight from their mail client.
 *
 * This does NOT create an account or grant access — approval is a manual
 * step (send them a join link via the existing invite flow).
 */
function notifyAddress() {
  const explicit = process.env.INVITE_NOTIFY_EMAIL?.trim();
  if (explicit) return explicit;
  const [first] = [...getFamilyEmailAllowlist()];
  return first ?? null;
}

export async function sendInviteRequestEmail({ name, email, mode, note }) {
  const to = notifyAddress();
  if (!to) return { delivered: false, error: "no-recipient" };

  const who = name ? `${name} <${email}>` : email;
  const use = mode === "solo" ? "Just them" : "With their household";

  const subject = `Health invite request: ${who}`;
  const text = [
    `New private-beta invite request.`,
    ``,
    `Name:  ${name || "(not given)"}`,
    `Email: ${email}`,
    `Use:   ${use}`,
    `Note:  ${note || "(none)"}`,
    ``,
    `To approve, send them a join link from your family settings.`,
  ].join("\n");

  const html = `
<div style="font-family:Arial,Helvetica,sans-serif;color:#142B38;max-width:480px;">
  <p style="margin:0 0 12px;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#586068;">New invite request</p>
  <table cellspacing="0" cellpadding="0" style="font-size:14px;line-height:1.6;">
    <tr><td style="color:#586068;padding-right:12px;">Name</td><td><strong>${escapeHtml(name || "(not given)")}</strong></td></tr>
    <tr><td style="color:#586068;padding-right:12px;">Email</td><td><a href="mailto:${escapeAttr(email)}" style="color:#2F6B8A;">${escapeHtml(email)}</a></td></tr>
    <tr><td style="color:#586068;padding-right:12px;">Use</td><td>${escapeHtml(use)}</td></tr>
    <tr><td style="color:#586068;padding-right:12px;vertical-align:top;">Note</td><td>${escapeHtml(note || "(none)")}</td></tr>
  </table>
  <p style="margin:16px 0 0;font-size:12px;color:#586068;">To approve, send a join link from your family settings.</p>
</div>`.trim();

  return postEmail({ to, subject, html, text, replyTo: email });
}
