"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Flame,
  Dumbbell,
  NotebookPen,
  Users,
  User,
  Bell,
  MessageCircle,
  Settings,
  HelpCircle,
  Star,
  Check,
  ShieldCheck,
  Activity,
} from "lucide-react";

// Quick-tour dialog launched from the `?` icon in the top bar. Kept in
// sync with the current app surfaces - any time a tab/feature changes,
// update the relevant section here so a newcomer's first encounter with
// the help screen matches what they're seeing.

const NAVIGATION = [
  {
    icon: Flame,
    title: "Today",
    body: "Streak + this-week dots at the top. Quick-log tiles for sleep, water, cardio and weight. Daily 4 micro-workouts. Meals card. Today's check-in and your scheduled workout if you have an active plan. Heat-map calendar at the bottom.",
  },
  {
    icon: Dumbbell,
    title: "Train",
    body: "Build weekly training plans, log per-set reps and weights, browse the exercise library. Mark one plan active and Today reads from it.",
  },
  {
    icon: NotebookPen,
    title: "Log",
    body: "Per-section history: sleep, water, mood, body, cardio, meals. Each opens its own page where you can edit or delete past entries.",
  },
  {
    icon: Users,
    title: "Family",
    body: "Roster of everyone in the family with a streak, week-workout count and today's Daily 4 reps. Tap a tile to view that person's week. Leaderboards above, recent activity feed below.",
  },
  {
    icon: User,
    title: "Me",
    body: "This week's discipline score, structured goals with progress bars, Chat (family room + private journal), reminders, settings and data export.",
  },
  {
    icon: Bell,
    title: "Bell (top bar)",
    body: "Unread profile views + new family-room messages. Opening it marks views as read and the badge clears.",
  },
];

const STEPS = [
  {
    icon: User,
    title: "Sign in",
    body: "Kinde handles auth. First sign-in runs a 3-step wizard for your name, DOB + height, and visibility toggles. Per-step save - you can finish on another device.",
  },
  {
    icon: ShieldCheck,
    title: "Set your privacy",
    body: "8 visibility toggles in Settings → Privacy control what siblings see when they view your profile. Streak, Daily 4 totals and week-workout counts are always visible by design.",
  },
  {
    icon: Dumbbell,
    title: "Build a plan (optional)",
    body: "If you train, head to Train → Plans, lay out the week, and mark one Active. Today will surface that day's session automatically.",
  },
  {
    icon: Flame,
    title: "Log daily",
    body: "Sleep, water, meals, mood, Daily 4 reps - whatever fits. Most tiles are one tap. Anything logged grows your streak.",
  },
  {
    icon: Users,
    title: "Peek at the family",
    body: "Family tab shows everyone's progress and a leaderboard. Tap any tile to view their week (subject to their visibility). They get a quiet ping in their bell.",
  },
  {
    icon: MessageCircle,
    title: "Chat",
    body: "Two tabs: Family (shared room - everyone reads + writes) and Journal (private to you). New family messages also light up the bell.",
  },
];

const TIPS = [
  {
    title: "Streak counts any logged activity",
    body: "Not just workouts. Sleep, water, mood, meals, Daily 4 reps - any one of them keeps the streak alive. A 30-second Daily 4 tap on a rest day is enough.",
  },
  {
    title: "Three header stats are always visible",
    body: "Streak, this-week workout count, and today's Daily 4 reps. These bypass the visibility toggles - everyone in the family sees them. Body, sleep, mood etc respect your flags.",
  },
  {
    title: "Intentional rest doesn't break discipline",
    body: "On the daily check-in, toggle Intentional rest to mark a chosen rest day. It still counts as showing up; your discipline score doesn't dent.",
  },
  {
    title: "Viewing pings happen once per day",
    body: "Tapping the same family member's tile twenty times in one day produces one notification on their end. Unique per (viewer, viewee, date).",
  },
  {
    title: "Journal stays private. Always.",
    body: "Not togglable. Family room is the shared surface; the Journal tab is yours.",
  },
  {
    title: "Mobile vs desktop",
    body: "Mobile: 5-slot bottom nav (Today / Train / Log / Family / Me). Desktop adds a Trends tab in the sidebar. Chat lives in the Me hub on mobile, sidebar on desktop.",
  },
];

export default function HelpGuide({ open, onClose }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <HelpCircle className="h-6 w-6" />
            Quick guide
          </DialogTitle>
          <DialogDescription>
            A 60-second tour of where everything lives. Reopen any time from the ? icon in the top bar.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="navigation" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="navigation">Navigation</TabsTrigger>
            <TabsTrigger value="how">How it works</TabsTrigger>
            <TabsTrigger value="tips">Tips</TabsTrigger>
          </TabsList>

          <TabsContent value="navigation" className="mt-4 space-y-4">
            {NAVIGATION.map((item) => (
              <NavItem key={item.title} {...item} />
            ))}
          </TabsContent>

          <TabsContent value="how" className="mt-4 space-y-5">
            {STEPS.map((step, idx) => (
              <Step key={step.title} n={idx + 1} {...step} />
            ))}
          </TabsContent>

          <TabsContent value="tips" className="mt-4 space-y-3">
            {TIPS.map((tip) => (
              <Tip key={tip.title} {...tip} />
            ))}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Reopen this guide any time from the ? icon in the top bar.
          </p>
          <Button onClick={onClose}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NavItem({ icon: Icon, title, body }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function Step({ n, icon: Icon, title, body }) {
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {n}
        </div>
        <div className="mt-1 h-full w-px bg-border" />
      </div>
      <div className="pb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-primary" /> {title}
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function Tip({ title, body }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
