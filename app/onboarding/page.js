"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Mail,
} from "lucide-react";
import HealthMark from "@/components/HealthMark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import GlobalApi from "@/app/_services/GlobalApi";
import { DEFAULT_VISIBILITY, VISIBILITY_SECTIONS } from "@/lib/visibility";
import { computeAge, maxAllowedDob, minAllowedDob } from "@/lib/age";

// Family-rollout onboarding wizard. Up to four steps, mobile-first, standalone
// (no dashboard chrome - rendered at /onboarding not /dashboard/onboarding
// so the bottom nav doesn't cover the Continue button on iPhone).
//
// Step 0 (family) is shown ONLY when the user has no MEMBERSHIPS row yet -
// they're a brand-new sign-up choosing to either name a new family or to
// paste an invite link from someone else's family. Users who arrived here
// via /join/<token> (invite already accepted) skip this step entirely.
//
// Step 1: name (required - this is what the rest of the family will see)
// Step 2: date of birth + height (both optional)
// Step 3: visibility toggles (8 sections, all default ON)
//
// PER-STEP SAVE: each Continue PUTs the relevant fields to /api/users/me
// before advancing. That solves the cross-device sync issue where editing
// on mobile didn't show up on the PC refresh - now the server is the
// source of truth and the other device reads it back on next load.
//
// INITIAL STEP DERIVATION: on mount we fetch /api/users/me (which now
// returns `hasFamily`) and jump to whichever step still has missing data.

const STEP_KEYS = ["family", "name", "details", "privacy"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // hasFamily decides whether the family step appears at all. Set once on
  // load and updated when the user creates a family.
  const [hasFamily, setHasFamily] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [visibility, setVisibility] = useState(DEFAULT_VISIBILITY);

  // The wizard skips the family step when the user already belongs to one
  // (e.g. they arrived via /join/<token>). steps[] is the live list of
  // step keys for the current user.
  const steps = useMemo(
    () => STEP_KEYS.filter((k) => k !== "family" || !hasFamily),
    [hasFamily]
  );
  const currentKey = steps[step];

  useEffect(() => {
    GlobalApi.GetMe()
      .then((r) => {
        const me = r.data;
        const dn = me?.displayName ?? "";
        const dob = me?.dateOfBirth ?? "";
        const h = me?.heightCm != null ? String(me.heightCm) : "";
        const vis = me?.visibility
          ? { ...DEFAULT_VISIBILITY, ...me.visibility }
          : DEFAULT_VISIBILITY;
        const hf = !!me?.hasFamily;
        setDisplayName(dn);
        setDateOfBirth(dob);
        setHeightCm(h);
        setVisibility(vis);
        setHasFamily(hf);
        // Resume at the latest incomplete step. Order: family (if needed)
        // → name → details → privacy.
        const liveSteps = STEP_KEYS.filter(
          (k) => k !== "family" || !hf
        );
        let i = 0;
        if (!hf) i = liveSteps.indexOf("family"); // 0
        else if (!dn) i = liveSteps.indexOf("name");
        else if (!dob && !h) i = liveSteps.indexOf("details");
        else i = liveSteps.indexOf("privacy");
        setStep(Math.max(0, i));
      })
      .catch(() => {
        /* keep defaults; page still renders */
      })
      .finally(() => setLoading(false));
  }, []);

  const canContinue = () => {
    if (currentKey === "family") return familyName.trim().length >= 2;
    if (currentKey === "name") return displayName.trim().length > 0;
    return true;
  };

  const goNext = async () => {
    if (!canContinue() || saving) return;
    setSaving(true);
    try {
      if (currentKey === "family") {
        await GlobalApi.CreateFamily({ name: familyName.trim() });
        setHasFamily(true);
        // After creating a family, recompute the step list (the family step
        // drops out) and advance to "name".
        setStep(0); // family was index 0; after drop, name is now index 0
      } else if (currentKey === "name") {
        await GlobalApi.UpdateMe({ displayName: displayName.trim() });
        setStep((s) => s + 1);
      } else if (currentKey === "details") {
        await GlobalApi.UpdateMe({
          dateOfBirth: dateOfBirth || null,
          heightCm: heightCm === "" ? null : Number(heightCm),
        });
        setStep((s) => s + 1);
      } else if (currentKey === "privacy") {
        await GlobalApi.UpdateMe({ visibility });
        toast.success("All set");
        router.push("/dashboard");
        return; // don't reset `saving` - we're leaving
      }
    } catch (e) {
      const msg = e?.response?.data?.error ?? e?.message ?? "Couldn't save";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const goBack = () => {
    if (saving) return;
    if (step > 0) setStep((s) => s - 1);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col bg-background">
      <header className="flex items-center justify-between border-b px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <HealthMark size={28} />
          <p className="font-serif text-sm font-semibold">Health</p>
        </div>
        <div className="flex items-center gap-1.5">
          {steps.map((_s, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-6 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )}
              aria-label={`Step ${i + 1} of ${steps.length}`}
            />
          ))}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pt-6 pb-32 sm:max-w-lg sm:px-6 sm:pt-10">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <>
            {currentKey === "family" ? (
              <StepFamily
                value={familyName}
                onChange={setFamilyName}
                stepLabel={`Step ${step + 1} of ${steps.length}`}
              />
            ) : null}
            {currentKey === "name" ? (
              <StepName
                value={displayName}
                onChange={setDisplayName}
                stepLabel={`Step ${step + 1} of ${steps.length}`}
              />
            ) : null}
            {currentKey === "details" ? (
              <StepDetails
                dateOfBirth={dateOfBirth}
                onDateOfBirth={setDateOfBirth}
                heightCm={heightCm}
                onHeightCm={setHeightCm}
                stepLabel={`Step ${step + 1} of ${steps.length}`}
              />
            ) : null}
            {currentKey === "privacy" ? (
              <StepPrivacy
                visibility={visibility}
                onChange={setVisibility}
                stepLabel={`Step ${step + 1} of ${steps.length}`}
              />
            ) : null}
          </>
        )}
      </main>

      <footer className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t bg-card backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-3 sm:max-w-lg sm:px-6">
          {step > 0 ? (
            <Button
              variant="outline"
              onClick={goBack}
              disabled={saving}
              className="h-12 px-4"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : null}
          <Button
            onClick={goNext}
            disabled={!canContinue() || saving}
            className="h-12 flex-1 text-base font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Saving…
              </>
            ) : currentKey === "privacy" ? (
              <>
                <Check className="mr-1.5 h-4 w-4" /> Finish setup
              </>
            ) : (
              <>
                Continue <ArrowRight className="ml-1.5 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}

function StepFamily({ value, onChange, stepLabel }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {stepLabel}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
          Start your family.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Name the group you'll be tracking with. Up to six other people can
          join later via invite link. You can rename it any time.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ob-family-name">Family name</Label>
        <Input
          id="ob-family-name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. The Smiths, Ijisons, Team Awesome"
          maxLength={60}
          autoFocus
          className="h-14 text-lg"
        />
      </div>
      <div className="rounded-xl border border-dashed bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Already got an invite link?</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Open the link from your text / email instead. It'll drop you
              straight into the right family with no setup.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepName({ value, onChange, stepLabel }) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {stepLabel}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
          What should we call you?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This is what the rest of the family will see when they look at your
          progress. First name is plenty.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ob-name">Display name</Label>
        <Input
          id="ob-name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. Mum, Dad, Michael"
          maxLength={60}
          autoFocus
          className="h-14 text-lg"
        />
      </div>
    </div>
  );
}

function StepDetails({ dateOfBirth, onDateOfBirth, heightCm, onHeightCm, stepLabel }) {
  // Date picker bounds + live age preview. iOS Safari opens a native wheel
  // picker for type="date", which is friendlier than typing on a thumb.
  const dobMin = useMemo(() => minAllowedDob(), []);
  const dobMax = useMemo(() => maxAllowedDob(), []);
  const age = useMemo(() => computeAge(dateOfBirth), [dateOfBirth]);

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {stepLabel}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
          A few quick details
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Both optional, but they make weigh-in nudges and BMI trends more
          useful. You can change them any time in Settings.
        </p>
      </div>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="ob-dob">Date of birth</Label>
          <Input
            id="ob-dob"
            type="date"
            value={dateOfBirth}
            min={dobMin}
            max={dobMax}
            onChange={(e) => onDateOfBirth(e.target.value)}
            className="h-12 text-base"
          />
          {age != null ? (
            <p className="text-xs text-muted-foreground">
              That's <span className="font-semibold text-foreground tabular-nums">{age}</span> years old.
              {" "}Stored as a date so it stays right automatically.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              Pick a day to see your age - it'll update on its own each year.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ob-height">Height (cm)</Label>
          <Input
            id="ob-height"
            type="number"
            inputMode="numeric"
            min={50}
            max={250}
            value={heightCm}
            onChange={(e) => onHeightCm(e.target.value)}
            placeholder="e.g. 175"
            className="h-12 text-base"
          />
          <p className="text-[11px] text-muted-foreground">
            5'7&quot; ≈ 170 cm · 5'10&quot; ≈ 178 cm · 6'0&quot; ≈ 183 cm
          </p>
        </div>
      </div>
    </div>
  );
}

function StepPrivacy({ visibility, onChange, stepLabel }) {
  const toggle = (key) =>
    onChange({ ...visibility, [key]: !visibility[key] });
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {stepLabel}
        </p>
        <h1 className="mt-1 font-serif text-3xl font-bold tracking-tight sm:text-4xl">
          What can family see?
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Each toggle controls one section. Default is everything ON - share
          everything, motivate each other. Your journal is always private
          either way.
        </p>
      </div>
      <ul className="space-y-2">
        {VISIBILITY_SECTIONS.map(({ key, label, desc }) => {
          const on = !!visibility[key];
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => toggle(key)}
                aria-pressed={on}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                  on
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-card hover:border-primary/30"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    on ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}
                  aria-hidden
                >
                  {on ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{label}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0 text-[10px] font-semibold uppercase tracking-wider",
                        on
                          ? "border-primary/60 text-primary"
                          : "border-border text-muted-foreground"
                      )}
                    >
                      {on ? "Visible" : "Private"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="rounded-lg border border-dashed border-border/60 p-3 text-[11px] text-muted-foreground">
        These can be changed any time in Settings → Privacy. Streak, completed
        workouts, and Daily 4 totals are always visible - they're the
        motivation surface for the whole family.
      </p>
    </div>
  );
}
