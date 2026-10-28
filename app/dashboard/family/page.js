"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Flame,
  Dumbbell,
  Zap,
  Users,
  Bed,
  Smile,
  Footprints,
  Scale,
  UtensilsCrossed,
  Activity,
  Mail,
  Copy,
  Trash2,
  Check,
  Plus,
  Crown,
  ShieldCheck,
  Loader2,
  AlertTriangle,
  MoreVertical,
  UserMinus,
  ArrowUpCircle,
  ArrowDownCircle,
  LogOut,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/relativeTime";
import GlobalApi from "@/app/_services/GlobalApi";
import PageHero from "../_components/PageHero";

// Pull display initials for the avatar circle. We don't store profile
// pictures yet (Kinde only surfaces them for the signed-in user), so a
// monogram is the most truthful fallback. Two letters max so the bubble
// stays legible at 44px.
function initials(name, email) {
  const source = (name && name.trim()) || (email ? email.split("@")[0] : "");
  if (!source) return "?";
  const parts = source.split(/\s+|[._-]/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase().slice(0, 2) || "?";
}

const fetcher = (url) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`family fetch failed (${r.status})`);
    return r.json();
  });

export default function FamilyPage() {
  const { data, error, isLoading, mutate } = useSWR("/api/family", fetcher, {
    revalidateOnFocus: false,
  });

  const members = data?.members ?? [];
  const family = data?.family ?? null;
  const myRole = data?.myRole ?? "member";
  const canInvite = myRole === "owner" || myRole === "admin";

  const activeTodayCount = useMemo(
    () =>
      members.filter(
        (m) => m.streak > 0 || m.completedWorkoutsThisWeek > 0 || m.dailyMiniTodayTotal > 0
      ).length,
    [members]
  );
  // Honest "who has etched today" count (vs. activeTodayCount above which
  // is "active any time this week"). Per SURFACES.md §3 header copy.
  const etchedTodayCount = useMemo(
    () => members.filter((m) => m.etchedToday).length,
    [members]
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PageHero
        eyebrow="family"
        title={family?.name ?? "Family"}
        subtitle={
          isLoading
            ? "Loading the roster…"
            : members.length === 0
            ? "No one yet."
            : `${members.length} member${members.length === 1 ? "" : "s"} keeping each other honest.`
        }
        right={
          !isLoading && members.length > 0 ? (
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
                {etchedTodayCount}
              </span>
              <span className="font-handwritten text-base text-muted-foreground">
                of {members.length} today
              </span>
            </div>
          ) : null
        }
      />

      {error ? (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Couldn't load family. Refresh to retry.
        </div>
      ) : null}

      {/* Leaderboard ribbon - only shown when there's more than one member
          (a leaderboard of one is just bragging). Highlights the top
          performer in three always-visible categories: streak, weekly
          workouts, and today's Daily 4 reps. */}
      {!isLoading && members.length > 1 ? <Leaderboard members={members} /> : null}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36 w-full rounded-2xl" />
          ))}
        </div>
      ) : members.length === 1 ? (
        <SoloEmptyState only={members[0]} canInvite={canInvite} myRole={myRole} onChanged={mutate} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <FamilyTile
              key={m.id}
              member={m}
              myRole={myRole}
              onChanged={mutate}
            />
          ))}
        </div>
      )}

      {/* Invite management - owner + admin only. The full UI lives in a
          dedicated component so the bulk of /dashboard/family stays focused
          on the roster + activity. */}
      {!isLoading && canInvite ? <InviteManager onMembersChanged={mutate} /> : null}

      {/* Activity feed - last 14 days of cross-family events, filtered by
          each member's visibility flags server-side. Shown only when
          there's more than one member (otherwise it's just your own log,
          which is already on Today). */}
      {!isLoading && members.length > 1 ? <ActivityFeed /> : null}
    </div>
  );
}

// Owner / admin-only invite + member management. Hidden entirely for
// regular members (the parent already checks `canInvite` before mounting).
//
// The form deliberately doesn't expose `role=admin` to admins — only the
// owner can mint another admin. The matching server check in /api/invites
// is the actual enforcer; this is just UI honesty.
function InviteManager({ onMembersChanged }) {
  const { data, error, isLoading, mutate } = useSWR("/api/invites", fetcher, {
    revalidateOnFocus: false,
  });
  const pending = (data?.invites ?? []).filter((i) => i.status === "pending");

  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [lastIssued, setLastIssued] = useState(null);

  const send = async (e) => {
    e?.preventDefault?.();
    const v = email.trim().toLowerCase();
    if (!v) {
      toast.error("Enter an email address");
      return;
    }
    setSending(true);
    try {
      const res = await GlobalApi.CreateInvite({ email: v });
      const invite = res.data?.invite;
      setEmail("");
      setLastIssued(invite);
      mutate();
      onMembersChanged?.();
      if (res.data?.emailDelivered) {
        toast.success(`Invite sent to ${v}`);
      } else {
        // Resend not configured / failed — surface the link so the
        // inviter can share it manually.
        toast.success("Invite created, copy the link to share");
      }
    } catch (err) {
      const msg =
        err?.response?.data?.error ?? err?.message ?? "Failed to invite";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  const revoke = async (id) => {
    try {
      await GlobalApi.RevokeInvite(id);
      mutate();
      toast.success("Invite revoked");
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? "Failed";
      toast.error(msg);
    }
  };

  return (
    <div className="rounded-2xl bg-card p-5 shadow-paper-1 paper-texture">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Mail className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Invite to family</p>
            <p className="text-[11px] text-muted-foreground">
              Send a link · expires in 14 days
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={send} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <Label htmlFor="invite-email" className="sr-only">
            Email
          </Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="them@example.com"
            disabled={sending}
            className="h-11"
          />
        </div>
        <Button type="submit" disabled={sending} className="h-11 px-4">
          {sending ? (
            <>
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Sending…
            </>
          ) : (
            <>
              <Plus className="mr-1.5 h-4 w-4" /> Send invite
            </>
          )}
        </Button>
      </form>

      {lastIssued ? (
        <LastIssuedRow invite={lastIssued} onDismiss={() => setLastIssued(null)} />
      ) : null}

      <div className="mt-5">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          Pending
        </p>
        {isLoading ? (
          <div className="mt-2 space-y-2">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : error ? (
          <p className="mt-2 text-xs text-destructive">Couldn't load invites.</p>
        ) : pending.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            No invites out yet. The first one you send shows up here so you
            can copy the link or revoke it.
          </p>
        ) : (
          <ul className="mt-2 divide-y">
            {pending.map((inv) => (
              <PendingInviteRow key={inv.id} invite={inv} onRevoke={revoke} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function PendingInviteRow({ invite, onRevoke }) {
  const [copied, setCopied] = useState(false);
  const expiresIn = useMemo(() => {
    const ms = new Date(invite.expiresAt).getTime() - Date.now();
    if (ms <= 0) return "expired";
    const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    return `${days}d`;
  }, [invite.expiresAt]);

  const copy = async () => {
    if (!invite.link) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy, long-press to copy manually");
    }
  };

  return (
    <li className="flex items-center gap-2 py-2 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{invite.email}</p>
        <p className="text-[11px] text-muted-foreground">
          Expires in {expiresIn}
          {invite.role === "admin" ? " · admin" : ""}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Copy invite link"
        title="Copy link"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={() => onRevoke(invite.id)}
        className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        aria-label="Revoke invite"
        title="Revoke"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function LastIssuedRow({ invite, onDismiss }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!invite?.link) return;
    try {
      await navigator.clipboard.writeText(invite.link);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy, long-press to copy manually");
    }
  };
  return (
    <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <AlertTriangle className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium">
            Invite for {invite.email} ready
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground break-all">
            {invite.link}
          </p>
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-1.5">
        <Button
          type="button"
          variant="outline"
          onClick={onDismiss}
          className="h-8 px-3 text-[11px]"
        >
          Dismiss
        </Button>
        <Button
          type="button"
          onClick={copy}
          className="h-8 px-3 text-[11px]"
        >
          {copied ? (
            <>
              <Check className="mr-1 h-3 w-3" /> Copied
            </>
          ) : (
            <>
              <Copy className="mr-1 h-3 w-3" /> Copy link
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

const FEED_ICONS = {
  sleep: Bed,
  mood: Smile,
  cardio: Footprints,
  body: Scale,
  meals: UtensilsCrossed,
  mini: Zap,
  session: Dumbbell,
};

function ActivityFeed() {
  const { data, isLoading, error } = useSWR("/api/family/activity", fetcher, {
    revalidateOnFocus: true,
  });
  const items = data?.items ?? [];

  return (
    <div className="rounded-2xl bg-card p-5 shadow-paper-1 paper-texture">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Recent activity</p>
            <p className="text-[11px] text-muted-foreground">Last 14 days · respects each person's privacy</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : error ? (
        <p className="mt-4 text-xs text-destructive">Couldn't load activity.</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Nothing shared yet. As family members log their workouts, sleep, meals or weigh-ins, the visible ones land here.
        </p>
      ) : (
        <ul className="mt-4 divide-y">
          {items.map((it, idx) => {
            const Icon = FEED_ICONS[it.kind] ?? Activity;
            const when = formatRelative(it.ts ?? `${it.date}T00:00:00`) ?? it.date;
            return (
              <li key={idx} className="flex items-start gap-2.5 py-2 first:pt-0 last:pb-0">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="font-semibold">{it.userName}</span>{" "}
                    <span className="text-muted-foreground">{it.summary}</span>
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {when}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Leaderboard({ members }) {
  const board = useMemo(() => {
    // For each category, find the highest value and the matching member.
    // Ties resolve to the alphabetically-first displayName so the result is
    // stable across renders. A category with all-zero values shows a
    // "be the first" prompt instead of crowning nobody.
    const pickMax = (key) => {
      let best = null;
      for (const m of members) {
        const v = Number(m[key]) || 0;
        if (v <= 0) continue;
        if (
          !best ||
          v > best.value ||
          (v === best.value &&
            (m.displayName || "").localeCompare(best.name || "") < 0)
        ) {
          best = { name: m.displayName || "Unnamed", value: v, isMe: !!m.isMe };
        }
      }
      return best;
    };
    return {
      streak: pickMax("streak"),
      workouts: pickMax("completedWorkoutsThisWeek"),
      mini: pickMax("dailyMiniTodayTotal"),
    };
  }, [members]);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <LeaderCard
        icon={Flame}
        label="Top streak"
        winner={board.streak}
        unit={(n) => `${n} day${n === 1 ? "" : "s"}`}
        emptyHint="Log something to start"
      />
      <LeaderCard
        icon={Dumbbell}
        label="Workouts this week"
        winner={board.workouts}
        unit={(n) => `${n} session${n === 1 ? "" : "s"}`}
        emptyHint="Be the first to log one"
      />
      <LeaderCard
        icon={Zap}
        label="Daily 4 today"
        winner={board.mini}
        unit={(n) => `${n} reps`}
        emptyHint="Tap any slot to lead"
      />
    </div>
  );
}

function LeaderCard({ icon: Icon, label, winner, unit, emptyHint }) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-3 shadow-paper-1",
        winner?.isMe && "border-primary/50"
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {label}
          </p>
          {winner ? (
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <p className="truncate text-sm font-semibold">
                {winner.isMe ? "You" : winner.name}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                · {unit(winner.value)}
              </p>
            </div>
          ) : (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{emptyHint}</p>
          )}
        </div>
        {winner?.isMe ? (
          <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
            you
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FamilyTile({ member, myRole, onChanged }) {
  // For `isMe`, tap the tile to drop back to the regular Today view (no
  // viewing= param needed). For everyone else, set the param so Phase 2
  // Stage 2's read-only mode picks it up.
  const href = member.isMe ? "/dashboard" : `/dashboard?viewing=${member.id}`;
  const lastSeen = formatRelative(member.lastActiveAt);
  // Show the kebab when the viewer can do *something* with this tile:
  //   - Viewing someone else AND owner/admin → manage them
  //   - Viewing own tile AND not the family owner → "Leave family"
  // The MemberMenu component is the one that decides which actions are
  // actually allowed per role; this just gates whether the kebab appears.
  const canManageOthers = !member.isMe && (myRole === "owner" || myRole === "admin");
  const canSelfLeave = member.isMe && myRole !== "owner";
  const showMenu = canManageOthers || canSelfLeave;

  return (
    <div className="relative">
      <Link
        href={href}
        className={cn(
          "hover-lift group block rounded-2xl bg-card p-4 shadow-paper-1 paper-texture",
          member.isMe && "border-primary/40"
        )}
      >
        <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
            member.isMe
              ? "bg-primary text-primary-foreground"
              : "bg-primary/15 text-primary"
          )}
          aria-hidden="true"
        >
          {initials(member.displayName, member.email)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">
              {member.displayName || "Unnamed"}
            </p>
            {member.age != null ? (
              <span className="text-xs text-muted-foreground">· {member.age}</span>
            ) : null}
            {member.isMe ? (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                you
              </span>
            ) : null}
            {member.role === "owner" ? (
              <Crown
                className="h-3 w-3 text-warning"
                aria-label="Owner"
                title="Owner"
              />
            ) : member.role === "admin" ? (
              <ShieldCheck
                className="h-3 w-3 text-muted-foreground"
                aria-label="Admin"
                title="Admin"
              />
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {lastSeen ? `Last seen ${lastSeen}` : "Hasn't signed in yet"}
          </p>
        </div>
      </div>

      {/* 7-day strip per SURFACES.md §3 — small dots representing each of
          the last 7 days, density = number of categories logged that day.
          Today is the rightmost slot. Gives a glance-friendly read of
          whether this member has been active recently without revealing
          per-category details (visibility-respected on the server). */}
      <div className="mt-3 border-t pt-3">
        <div className="flex items-end justify-between gap-1">
          {(member.last7DaysTally ?? Array(7).fill(0)).map((c, i) => {
            const isToday = i === 6;
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-1"
                title={
                  c === 0
                    ? isToday
                      ? "Nothing today yet"
                      : "Nothing"
                    : `${c} logged`
                }
              >
                <span
                  className={cn(
                    "h-5 w-3.5 rounded-sm transition-colors",
                    c >= 5
                      ? "bg-primary"
                      : c >= 3
                      ? "bg-primary/70"
                      : c >= 1
                      ? "bg-primary/35"
                      : "border border-dashed border-border/60",
                    isToday && c === 0 && "ring-1 ring-primary/40"
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    "text-[8px] font-medium uppercase tracking-wider",
                    isToday ? "text-primary" : "text-muted-foreground/70"
                  )}
                >
                  {dayLetter(i)}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          <span className="font-mono font-bold tabular-nums text-foreground">
            {member.etchedTodayCount ?? 0}
          </span>{" "}
          of 7 logged today
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 border-t pt-3">
        <Stat icon={Flame} value={member.streak} label="streak" />
        <Stat icon={Dumbbell} value={member.completedWorkoutsThisWeek} label="this week" />
        <Stat icon={Zap} value={member.dailyMiniTodayTotal} label="mini today" />
      </div>
    </Link>
    {showMenu ? (
      <MemberMenu
        member={member}
        myRole={myRole}
        onChanged={onChanged}
      />
    ) : null}
    </div>
  );
}

// Per-tile dropdown that surfaces the role-aware management actions.
// Sits absolutely positioned at the top-right of the FamilyTile,
// OUTSIDE the wrapping Link so clicks don't navigate. Two modes:
//   - Acting on someone else (canManageOthers branch in FamilyTile):
//     promote/demote (owner only), kick (owner+admin per server rules).
//   - Acting on self (canSelfLeave branch): just "Leave family".
//
// Server is the actual authority — these UI checks just avoid showing
// buttons the server would 403. The /api/family/members and
// /api/family/leave routes re-verify every constraint.
function MemberMenu({ member, myRole, onChanged }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const isMe = !!member.isMe;
  const targetRole = member.role ?? "member";
  const canPromote = !isMe && myRole === "owner" && targetRole === "member";
  const canDemote = !isMe && myRole === "owner" && targetRole === "admin";
  const canRemove =
    !isMe &&
    targetRole !== "owner" &&
    (myRole === "owner" || (myRole === "admin" && targetRole === "member"));
  const canLeave = isMe && myRole !== "owner";

  const setRole = async (nextRole) => {
    if (busy) return;
    setBusy(true);
    try {
      await GlobalApi.SetMemberRole(member.id, nextRole);
      toast.success(
        nextRole === "admin"
          ? `${member.displayName ?? "Member"} is now an admin`
          : `${member.displayName ?? "Member"} is now a regular member`
      );
      onChanged?.();
      setOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.error ?? err?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await GlobalApi.RemoveMember(member.id);
      toast.success(`${member.displayName ?? "Member"} removed`);
      onChanged?.();
      setOpen(false);
    } catch (err) {
      toast.error(err?.response?.data?.error ?? err?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await GlobalApi.LeaveFamily();
      toast.success("You've left the family");
      // Middleware will route to /onboarding next request — push there
      // directly to skip the flash of /dashboard/family with no data.
      router.push("/onboarding");
    } catch (err) {
      toast.error(err?.response?.data?.error ?? err?.message ?? "Failed");
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Member actions"
          className="absolute right-1.5 top-1.5 z-10 flex h-11 w-11 items-center justify-center rounded-md bg-card text-muted-foreground backdrop-blur transition-colors hover:bg-accent hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        {canPromote ? (
          <MenuItem
            icon={ArrowUpCircle}
            label="Make admin"
            onClick={() => setRole("admin")}
            disabled={busy}
          />
        ) : null}
        {canDemote ? (
          <MenuItem
            icon={ArrowDownCircle}
            label="Demote to member"
            onClick={() => setRole("member")}
            disabled={busy}
          />
        ) : null}
        {canRemove ? (
          <ConfirmMenuItem
            icon={UserMinus}
            label={`Remove ${member.displayName ?? "member"}`}
            tone="destructive"
            disabled={busy}
            title={`Remove ${member.displayName ?? "member"} from the family?`}
            description={
              targetRole === "admin"
                ? `${member.displayName ?? "They"}'ll lose admin powers and access to family data. They can be re-invited later, their personal data stays with them.`
                : `${member.displayName ?? "They"}'ll lose access to family data. They can be re-invited later, their personal data stays with them.`
            }
            confirmLabel="Remove"
            onConfirm={remove}
          />
        ) : null}
        {canLeave ? (
          <ConfirmMenuItem
            icon={LogOut}
            label="Leave family"
            tone="destructive"
            disabled={busy}
            title="Leave this family?"
            description="You'll lose access to family data until someone re-invites you. Your personal entries stay with you."
            confirmLabel="Leave"
            onConfirm={leave}
          />
        ) : null}
        {!canPromote && !canDemote && !canRemove && !canLeave ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            No actions available.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function MenuItem({ icon: Icon, label, onClick, disabled, tone = "default" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-50",
        tone === "destructive"
          ? "text-destructive hover:bg-destructive/10"
          : "hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

// Same shape as MenuItem but routes through an AlertDialog before firing
// the destructive action. Used for remove + leave, where an accidental
// tap would be costly.
function ConfirmMenuItem({
  icon: Icon,
  label,
  title,
  description,
  confirmLabel,
  onConfirm,
  disabled,
  tone,
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors disabled:opacity-50",
            tone === "destructive"
              ? "text-destructive hover:bg-destructive/10"
              : "hover:bg-accent hover:text-foreground"
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-serif">{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={
              tone === "destructive"
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : undefined
            }
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// 7-day strip column labels relative to today (index 0 = 6 days ago,
// index 6 = today). Uses the actual weekday letter for each slot so the
// strip reads honestly regardless of when "today" is — Monday's strip
// shows T W T F S S M, Friday's shows S S M T W T F.
function dayLetter(idx) {
  const d = new Date();
  d.setDate(d.getDate() - (6 - idx));
  return d.toLocaleDateString("en-GB", { weekday: "narrow" });
}

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-baseline gap-1">
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="font-mono text-lg font-bold tabular-nums leading-none">{value}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

function SoloEmptyState({ only, canInvite, myRole, onChanged }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <FamilyTile member={only} myRole={myRole} onChanged={onChanged} />
      </div>
      <div className="rounded-2xl border border-dashed bg-card p-5 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Just you in here so far.</p>
        <p className="mt-1">
          {canInvite
            ? "Use the Invite to family card below to send a link. Once they accept, they show up here automatically."
            : "Ask the family owner to invite more people. They'll show up here once each person accepts the link."}
        </p>
      </div>
    </div>
  );
}
