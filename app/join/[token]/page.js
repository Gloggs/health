"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2,
  Mail,
  Users,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  LogIn,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import HealthMark from "@/components/HealthMark";
import GlobalApi from "@/app/_services/GlobalApi";

// Public landing for invite links. Two main jobs:
//   1. Fetch invite metadata (family name, inviter, role, expiry) so the
//      visitor sees "Mum invited you to The Smiths" instead of a token
//      string. Doesn't require sign-in.
//   2. Drive the user to accept:
//      - Not signed in -> "Sign in to accept" button -> Kinde login with
//        post-login redirect back to this same page. The page re-runs,
//        notices the session, and triggers accept.
//      - Signed in -> auto-accept on mount (loading -> success ->
//        redirect to /onboarding). The user shouldn't have to click an
//        extra "yes I accept" button when they already clicked the
//        invite link and signed in.
//
// Error states we render explicitly:
//   - 404 invalid token
//   - status='accepted' (already redeemed)
//   - status='revoked' (owner pulled it)
//   - status='expired' (>14 days)
//   - 403 email-mismatch (signed in as wrong account)

export default function JoinPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token;

  const [phase, setPhase] = useState("loading"); // loading | invite-ready | accepting | success | error
  const [invite, setInvite] = useState(null);
  const [errorBody, setErrorBody] = useState(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await GlobalApi.ValidateInvite(token);
        if (cancelled) return;
        const data = r.data;
        if (data.status !== "pending") {
          setErrorBody({ kind: data.status });
          setPhase("error");
          return;
        }
        setInvite(data);
        // Try to auto-accept immediately — if the user is already signed in
        // (returning from Kinde, or had a session), this completes the
        // round-trip in a single mount. If they aren't signed in, the
        // accept call 401s and we drop to "sign in to accept" UI.
        setPhase("accepting");
        try {
          const accept = await GlobalApi.AcceptInvite(token);
          if (cancelled) return;
          if (accept.data?.ok) {
            setPhase("success");
            // Brief beat to read the success state, then forward.
            setTimeout(() => router.replace("/onboarding"), 700);
          } else {
            setPhase("invite-ready"); // unexpected shape; let user click
          }
        } catch (acceptErr) {
          if (cancelled) return;
          const status = acceptErr?.response?.status;
          if (status === 401) {
            // Not signed in. Show the sign-in CTA.
            setPhase("invite-ready");
          } else if (status === 403) {
            // Email mismatch. Surface the detail so the user knows which
            // account to switch to.
            setErrorBody({
              kind: "email-mismatch",
              wantedEmail: acceptErr.response?.data?.wantedEmail,
              actualEmail: acceptErr.response?.data?.actualEmail,
            });
            setPhase("error");
          } else if (status === 410) {
            setErrorBody({
              kind: acceptErr.response?.data?.error ?? "already-settled",
            });
            setPhase("error");
          } else {
            setErrorBody({
              kind: "accept-failed",
              message:
                acceptErr?.response?.data?.error ??
                acceptErr?.message ??
                "Something went wrong",
            });
            setPhase("error");
          }
        }
      } catch (err) {
        if (cancelled) return;
        const status = err?.response?.status;
        if (status === 404) {
          setErrorBody({ kind: "not-found" });
        } else {
          setErrorBody({
            kind: "load-failed",
            message: err?.message ?? "Couldn't load invite",
          });
        }
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, router]);

  const signInUrl =
    "/api/auth/login?post_login_redirect_url=" +
    encodeURIComponent(`/join/${token ?? ""}`);

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <HealthMark size={28} />
          <p className="font-serif text-sm font-semibold">Health</p>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-10 sm:max-w-lg sm:px-6">
        {phase === "loading" ? (
          <CenterStatus
            icon={<Loader2 className="h-7 w-7 animate-spin" />}
            title="Loading invite…"
          />
        ) : null}

        {phase === "accepting" ? (
          <CenterStatus
            icon={<Loader2 className="h-7 w-7 animate-spin" />}
            title="Joining…"
            subtitle="One second"
          />
        ) : null}

        {phase === "success" ? (
          <CenterStatus
            icon={
              <CheckCircle2 className="h-7 w-7 text-success" aria-hidden />
            }
            title="You're in."
            subtitle="Setting up your profile…"
          />
        ) : null}

        {phase === "invite-ready" && invite ? (
          <div className="w-full space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                An invite to
              </p>
              <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
                {invite.familyName}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {invite.inviterName}
                </span>{" "}
                wants you on their family health log. Sleep, meals, workouts,
                weigh-ins, tracked by hand, shared with the people who keep
                you honest.
              </p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-left">
              <div className="flex items-start gap-3">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Sent to
                  </p>
                  <p className="truncate text-sm font-medium">{invite.email}</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                You must sign in with this exact address. Different inbox?
                Ask whoever invited you to re-send to the right one.
              </p>
            </div>
            <Button asChild className="h-12 w-full text-base font-semibold">
              <Link href={signInUrl}>
                <LogIn className="mr-1.5 h-4 w-4" /> Sign in to accept
              </Link>
            </Button>
          </div>
        ) : null}

        {phase === "error" && errorBody ? (
          <ErrorView errorBody={errorBody} token={token} />
        ) : null}
      </main>
    </div>
  );
}

function CenterStatus({ icon, title, subtitle }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center text-muted-foreground">
      {icon}
      <p className="text-base font-medium text-foreground">{title}</p>
      {subtitle ? <p className="text-xs">{subtitle}</p> : null}
    </div>
  );
}

function ErrorView({ errorBody, token }) {
  const signInUrl =
    "/api/auth/login?post_login_redirect_url=" +
    encodeURIComponent(`/join/${token ?? ""}`);
  const logoutUrl =
    "/api/auth/logout?post_logout_redirect_url=" +
    encodeURIComponent(`/join/${token ?? ""}`);

  let icon = <XCircle className="h-7 w-7 text-destructive" aria-hidden />;
  let title = "This invite isn't valid";
  let body = "Ask the person who invited you to send a fresh link.";
  let action = null;

  if (errorBody.kind === "not-found") {
    title = "Invite not found";
    body =
      "The link might be mistyped. Copy it from the original email or text and try again.";
  } else if (errorBody.kind === "expired") {
    icon = <Clock className="h-7 w-7 text-warning" aria-hidden />;
    title = "This invite expired";
    body = "Invites are good for 14 days. Ask for a fresh one.";
  } else if (errorBody.kind === "revoked") {
    icon = <XCircle className="h-7 w-7 text-destructive" aria-hidden />;
    title = "This invite was revoked";
    body =
      "The family owner pulled the link. If that's a mistake, ask them to re-send.";
  } else if (errorBody.kind === "accepted") {
    icon = <CheckCircle2 className="h-7 w-7 text-success" aria-hidden />;
    title = "This invite was already used";
    body =
      "Already signed in to the family on another device? Open the app from there. Or ask for a new invite if this wasn't you.";
    action = (
      <Button asChild className="h-12 w-full">
        <Link href="/dashboard">
          Open Health <ArrowRight className="ml-1.5 h-4 w-4" />
        </Link>
      </Button>
    );
  } else if (errorBody.kind === "email-mismatch") {
    icon = <AlertTriangle className="h-7 w-7 text-warning" aria-hidden />;
    title = "Wrong account";
    body = `This invite was sent to ${errorBody.wantedEmail ?? "a different address"}. You're signed in as ${errorBody.actualEmail ?? "another account"}. Sign out and sign back in with the right one.`;
    action = (
      <Button asChild variant="outline" className="h-12 w-full">
        <Link href={logoutUrl}>Sign out and switch account</Link>
      </Button>
    );
  } else if (errorBody.kind === "already-settled") {
    title = "This invite isn't usable anymore";
    body = "It may have been accepted or revoked. Ask for a fresh one.";
  } else if (errorBody.kind === "accept-failed") {
    title = "Couldn't accept";
    body = errorBody.message ?? "Try again in a moment.";
    action = (
      <Button asChild className="h-12 w-full">
        <Link href={signInUrl}>
          <LogIn className="mr-1.5 h-4 w-4" /> Try again
        </Link>
      </Button>
    );
  } else if (errorBody.kind === "load-failed") {
    title = "Couldn't load invite";
    body = errorBody.message ?? "Check your connection and try again.";
  }

  return (
    <div className="w-full space-y-6 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        {icon}
      </div>
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
      </div>
      {action}
    </div>
  );
}
