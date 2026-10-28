"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useKindeBrowserClient } from "@kinde-oss/kinde-auth-nextjs";
import { Bell, Eye, EyeOff, MessageCircle, ArrowRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/relativeTime";
import GlobalApi from "@/app/_services/GlobalApi";

// Bell + popover panel in the TopBar.
//
// Carries two notification streams behind one badge:
//   1. Profile views (server-tracked unread via PROFILE_VIEWS.readAt).
//   2. Family chat (client-tracked via localStorage cursor; sync per
//      device, intentional - avoids another db:push for v1).
//
// Both poll every 60s + revalidate on focus. Opening the panel clears
// both: server mark-as-read for views, localStorage cursor bump for
// chat. Optimistic clears keep the badge from flashing during the
// SWR reconciliation cycle.

const fetcher = (url) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`bell fetch failed (${r.status})`);
    return r.json();
  });

const POLL_MS = 60_000;
const CHAT_CURSOR_KEY = "familyChat.lastReadId";

function relativeViewTime(item) {
  return (
    formatRelative(item?.createdAt) ??
    formatRelative(item?.date ? `${item.date}T00:00:00` : null) ??
    item?.date ??
    ""
  );
}

function readChatCursor() {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(CHAT_CURSOR_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function writeChatCursor(id) {
  if (typeof window === "undefined") return;
  if (!Number.isFinite(id) || id <= 0) return;
  window.localStorage.setItem(CHAT_CURSOR_KEY, String(id));
}

export default function NotificationsBell() {
  const { user } = useKindeBrowserClient();
  const viewerId = user?.id ?? null;

  const { data: viewsData, mutate: mutateViews } = useSWR(
    "/api/family/views",
    fetcher,
    { refreshInterval: POLL_MS, revalidateOnFocus: true }
  );
  const { data: chatData } = useSWR(
    "/api/family/chat?limit=20",
    fetcher,
    { refreshInterval: POLL_MS, revalidateOnFocus: true }
  );

  const [open, setOpen] = useState(false);
  const [optimisticUnreadViews, setOptimisticUnreadViews] = useState(null);
  // The chat cursor is read once on mount + whenever the panel opens.
  // We don't track it as live state outside that because the unread
  // computation derives from cursor + chatData and would re-render
  // unnecessarily on every render otherwise.
  const [chatCursor, setChatCursor] = useState(0);
  useEffect(() => {
    setChatCursor(readChatCursor());
  }, []);

  // === Profile-view unread ===
  const unreadViewsCount =
    optimisticUnreadViews != null
      ? optimisticUnreadViews
      : viewsData?.unreadCount ?? 0;
  const inbound = viewsData?.inbound ?? [];
  const outbound = viewsData?.outbound ?? [];

  const viewItems = useMemo(() => {
    const merged = [
      ...inbound.map((r) => ({ ...r, direction: "in" })),
      ...outbound.map((r) => ({ ...r, direction: "out" })),
    ];
    merged.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      const ac = a.createdAt ?? "";
      const bc = b.createdAt ?? "";
      return ac < bc ? 1 : ac > bc ? -1 : 0;
    });
    return merged;
  }, [inbound, outbound]);

  // === Family-chat unread ===
  // Filter own messages out so posting in the room doesn't badge yourself.
  // First-time visit (cursor = 0) is special-cased below to avoid greeting
  // every new user with a "20 unread" badge on day one.
  // Response shape since the typing-indicator change: { messages, typing }.
  // Older callers expected a bare array - the `.messages ?? chatData` fallback
  // keeps that working until any stale clients cycle out.
  const chatMessages = useMemo(
    () => (chatData?.messages ?? (Array.isArray(chatData) ? chatData : [])).filter((m) => m && m.id),
    [chatData]
  );
  const chatMaxId = useMemo(
    () => chatMessages.reduce((m, msg) => (msg.id > m ? msg.id : m), 0),
    [chatMessages]
  );
  const unreadChatCount = useMemo(() => {
    if (chatCursor === 0) return 0; // first paint: treat history as seen
    return chatMessages.filter(
      (m) => m.id > chatCursor && m.userId !== viewerId
    ).length;
  }, [chatMessages, chatCursor, viewerId]);

  // On the very first render with chat data loaded, seed the cursor to
  // the highest id so the badge doesn't open at "N unread" - the user is
  // implicitly caught up because they've just arrived. Only runs once;
  // afterward the cursor only moves when the panel opens.
  useEffect(() => {
    if (chatCursor !== 0) return;
    if (chatMaxId <= 0) return;
    writeChatCursor(chatMaxId);
    setChatCursor(chatMaxId);
  }, [chatCursor, chatMaxId]);

  // === Combined badge ===
  const unreadTotal = unreadViewsCount + unreadChatCount;
  const showBadge = unreadTotal > 0;
  const badgeText = unreadTotal > 9 ? "9+" : String(unreadTotal);

  // === Mark-as-read on open ===
  useEffect(() => {
    if (!open) return;
    // Views: server-side mark-read.
    if (unreadViewsCount > 0) {
      setOptimisticUnreadViews(0);
      GlobalApi.MarkViewsRead()
        .then(() => mutateViews())
        .catch(() => {
          setOptimisticUnreadViews(null);
        });
    }
    // Chat: localStorage cursor bump to current max id.
    if (chatMaxId > chatCursor) {
      writeChatCursor(chatMaxId);
      setChatCursor(chatMaxId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset the optimistic-views value once the server confirms zero.
  useEffect(() => {
    if (
      optimisticUnreadViews === 0 &&
      (viewsData?.unreadCount ?? 0) === 0
    ) {
      setOptimisticUnreadViews(null);
    }
  }, [optimisticUnreadViews, viewsData?.unreadCount]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={
            showBadge ? `Notifications (${unreadTotal} unread)` : "Notifications"
          }
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {showBadge ? (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold tabular-nums text-primary-foreground"
              )}
            >
              {badgeText}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="px-4 pt-4 pb-2">
          <p className="font-handwritten text-lg leading-none text-primary/80">
            notifications
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {unreadTotal === 0
              ? "Quiet for now."
              : `${unreadTotal} new since you last checked.`}
          </p>
        </div>
        <div className="max-h-[24rem] overflow-y-auto border-t">
          {/* Family chat section */}
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              <p className="font-serif text-sm font-semibold">Family room</p>
              {unreadChatCount > 0 ? (
                <span className="rounded-full bg-primary/15 px-1.5 py-0 font-mono text-[10px] font-medium tabular-nums text-primary">
                  {unreadChatCount} new
                </span>
              ) : null}
            </div>
            <Link
              href="/dashboard/chat"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
            >
              Open <ArrowRight className="h-2.5 w-2.5" />
            </Link>
          </div>
          <ul className="border-b">
            {chatMessages.length === 0 ? (
              <li className="px-3 py-3 text-center font-handwritten text-base text-muted-foreground">
                nothing here yet
              </li>
            ) : (
              chatMessages.slice(0, 4).map((m) => (
                <ChatRow
                  key={m.id}
                  msg={m}
                  isMine={m.userId === viewerId}
                  isUnread={m.id > chatCursor && m.userId !== viewerId}
                />
              ))
            )}
          </ul>

          {/* Profile-view section */}
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-primary" />
              <p className="font-serif text-sm font-semibold">Profile views</p>
            </div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Last 30 days
            </p>
          </div>
          <ul>
            {viewItems.length === 0 ? (
              <li className="px-3 py-6 text-center font-handwritten text-base text-muted-foreground">
                no one's peeked yet
              </li>
            ) : (
              viewItems.map((item) => (
                <ViewRow key={`${item.direction}-${item.id}`} item={item} />
              ))
            )}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ChatRow({ msg, isMine, isUnread }) {
  const when = formatRelative(msg.createdAt) ?? "";
  const name = isMine ? "You" : msg.authorName || "Someone";
  return (
    <li
      className={cn(
        "flex items-start gap-2 border-b px-3 py-2 last:border-b-0",
        isUnread && "bg-primary/5"
      )}
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
        <MessageCircle className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className="font-semibold">{name}</span>
          <span className="text-muted-foreground"> · {when}</span>
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {msg.content}
        </p>
      </div>
    </li>
  );
}

function ViewRow({ item }) {
  const day = relativeViewTime(item);
  if (item.direction === "in") {
    const name = item.viewerName || "Someone";
    const unread = item.readAt == null;
    return (
      <li
        className={cn(
          "flex items-start gap-2 border-b px-3 py-2 last:border-b-0",
          unread && "bg-primary/5"
        )}
      >
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Eye className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs">
            <span className="font-semibold">{name}</span>{" "}
            <span className="text-muted-foreground">checked your profile</span>
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {day}
          </p>
        </div>
      </li>
    );
  }
  const name = item.vieweeName || "someone";
  return (
    <li className="flex items-start gap-2 border-b px-3 py-2 last:border-b-0">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <EyeOff className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs">
          <span className="text-muted-foreground">You checked</span>{" "}
          <span className="font-semibold">{name}</span>
        </p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {day}
        </p>
      </div>
    </li>
  );
}
