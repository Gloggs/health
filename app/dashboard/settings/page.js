"use client";

import React, { Suspense, useState, useEffect, useMemo } from 'react';
import { useKindeBrowserClient, LogoutLink } from '@kinde-oss/kinde-auth-nextjs';
import { useTheme } from 'next-themes';
import { useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { toast } from 'sonner';
import { User, Moon, Sun, LogOut, ExternalLink, Monitor, Target, Save, ShieldCheck, Eye, EyeOff, Sparkles } from 'lucide-react';
import GlobalApi from '@/app/_services/GlobalApi';
import PageHero from '../_components/PageHero';
import {
  PRESETS,
  DEFAULT_PERSONALITY,
  normalisePersonality,
  setPersonalityClient,
} from '@/lib/personality';
import {
  TYPE_PRESETS,
  DEFAULT_TYPOGRAPHY,
  applyTypography,
  getStoredTypography,
} from '@/lib/typography';
import { etched } from '@/lib/etchFeedback';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { computeAge, maxAllowedDob, minAllowedDob } from '@/lib/age';
import { DEFAULT_VISIBILITY, VISIBILITY_SECTIONS } from '@/lib/visibility';

const UNIT_KEY = 'settings.weightUnit';

// Tab IDs kept short. The `coach` slug stays for backwards compat with old
// `?tab=coach` bookmarks (notably the Me-page nudge card that used to link
// here pre-rename); we just label it "Goals" in the UI now.
const VALID_TABS = ['profile', 'coach', 'personality', 'privacy', 'appearance', 'account'];

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const { user } = useKindeBrowserClient();
  const { theme, setTheme } = useTheme();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab = VALID_TABS.includes(tabParam) ? tabParam : 'profile';
  const [unit, setUnit] = useState('kg');
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [typeId, setTypeId] = useState(DEFAULT_TYPOGRAPHY);
  const [ctx, setCtx] = useState(null);
  // Snapshot of what the server has - used to detect unsaved changes and to
  // prove the save round-tripped (we replace it with the server response).
  const [loadedCtx, setLoadedCtx] = useState(null);
  const [savingCtx, setSavingCtx] = useState(false);

  // Family-profile + visibility live on the USERS row (lib/auth's ensureUserRow
  // creates it lazily). Kept as a separate state from `ctx` because they save
  // through /api/users/me with different validation, and the Profile + Privacy
  // tabs each have their own dirty check + Save button.
  const [me, setMe] = useState(null);
  const [loadedMe, setLoadedMe] = useState(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const u = localStorage.getItem(UNIT_KEY);
    if (u) setUnit(u);
    // Read the saved typography preset so the picker reflects what's
    // currently applied. ThemeProvider has already applied it on mount;
    // we just mirror state so the UI's selection matches.
    setTypeId(getStoredTypography());
    GlobalApi.GetUserContext()
      .then((r) => {
        setCtx(r.data);
        setLoadedCtx(r.data);
        // Hydrate localStorage with the server-stored Personality preset
        // so etchFeedback / EtchAnimation read the right value on every
        // tap. setPersonalityClient is idempotent — safe to call on
        // every settings mount.
        setPersonalityClient(r.data?.personality ?? DEFAULT_PERSONALITY);
      })
      .catch(() => {
        const empty = { goals: '', restrictions: '', preferences: '' };
        setCtx(empty);
        setLoadedCtx(empty);
      });
    GlobalApi.GetMe()
      .then((r) => { setMe(r.data); setLoadedMe(r.data); })
      .catch(() => {
        const empty = { displayName: '', dateOfBirth: null, heightCm: null, visibility: null };
        setMe(empty);
        setLoadedMe(empty);
      });
  }, []);

  // Field-by-field dirty check against the server snapshot. Used to gate the
  // "Unsaved changes" pill and the beforeunload guard - the user previously
  // had no signal at all that the save needed to be clicked.
  const dirty = useMemo(() => {
    if (!ctx || !loadedCtx) return false;
    const keys = ['goals', 'restrictions', 'preferences', 'chatRetentionDays', 'waterTargetMl'];
    const norm = (v) => (v == null || v === '' ? null : v);
    return keys.some((k) => norm(ctx[k]) !== norm(loadedCtx[k]));
  }, [ctx, loadedCtx]);

  // Profile tab dirty: displayName / dateOfBirth / heightCm.
  const profileDirty = useMemo(() => {
    if (!me || !loadedMe) return false;
    const norm = (v) => (v == null || v === '' ? null : String(v));
    return (
      norm(me.displayName) !== norm(loadedMe.displayName) ||
      norm(me.dateOfBirth) !== norm(loadedMe.dateOfBirth) ||
      norm(me.heightCm) !== norm(loadedMe.heightCm)
    );
  }, [me, loadedMe]);

  // Privacy tab dirty: any of the 8 visibility toggles different from saved.
  const privacyDirty = useMemo(() => {
    if (!me || !loadedMe) return false;
    const cur = me.visibility ?? DEFAULT_VISIBILITY;
    const prev = loadedMe.visibility ?? DEFAULT_VISIBILITY;
    return VISIBILITY_SECTIONS.some(({ key }) => !!cur[key] !== !!prev[key]);
  }, [me, loadedMe]);

  // Browser-level unsaved guard: prompts the OS confirm when closing the tab
  // or refreshing with dirty fields. Router navigation in Next 14 App Router
  // doesn't fire beforeunload - the in-page "Unsaved changes" pill carries
  // that signal instead. Covers all three save buckets.
  const anyDirty = dirty || profileDirty || privacyDirty;
  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [anyDirty]);

  const saveContext = async () => {
    setSavingCtx(true);
    try {
      const res = await GlobalApi.SaveUserContext(ctx);
      // Trust the server's normalised response (e.g. waterTargetMl rounded,
      // chatRetentionDays nulled when zero) so the form reflects what's
      // actually stored rather than the user's pre-normalisation draft.
      if (res?.data) {
        setCtx(res.data);
        setLoadedCtx(res.data);
      }
      toast.success('Goals saved');
    } catch (err) {
      // Surface the real reason so schema mismatches / 500s don't masquerade
      // as a generic network failure. Falls back to a generic message when
      // the server didn't send one.
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to save';
      toast.error(msg);
    } finally {
      setSavingCtx(false);
    }
  };

  // Personality preset save - distinct from saveContext because it should
  // apply immediately (no "Save" button), update localStorage so the
  // reward layer reads the new preset on the very next tap, and fire a
  // sample etch animation so the user can FEEL the new preset.
  const savePersonality = async (preset) => {
    const id = normalisePersonality(preset);
    // Optimistic local apply - swaps animation + haptic on the next tap.
    setPersonalityClient(id);
    setCtx((s) => ({ ...(s ?? {}), personality: id }));
    setLoadedCtx((s) => ({ ...(s ?? {}), personality: id }));
    // Sample the new feel right after the swap. Subtle, just so the
    // user knows "Calm" and "Warm" actually differ.
    setTimeout(() => {
      etched({ message: `${PRESETS[id].emoji} ${PRESETS[id].label} on` });
    }, 50);
    try {
      await GlobalApi.SaveUserContext({ personality: id });
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed';
      toast.error(`Couldn't save preset: ${msg}`);
    }
  };

  // Saves only profile fields so toggling visibility doesn't accidentally
  // re-validate displayName etc. Each tab owns its own save.
  const saveProfile = async () => {
    if (!me) return;
    setSavingProfile(true);
    try {
      const res = await GlobalApi.UpdateMe({
        displayName: me.displayName ?? '',
        dateOfBirth: me.dateOfBirth || null,
        heightCm: me.heightCm == null || me.heightCm === '' ? null : Number(me.heightCm),
      });
      if (res?.data) {
        setMe(res.data);
        setLoadedMe(res.data);
      }
      toast.success('Profile saved');
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to save profile';
      toast.error(msg);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePrivacy = async () => {
    if (!me) return;
    setSavingPrivacy(true);
    try {
      const res = await GlobalApi.UpdateMe({
        visibility: me.visibility ?? DEFAULT_VISIBILITY,
      });
      if (res?.data) {
        setMe(res.data);
        setLoadedMe(res.data);
      }
      toast.success('Privacy updated');
    } catch (err) {
      const msg = err?.response?.data?.error ?? err?.message ?? 'Failed to save';
      toast.error(msg);
    } finally {
      setSavingPrivacy(false);
    }
  };

  const toggleVisibility = (key) => {
    setMe((s) => {
      const cur = s?.visibility ?? DEFAULT_VISIBILITY;
      return { ...s, visibility: { ...DEFAULT_VISIBILITY, ...cur, [key]: !cur[key] } };
    });
  };

  const handleUnit = (value) => {
    setUnit(value);
    localStorage.setItem(UNIT_KEY, value);
    toast.success(`Switched to ${value}`);
  };

  const handleTheme = (next) => {
    setTheme(next);
    toast.success(`Switched to ${next} mode`);
  };

  const handleType = (next) => {
    const applied = applyTypography(next);
    setTypeId(applied);
    toast.success(`Type set to ${TYPE_PRESETS[applied].label}`);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-5">
      <PageHero
        eyebrow="settings"
        title="Tune Etch"
        subtitle="Profile, goals, personality, privacy, theme, and account."
      />

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto sm:inline-flex">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="coach">Goals</TabsTrigger>
          <TabsTrigger value="personality">Feel</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="appearance">Display</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6 space-y-4">
          {/* Family profile - the editable bits the rest of the family sees.
              Sits above the Kinde info because this is the more useful card
              now; the Kinde row is a footer-style reference. */}
          <Card>
            <CardHeader>
              <CardTitle>Family profile</CardTitle>
              <CardDescription>
                Your display name, date of birth and height. This is what the
                rest of the family sees when they look at your profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {me === null ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-name">Display name</Label>
                    <Input
                      id="prof-name"
                      value={me.displayName ?? ''}
                      onChange={(e) => setMe((s) => ({ ...s, displayName: e.target.value }))}
                      placeholder="e.g. Michael"
                      maxLength={60}
                    />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-dob">Date of birth</Label>
                      <Input
                        id="prof-dob"
                        type="date"
                        value={me.dateOfBirth ?? ''}
                        min={minAllowedDob()}
                        max={maxAllowedDob()}
                        onChange={(e) => setMe((s) => ({ ...s, dateOfBirth: e.target.value }))}
                      />
                      {me.dateOfBirth ? (
                        <p className="text-[11px] text-muted-foreground">
                          That's{' '}
                          <span className="font-semibold tabular-nums text-foreground">
                            {computeAge(me.dateOfBirth) ?? '-'}
                          </span>{' '}
                          years old.
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Optional. Stored as a date so the age stays right automatically.
                        </p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-height">Height (cm)</Label>
                      <Input
                        id="prof-height"
                        type="number"
                        inputMode="numeric"
                        min={50}
                        max={250}
                        value={me.heightCm ?? ''}
                        onChange={(e) =>
                          setMe((s) => ({ ...s, heightCm: e.target.value === '' ? null : e.target.value }))
                        }
                        placeholder="e.g. 175"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    {profileDirty ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                        Unsaved changes
                      </span>
                    ) : null}
                    <Button onClick={saveProfile} disabled={savingProfile || !profileDirty}>
                      <Save className="mr-1.5 h-4 w-4" />
                      {savingProfile ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Kinde info as a compact reference card - email is the only
              field that matters here, the rest of identity lives on the
              users row above. */}
          <Card>
            <CardHeader>
              <CardTitle>Sign-in account</CardTitle>
              <CardDescription>
                Email comes from your sign-in provider and can't be edited here.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {user?.picture ? (
                  <Image src={user.picture} width={56} height={56} alt="Profile" className="rounded-full border" />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <User className="h-6 w-6 text-primary/60" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{user?.email ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">
                    Signed in via Kinde — your email lives there, not here.
                    Profile name, age and height live in the Profile tab above.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="coach" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5 text-primary" /> Goals</CardTitle>
              <CardDescription>
                What you're working on, what to avoid, what you prefer. Kept on your row only —
                nothing in here is shared with the family. Short answers work fine.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ctx === null ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs">
                    <p className="font-medium text-foreground">Example</p>
                    <p className="mt-1 text-muted-foreground">
                      <span className="font-medium text-foreground/80">Goals:</span> Gain muscle without
                      hurting my back. Hit 80kg.<br />
                      <span className="font-medium text-foreground/80">Restrictions:</span> Low-back
                      issues - no heavy deadlifts or overhead pressing.<br />
                      <span className="font-medium text-foreground/80">Preferences:</span> Morning
                      workouts. No dairy. Hate cardio but tolerate walking.
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="goals">Goals</Label>
                    <textarea
                      id="goals"
                      rows={2}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="Gain muscle without hurting my back. Hit 80kg by August."
                      value={ctx.goals ?? ''}
                      onChange={(e) => setCtx((s) => ({ ...s, goals: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="restrictions">Restrictions / injuries</Label>
                    <textarea
                      id="restrictions"
                      rows={2}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="Low-back issues - no heavy deadlifts or overhead pressing. Lactose intolerant."
                      value={ctx.restrictions ?? ''}
                      onChange={(e) => setCtx((s) => ({ ...s, restrictions: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="preferences">Preferences</Label>
                    <textarea
                      id="preferences"
                      rows={2}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                      placeholder="Morning workouts. Hate cardio but will walk. Vegetarian."
                      value={ctx.preferences ?? ''}
                      onChange={(e) => setCtx((s) => ({ ...s, preferences: e.target.value }))}
                    />
                  </div>
                  <div className="rounded-md border p-3">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">Daily water target</p>
                        <p className="text-xs text-muted-foreground">
                          Drives the progress bar on the Water tile. Default 2500 ml.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="500"
                          step="50"
                          className="w-24 text-right tabular-nums"
                          value={ctx.waterTargetMl ?? ''}
                          placeholder="2500"
                          onChange={(e) => {
                            const raw = e.target.value;
                            setCtx((s) => ({
                              ...s,
                              waterTargetMl: raw === '' ? null : Number(raw),
                            }));
                          }}
                        />
                        <span className="text-xs text-muted-foreground">ml</span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">Chat retention</p>
                        <p className="text-xs text-muted-foreground">
                          Auto-delete journal entries older than the chosen window.
                          Applied on every chat read.
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {[
                        { v: 0, label: "Forever" },
                        { v: 30, label: "30 days" },
                        { v: 90, label: "90 days" },
                        { v: 180, label: "180 days" },
                        { v: 365, label: "1 year" },
                      ].map((opt) => {
                        const current = Number(ctx.chatRetentionDays ?? 0);
                        const selected = current === opt.v;
                        return (
                          <button
                            key={opt.v}
                            type="button"
                            onClick={() =>
                              setCtx((s) => ({ ...s, chatRetentionDays: opt.v === 0 ? null : opt.v }))
                            }
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                              selected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-border bg-card hover:border-primary/40'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    {dirty ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                        Unsaved changes
                      </span>
                    ) : null}
                    <Button onClick={saveContext} disabled={savingCtx || !dirty}>
                      <Save className="mr-1.5 h-4 w-4" /> {savingCtx ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personality" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> How Etch feels
              </CardTitle>
              <CardDescription>
                Same product, different volume. Pick the tempo that matches
                you — change any time. Tap to apply; you'll feel the new
                preset on the very next log.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {ctx === null ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {Object.values(PRESETS).map((p) => {
                      const current = normalisePersonality(ctx.personality);
                      const selected = current === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => savePersonality(p.id)}
                          aria-pressed={selected}
                          className={cn(
                            'flex h-full flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors',
                            selected
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                              : 'border-border bg-card hover:border-primary/40'
                          )}
                        >
                          <span className="text-2xl leading-none" aria-hidden>
                            {p.emoji}
                          </span>
                          <div>
                            <p className="font-serif text-lg font-semibold">
                              {p.label}
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                              {p.description}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'mt-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                              selected
                                ? 'border-primary text-primary'
                                : 'border-border text-muted-foreground'
                            )}
                          >
                            {selected ? 'On' : 'Pick'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="rounded-lg border border-dashed border-border/60 p-3 text-[11px] leading-relaxed text-muted-foreground">
                    <p>
                      Etch automatically falls back to Calm when your device
                      has Reduce Motion enabled — no setting needed.
                    </p>
                    <p className="mt-1">
                      Advanced controls (animation speed slider, sound choice,
                      per-category push toggles) coming next.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="privacy" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" /> Privacy
              </CardTitle>
              <CardDescription>
                Each toggle controls what the rest of the family can see when
                they view your profile. Your journal is always private either
                way. Streak, completed workouts and Daily 4 totals are always
                visible - they're the motivation surface for everyone.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {me === null ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <>
                  <ul className="space-y-2">
                    {VISIBILITY_SECTIONS.map(({ key, label, desc }) => {
                      const vis = me.visibility ?? DEFAULT_VISIBILITY;
                      const on = !!vis[key];
                      return (
                        <li key={key}>
                          <button
                            type="button"
                            onClick={() => toggleVisibility(key)}
                            aria-pressed={on}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                              on
                                ? 'border-primary/40 bg-primary/5'
                                : 'border-border bg-card hover:border-primary/30'
                            )}
                          >
                            <span
                              className={cn(
                                'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                                on
                                  ? 'bg-primary/15 text-primary'
                                  : 'bg-muted text-muted-foreground'
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
                                    'shrink-0 rounded-full border px-2 py-0 text-[10px] font-semibold uppercase tracking-wider',
                                    on
                                      ? 'border-primary/60 text-primary'
                                      : 'border-border text-muted-foreground'
                                  )}
                                >
                                  {on ? 'Visible' : 'Private'}
                                </span>
                              </div>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{desc}</p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex items-center justify-end gap-3">
                    {privacyDirty ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
                        Unsaved changes
                      </span>
                    ) : null}
                    <Button onClick={savePrivacy} disabled={savingPrivacy || !privacyDirty}>
                      <Save className="mr-1.5 h-4 w-4" />
                      {savingPrivacy ? 'Saving…' : 'Save'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="mt-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>Dark is the default. Switch any time.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: 'light', label: 'Light', Icon: Sun },
                  { value: 'dark', label: 'Dark', Icon: Moon },
                  { value: 'system', label: 'System', Icon: Monitor },
                ].map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => handleTheme(value)}
                    className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-sm transition-colors hover:bg-accent ${
                      theme === value ? 'border-primary ring-2 ring-primary/20' : ''
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Type</CardTitle>
              <CardDescription>
                Pick how Etch reads. The number register (mono) and the
                handwritten accents stay the same in every preset — those
                <em> are</em> the brand.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-3">
                {Object.values(TYPE_PRESETS).map((p) => {
                  const selected = typeId === p.id;
                  // Live samples render in the actual preset font so the
                  // user previews before committing. data-type on the
                  // sample card forces the CSS-var swap locally without
                  // affecting the rest of the page.
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleType(p.id)}
                      aria-pressed={selected}
                      data-type={p.id}
                      className={cn(
                        'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors',
                        selected
                          ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                          : 'border-border bg-card hover:border-primary/40'
                      )}
                    >
                      <span className="font-handwritten text-base leading-none text-muted-foreground">
                        {p.label.toLowerCase()}
                      </span>
                      <span className="font-serif text-lg font-bold leading-tight">
                        {p.sampleTitle}
                      </span>
                      <span className="text-xs leading-relaxed text-muted-foreground">
                        {p.sampleBody}
                      </span>
                      <span
                        className={cn(
                          'mt-auto inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                          selected
                            ? 'border-primary text-primary'
                            : 'border-border text-muted-foreground'
                        )}
                      >
                        {selected ? 'On' : 'Pick'}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Saved per-device. Different on your phone vs laptop is fine
                — pick what reads best where you're sitting.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Weight unit</CardTitle>
              <CardDescription>How weights show up across the app.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 sm:w-72">
                {['kg', 'lb'].map((u) => (
                  <button
                    key={u}
                    onClick={() => handleUnit(u)}
                    className={`rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-accent ${
                      unit === u ? 'border-primary ring-2 ring-primary/20' : ''
                    }`}
                  >
                    {u.toUpperCase()}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Sign out</CardTitle>
              <CardDescription>End your current session on this device.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={() => setShowLogoutDialog(true)}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm sign out</DialogTitle>
            <DialogDescription>You'll be returned to the sign-in page.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowLogoutDialog(false)}>Cancel</Button>
            <LogoutLink
              className="inline-flex h-10 items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition-colors hover:bg-destructive/90"
              postLogoutRedirectURL="/signed-out"
            >
              Sign out
            </LogoutLink>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
