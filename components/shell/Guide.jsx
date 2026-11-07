"use client";
// The one-time guide (health v2). Four short steps, shown once ever for each account (users.guide_seen_at),
// then the same steps live in Settings > Help, with "Show the guide again". No tours, arrows or spotlights.
import { useEffect, useState } from "react";
import GlobalApi from "@/app/_services/GlobalApi";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const OPEN_GUIDE = "health:open-guide";
export function openGuide() { window.dispatchEvent(new Event(OPEN_GUIDE)); }

export const GUIDE_STEPS = [
  { title: "Write down how you feel", text: "Today starts with \"Anything going on today?\". A few words is enough: what, where, how bad and what helps." },
  { title: "Get it ready for your GP", text: "For my GP turns your notes into one page, with your questions and medicines. Show it, print it or save it as a PDF." },
  { title: "Log the everyday, if you like", text: "Sleep, water, meals, mood and workouts are on Today and in Log. Train and Trends are under More." },
  { title: "Only you can see it", text: "Nobody else can see what you write down, and your words are encrypted before they are saved. Help and your data are always in Settings." },
];

export default function Guide() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const show = () => { setStep(0); setOpen(true); };
    window.addEventListener(OPEN_GUIDE, show);
    let seen = false;
    try { seen = localStorage.getItem("health-guide-seen") === "1"; } catch { /* private mode */ }
    if (!seen) {
      GlobalApi.GetMe().then((r) => {
        if (r.data?.guideSeenAt) { try { localStorage.setItem("health-guide-seen", "1"); } catch {} }
        else show();
      }).catch(() => {});
    }
    return () => window.removeEventListener(OPEN_GUIDE, show);
  }, []);

  function close() {
    setOpen(false);
    try { localStorage.setItem("health-guide-seen", "1"); } catch { /* private mode */ }
    GlobalApi.UpdateMe({ guideSeen: true }).catch(() => {});
  }

  const s = GUIDE_STEPS[step];
  const last = step === GUIDE_STEPS.length - 1;
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent className="max-w-md">
        <p className="text-sm text-muted-foreground">Step {step + 1} of {GUIDE_STEPS.length}</p>
        <DialogTitle className="font-display text-2xl font-medium tracking-tight">{s.title}</DialogTitle>
        <DialogDescription className="text-base leading-relaxed text-foreground">{s.text}</DialogDescription>
        <div className="mt-4 flex items-center justify-between gap-3">
          {step > 0
            ? <button type="button" onClick={() => setStep(step - 1)} className="h-11 bg-secondary px-4 text-sm font-medium">Back</button>
            : <button type="button" onClick={close} className="h-11 px-1 text-sm underline underline-offset-4">Skip the guide</button>}
          <button type="button" onClick={() => (last ? close() : setStep(step + 1))} className="h-11 bg-primary px-5 text-sm font-medium text-primary-foreground">
            {last ? "Start using health" : "Next"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
