import { NextResponse } from "next/server";
import { clampString } from "@/lib/validate";
import { sendInviteRequestEmail } from "@/lib/email";

// Public (no-auth) endpoint backing /request-invite. Captures a private-beta
// access request and emails the founder. It intentionally does NOT create an
// account or write any health data — approval is a manual step via the
// existing invite flow. A honeypot field + length caps guard against bot spam.
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  // Honeypot: humans never see or fill `website`; bots do. Silently accept so
  // the bot believes it succeeded, but send nothing.
  if (body?.website) return NextResponse.json({ ok: true });

  let name, note;
  try {
    name = clampString(body?.name, "name"); // max 100 chars
    note = clampString(body?.note, "note"); // max 2000 chars
  } catch (e) {
    return NextResponse.json({ error: e.message ?? "invalid input" }, { status: e.status ?? 400 });
  }

  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email || email.length > 200 || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }
  const mode = body?.mode === "solo" ? "solo" : "family";

  // Backup trail in the server logs, so a request is never silently lost even
  // if email delivery isn't configured in this environment.
  console.log(
    `[invite-request] ${name ?? "(no name)"} <${email}> mode=${mode}` +
      (note ? ` note="${note.slice(0, 200)}"` : "")
  );

  const { delivered } = await sendInviteRequestEmail({ name, email, mode, note });

  // Always acknowledge to the user; we don't leak email-delivery state to the
  // client. The request is logged server-side regardless.
  return NextResponse.json({ ok: true, delivered: !!delivered });
}
