"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
  Send,
  Search,
  Trash2,
  MessageCircle,
  X,
  Pencil,
  Check,
  Users as UsersIcon,
  NotebookPen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
import { todayDateStr, prettyDate } from "@/lib/dates";
import { useViewerId } from "@/lib/hooks";
import { formatRelative } from "@/lib/relativeTime";
import GlobalApi from "@/app/_services/GlobalApi";
import PageHero from "../_components/PageHero";
import EmptyState from "../_components/states/EmptyState";

function errMsg(err, fallback) {
  return err?.response?.data?.error ?? err?.message ?? fallback;
}

const TAB_STORAGE_KEY = "chat.activeTab";

// /dashboard/chat hosts two surfaces behind a tab switcher:
//   - Journal: per-user private diary. Pre-existing behaviour, unchanged.
//   - Family: shared chat room for the whole family. New in P3.S1.
// Tab choice is persisted in localStorage so a user who lives in one
// stays there across visits.
export default function ChatPage() {
  const [tab, setTab] = useState("family");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(TAB_STORAGE_KEY);
    if (saved === "family" || saved === "journal") setTab(saved);
  }, []);

  const switchTab = (next) => {
    setTab(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TAB_STORAGE_KEY, next);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-4 md:p-6">
      <PageHero
        eyebrow="chat"
        title={tab === "family" ? "Family room" : "Journal"}
        subtitle={
          tab === "family"
            ? "The shared room — quick check-ins, no notifications until you turn them on."
            : "Just you. Nobody else sees this, ever."
        }
      />

      <div className="flex gap-1 rounded-lg bg-card/50 p-1">
        <TabButton
          active={tab === "family"}
          onClick={() => switchTab("family")}
          icon={UsersIcon}
          label="Family"
          hint="Shared room"
        />
        <TabButton
          active={tab === "journal"}
          onClick={() => switchTab("journal")}
          icon={NotebookPen}
          label="Journal"
          hint="Just you"
        />
      </div>

      {tab === "family" ? <FamilyChatView /> : <JournalView />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span
        className={cn(
          "hidden text-[10px] font-normal sm:inline",
          active ? "text-primary-foreground/80" : "text-muted-foreground"
        )}
      >
        · {hint}
      </span>
    </button>
  );
}

// =====================================================================
// Family chat room (kind='family')
// =====================================================================

// 1.5s when the tab is visible - tight enough that messages AND the
// "X is typing..." indicator both feel snappy. Pauses when the tab is
// hidden to save battery + cost. Family-of-7 scale = ~5 reqs/sec at
// peak, well within Neon serverless capacity.
const FAMILY_POLL_MS_ACTIVE = 1_500;
// Time between typing-indicator pings while actively typing. The server
// stores `typing_until = now + 5s`, so any ping within 5s keeps the
// indicator alive. Picking 1.5s here means up-to-three pings will fire
// before the window expires - resilient to one being dropped.
const TYPING_PING_INTERVAL_MS = 1_500;

const fetcher = (url) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`family chat fetch failed (${r.status})`);
    return r.json();
  });

function authorInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase().slice(0, 2) || "?";
}

// Tracks document.visibilityState so SWR pauses the chat poll when
// the tab is hidden (mobile screen off, switched away, etc).
function useTabVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (typeof document === "undefined") return;
    setVisible(!document.hidden);
    const onVis = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return visible;
}

function FamilyChatView() {
  const myId = useViewerId();
  const visible = useTabVisible();
  const { data, mutate, isLoading, error } = useSWR(
    "/api/family/chat?limit=100",
    fetcher,
    {
      refreshInterval: visible ? FAMILY_POLL_MS_ACTIVE : 0,
      revalidateOnFocus: true,
    }
  );
  // Response shape: { messages, typing }. Messages come newest-first;
  // flip to oldest-first for the chat-style stream so the composer
  // always shows the most recent message above it.
  const messages = useMemo(
    () => (data?.messages ?? []).slice().reverse(),
    [data?.messages]
  );
  const typing = data?.typing ?? [];
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const composerRef = useRef(null);
  const lastSeenIdRef = useRef(0);
  const lastTypingPostRef = useRef(0);

  // Auto-grow the family composer alongside the journal one. Same rules:
  // start at one row, expand up to 160px (about six lines), then scroll.
  useEffect(() => {
    if (!composerRef.current) return;
    composerRef.current.style.height = "auto";
    const next = Math.min(composerRef.current.scrollHeight, 160);
    composerRef.current.style.height = `${next}px`;
  }, [content]);

  // Auto-scroll to bottom on new messages, but only when the user is
  // already near the bottom (so reading old context isn't disrupted).
  useEffect(() => {
    if (!scrollRef.current || messages.length === 0) return;
    const el = scrollRef.current;
    const latestId = messages[messages.length - 1]?.id ?? 0;
    if (latestId === lastSeenIdRef.current) return;
    const wasAtBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    if (wasAtBottom || lastSeenIdRef.current === 0) {
      el.scrollTop = el.scrollHeight;
    }
    lastSeenIdRef.current = latestId;
  }, [messages]);

  // Leading-edge throttled typing-indicator POST. Fires IMMEDIATELY on
  // the first keystroke (so the indicator appears on siblings' screens
  // within ~1.5s) then again every TYPING_PING_INTERVAL_MS while the
  // user keeps typing. The earlier trailing-edge debounce was backwards:
  // it only fired after the user paused for 800ms, by which point they'd
  // stopped typing and the indicator was pointless.
  //
  // The 5s server-side `typing_until` window covers any gaps - if the
  // user pauses for 2s between sentences, the indicator stays alive
  // through the pause and the next keystroke renews it.
  const handleInputChange = (e) => {
    setContent(e.target.value);
    if (!e.target.value.trim()) return;
    const now = Date.now();
    if (now - lastTypingPostRef.current < TYPING_PING_INTERVAL_MS) return;
    lastTypingPostRef.current = now;
    GlobalApi.SetTypingIndicator().catch(() => {
      // Best-effort - if the ping fails, the indicator just won't show.
    });
  };

  const send = async () => {
    const text = content.trim();
    if (!text || sending) return;
    setSending(true);
    // Optimistic append - real id comes back from the POST and overrides
    // the placeholder in the next SWR cycle.
    const placeholder = {
      id: `tmp-${Date.now()}`,
      userId: myId,
      content: text,
      authorName: "You",
      createdAt: new Date().toISOString(),
      date: todayDateStr(),
      pending: true,
    };
    mutate(
      (cur) => ({
        messages: [placeholder, ...(cur?.messages ?? [])],
        typing: cur?.typing ?? [],
      }),
      { revalidate: false }
    );
    setContent("");
    try {
      await GlobalApi.PostFamilyChat({ content: text });
      await mutate();
    } catch (err) {
      toast.error(errMsg(err, "Failed to send"));
      await mutate(); // re-pull to drop the placeholder
    } finally {
      setSending(false);
    }
  };

  const remove = async (id) => {
    // Optimistic remove - filter the message out of the cache straight
    // away so the deletion feels instant. Next poll re-syncs from the
    // server; if delete failed for some reason the message reappears.
    mutate(
      (cur) => ({
        messages: (cur?.messages ?? []).filter((m) => m.id !== id),
        typing: cur?.typing ?? [],
      }),
      { revalidate: false }
    );
    try {
      await GlobalApi.DeleteFamilyChat(id);
      await mutate();
    } catch (err) {
      toast.error(errMsg(err, "Failed to remove"));
      await mutate();
    }
  };

  return (
    <div className="flex h-[calc(100dvh-260px)] min-h-[420px] flex-col gap-3 rounded-2xl bg-card/70 shadow-paper-1 paper-texture sm:h-[calc(100dvh-240px)]">
      <header className="border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UsersIcon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">Family room</p>
            <p className="text-[11px] text-muted-foreground">
              Everyone in the family can read + post here.
            </p>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-2">
        {isLoading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-12 w-2/3 rounded-2xl" />
            <Skeleton className="h-12 w-1/2 rounded-2xl" />
            <Skeleton className="h-12 w-3/4 rounded-2xl" />
          </div>
        ) : error ? (
          <p className="py-4 text-center text-xs text-destructive">
            Couldn't load family chat.
          </p>
        ) : messages.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="nothing said yet"
            body="Say hi to the family. Etch chat lives here."
          />
        ) : (
          <ul className="space-y-2 pb-2">
            {messages.map((m) => (
              <FamilyMessage
                key={m.id}
                msg={m}
                isMine={m.userId === myId}
                onRemove={() => remove(m.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <TypingIndicator typers={typing} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2 border-t border-border/60 bg-card/40 px-3 py-2.5"
      >
        <textarea
          ref={composerRef}
          value={content}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Message the family…"
          rows={1}
          aria-label="Message the family"
          className="max-h-[160px] min-h-[40px] flex-1 resize-none rounded-lg border border-border/70 bg-background px-3 py-2 text-sm leading-snug outline-none transition-colors focus:border-primary"
        />
        <Button type="submit" disabled={!content.trim() || sending} size="sm" className="h-10">
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Send
        </Button>
      </form>
    </div>
  );
}

// Sits between the message list and the composer. Hidden when no one
// else is typing; otherwise renders "X is typing…" / "X and Y are
// typing…" / "3 are typing…" with a small animated three-dot.
function TypingIndicator({ typers }) {
  if (!typers || typers.length === 0) return null;
  let label;
  if (typers.length === 1) {
    label = `${typers[0].displayName || "Someone"} is typing`;
  } else if (typers.length === 2) {
    label = `${typers[0].displayName || "Someone"} and ${
      typers[1].displayName || "someone"
    } are typing`;
  } else {
    label = `${typers.length} family members are typing`;
  }
  return (
    <div className="flex items-center gap-2 border-t px-3 py-1.5 text-[11px] text-muted-foreground">
      <span className="inline-flex gap-0.5" aria-hidden="true">
        <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/60" style={{ animationDelay: "0ms" }} />
        <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/60" style={{ animationDelay: "150ms" }} />
        <span className="h-1 w-1 animate-pulse rounded-full bg-muted-foreground/60" style={{ animationDelay: "300ms" }} />
      </span>
      <span>{label}…</span>
    </div>
  );
}

function FamilyMessage({ msg, isMine, onRemove }) {
  const when = formatRelative(msg.createdAt) ?? "";
  return (
    <li className={cn("group flex gap-2", isMine && "flex-row-reverse")}>
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          isMine ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        )}
        aria-hidden="true"
      >
        {authorInitials(msg.authorName)}
      </div>
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-0.5",
          isMine && "items-end"
        )}
      >
        <div
          className={cn(
            "flex items-baseline gap-2 text-[10px]",
            isMine && "flex-row-reverse"
          )}
        >
          <span className="font-semibold text-foreground">
            {isMine ? "You" : msg.authorName || "Someone"}
          </span>
          <span className="text-muted-foreground">{when}</span>
        </div>
        <div
          className={cn(
            "relative rounded-2xl px-3 py-2 text-sm",
            isMine
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground",
            msg.pending && "opacity-70"
          )}
        >
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
          {isMine && !msg.pending ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  aria-label="Delete message"
                  className="absolute -left-7 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 sm:opacity-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this message?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The family won't see it any more. This can't be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={onRemove}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      </div>
    </li>
  );
}

// =====================================================================
// Journal (per-user, kind='journal') - existing behaviour preserved
// =====================================================================

function JournalView() {
  const [messages, setMessages] = useState(null);
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const [searchActive, setSearchActive] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const taRef = useRef(null);

  const load = (q = "") => {
    GlobalApi.GetChat(q ? { q } : {})
      .then((r) => setMessages(r.data ?? []))
      .catch((err) => {
        setMessages([]);
        toast.error(errMsg(err, "Couldn't load entries"));
      });
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    const next = Math.min(taRef.current.scrollHeight, 280);
    taRef.current.style.height = `${next}px`;
  }, [content]);

  const submit = async () => {
    if (!content.trim() || saving) return;
    setSaving(true);
    try {
      await GlobalApi.PostChat({ date: todayDateStr(), content, source: "user" });
      setContent("");
      load(searchActive);
      taRef.current?.focus();
      toast.success("Saved");
    } catch (err) {
      toast.error(errMsg(err, "Failed to save"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      await GlobalApi.DeleteChat(id);
      load(searchActive);
    } catch (err) {
      toast.error(errMsg(err, "Failed to remove"));
    }
  };

  const startEdit = (m) => {
    setEditingId(m.id);
    setEditDraft(m.content);
  };
  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };
  const saveEdit = async () => {
    if (!editingId) return;
    const next = editDraft.trim();
    if (!next) {
      toast.error("Entries can't be empty");
      return;
    }
    try {
      await GlobalApi.UpdateChat({ id: editingId, content: next });
      setEditingId(null);
      setEditDraft("");
      load(searchActive);
      toast.success("Updated");
    } catch (err) {
      toast.error(errMsg(err, "Failed"));
    }
  };

  const doSearch = (e) => {
    e.preventDefault();
    setSearchActive(search.trim());
    load(search.trim());
  };

  const clearSearch = () => {
    setSearch("");
    setSearchActive("");
    load();
  };

  const grouped = useMemo(() => {
    if (!messages) return null;
    const map = new Map();
    messages.forEach((m) => {
      const arr = map.get(m.date) ?? [];
      arr.push(m);
      map.set(m.date, arr);
    });
    return Array.from(map.entries());
  }, [messages]);

  const totalCount = messages?.length ?? 0;
  const hasEntries = totalCount > 0;

  return (
    <div className="space-y-5">
      <header>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Journal
        </p>
        <h2 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          What's on your mind?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Private to you. Write freely.
        </p>
      </header>

      <div className="space-y-2">
        <div className="rounded-2xl border bg-card p-3 transition-colors focus-within:border-primary/50">
          <textarea
            ref={taRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="How are you doing today? Anything on your mind."
            className="block w-full resize-none bg-transparent px-1 py-1 text-[15px] leading-7 outline-none placeholder:text-muted-foreground"
            rows={4}
          />
          <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
            <p className="text-[11px] text-muted-foreground">Cmd/Ctrl + Enter to etch</p>
            <Button onClick={submit} disabled={!content.trim() || saving} size="sm" className="shrink-0">
              <Send className="mr-1.5 h-3.5 w-3.5" />
              {saving ? "Etching…" : "Etch it"}
            </Button>
          </div>
        </div>
      </div>

      {hasEntries ? (
        <form onSubmit={doSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search past entries" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button type="submit" variant="outline" size="sm">Search</Button>
          {searchActive ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearSearch}>
              <X className="mr-1 h-3.5 w-3.5" /> Clear
            </Button>
          ) : null}
        </form>
      ) : null}

      {grouped === null ? (
        <div className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
        </div>
      ) : grouped.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed py-10 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <MessageCircle className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">
            {searchActive ? "Nothing matches that." : "Your entries land here."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map(([date, msgs]) => (
            <section key={date}>
              <header className="mb-3 flex items-baseline gap-3">
                <h3 className="text-base font-semibold tracking-tight sm:text-lg">{prettyDate(date)}</h3>
                <div className="h-px flex-1 bg-border/60" />
                <span className="text-[11px] text-muted-foreground">
                  {msgs.length} {msgs.length === 1 ? "entry" : "entries"}
                </span>
              </header>

              <ul className="space-y-3">
                {msgs.map((m) => {
                  const isEditing = editingId === m.id;
                  return (
                    <li
                      key={m.id}
                      className={cn(
                        "group rounded-2xl border p-4 transition-colors animate-fade-up sm:p-5",
                        isEditing ? "border-primary/40 bg-card" : "border-border/70 bg-card"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        {isEditing ? (
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            rows={Math.max(2, editDraft.split("\n").length)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault();
                                saveEdit();
                              }
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-[15px] leading-7 outline-none focus:border-primary"
                            autoFocus
                          />
                        ) : (
                          <p className="whitespace-pre-wrap text-[15px] leading-7 text-foreground/90">
                            {m.content}
                          </p>
                        )}
                        {isEditing ? (
                          <div className="flex shrink-0 items-center gap-1">
                            <button onClick={saveEdit} className="rounded-md p-1.5 text-success hover:bg-success/10" aria-label="Save edit" title="Save (Cmd/Ctrl+Enter)">
                              <Check className="h-4 w-4" />
                            </button>
                            <button onClick={cancelEdit} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Cancel edit" title="Cancel (Esc)">
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                            <button onClick={() => startEdit(m)} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" aria-label="Edit entry" title="Edit">
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button onClick={() => remove(m.id)} className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" aria-label="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="tabular-nums">
                          {new Date(m.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {m.source === "check_in" ? (
                          <span className="rounded-full bg-primary/10 px-1.5 py-0 text-[10px] font-medium text-primary">
                            check-in
                          </span>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
