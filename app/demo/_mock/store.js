// In-memory mock "backend" for the demo. Mirrors the real API response
// shapes so the actual dashboard pages render unchanged. No network, no
// persistence — module state resets on full page reload. Writes mutate the
// store so optimistic updates + SWR revalidation stay consistent, exactly
// like the real app.
//
// This is intentionally a faithful stand-in for the server, not a new UI:
// every builder returns the same object its /api/* route produces. When a
// route's response shape changes, the matching builder here must follow.
//
// Two modes, resolved once per tab (sessionStorage):
//   'family' — five-member household, social surfaces seeded
//   'solo'   — just "You"; Family/Chat stay out of the nav (DemoShell)

import { computeStreak } from "@/lib/streak";

export const DEMO_USER_ID = "demo-you";
const MODE_KEY = "etch-demo-mode";

// ── Tiny date + rng helpers ─────────────────────────────────────────────
function pad(n) {
  return String(n).padStart(2, "0");
}
function dStr(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function daysAgo(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return dStr(d);
}
function todayStr() {
  return daysAgo(0);
}
function dayIndexOf(dateStr) {
  return (new Date(dateStr + "T00:00:00").getDay() + 6) % 7; // 0=Mon
}
function iso(dateStr, hhmm) {
  return `${dateStr}T${hhmm}:00`;
}

// Deterministic per-member rng so every surface tells the same story
// (the tally a member shows on /demo/family matches what their viewing
// page charts) and reloads don't reshuffle anyone's week.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let _id = 1000;
const nextId = () => ++_id;

// ── Member profiles ─────────────────────────────────────────────────────
// Generic placeholder household — never real family names (this is public).
// Leo keeps meals + body private: the privacy story, visible in the demo.
const HIST_DAYS = 35;

const MEMBER_PROFILES = [
  {
    id: DEMO_USER_ID,
    name: "You",
    role: "owner",
    isMe: true,
    seed: 11,
    sleepBase: 7.1,
    waterBase: 1900,
    weightStart: 79.6,
    weightDrift: -1.2, // kg over the window
    cardio: { every: 2, type: "Walk", mins: [25, 40] },
    sessionDays: [0, 2, 4], // Mon Wed Fri
    miniScale: 1.0,
    mealQuality: [3, 2, 3],
    missAt: 13, // last fully-missed day → streak reads 13 with today live
    visibility: null, // null = all visible (matches real default)
  },
  {
    id: "demo-fam-1",
    name: "Mum",
    role: "member",
    seed: 23,
    sleepBase: 7.7,
    waterBase: 2100,
    weightStart: 64.2,
    weightDrift: -0.3,
    cardio: { every: 1, type: "Walk", mins: [40, 50] },
    sessionDays: [1, 4],
    miniScale: 0.9,
    mealQuality: [3, 3, 3],
    missAt: null, // the streak queen — unbroken across the whole window
    visibility: null,
  },
  {
    id: "demo-fam-2",
    name: "Dad",
    role: "member",
    seed: 37,
    sleepBase: 6.7,
    waterBase: 1500,
    weightStart: 86.8,
    weightDrift: -0.9,
    cardio: { every: 3, type: "Run", mins: [25, 32] },
    sessionDays: [2],
    miniScale: 0.6,
    mealQuality: [2, 2, 3],
    missAt: 9,
    visibility: null,
  },
  {
    id: "demo-fam-3",
    name: "Maya",
    role: "member",
    seed: 41,
    sleepBase: 7.4,
    waterBase: 2300,
    weightStart: 58.9,
    weightDrift: 0.2,
    cardio: { every: 2, type: "Cycle", mins: [20, 35] },
    sessionDays: [0, 1, 3, 5],
    miniScale: 1.6,
    mealQuality: [3, 2, 2],
    missAt: 15,
    visibility: null,
  },
  {
    id: "demo-fam-4",
    name: "Leo",
    role: "member",
    seed: 53,
    sleepBase: 6.9,
    waterBase: 1700,
    weightStart: 74.0,
    weightDrift: 0.0,
    cardio: { every: 2, type: "Cycle", mins: [30, 45] },
    sessionDays: [3],
    miniScale: 0.7,
    mealQuality: [2, 1, 3],
    missAt: 6,
    // The privacy showcase: meals + body off. Viewing Leo shows the
    // "keeps this private" states the real app renders.
    visibility: {
      body: false,
      age: true,
      height: true,
      sleep: true,
      mood: true,
      cardio: true,
      meals: false,
      workouts: true,
    },
  },
];

const SESSION_LABELS = ["Upper", "Legs", "Push", "Pull"];
const MEAL_MENUS = {
  breakfast: ["Oats & berries", "Eggs on toast", "Greek yogurt", "Porridge"],
  lunch: ["Chicken & rice", "Leftover pasta", "Soup & bread", "Tuna salad"],
  dinner: ["Salmon & greens", "Stir fry", "Chilli", "Roast veg & halloumi"],
  snack: ["Apple", "Handful of nuts", "Biscuit", "Protein bar"],
};

// ── Per-member history generation ──────────────────────────────────────
// Produces rows in the exact shapes the real /api/* GETs return.
function generateMember(profile) {
  const rng = mulberry32(profile.seed);
  const data = {
    sleep: [],
    mood: [],
    waterDaily: [], // [{date, totalMl}] — range GET aggregates by day
    cardio: [],
    body: [],
    meals: [],
    mini: [],
    sessions: [],
  };

  // "You" stops at yesterday — today's rows live in the store and react to
  // taps. Everyone else generates through today so the family surfaces
  // (ribbon, chorus, leaderboards) read as a household mid-day, not a
  // graveyard.
  const lastDay = profile.isMe ? 1 : 0;
  // Fully-missed days: the most recent one sets the member's streak; a
  // second, older gap keeps calendars and tallies honest-looking.
  const misses = new Set(
    profile.missAt == null ? [] : [profile.missAt, profile.missAt + 8 + (profile.seed % 4)]
  );

  for (let i = HIST_DAYS; i >= lastDay; i--) {
    if (misses.has(i)) continue;
    const date = daysAgo(i);
    const dow = dayIndexOf(date);

    // Sleep: every day, light wobble around the member's base.
    const hours = Math.round((profile.sleepBase + (rng() - 0.5) * 1.6) * 10) / 10;
    const bedH = 22 + Math.floor(rng() * 2.5); // 22:00–00:30
    data.sleep.push({
      id: nextId(),
      userId: profile.id,
      date,
      bedtime: `${pad(bedH % 24)}:${rng() > 0.5 ? "30" : "00"}`,
      wakeTime: `0${6 + Math.floor(rng() * 2)}:${rng() > 0.5 ? "45" : "15"}`,
      hours,
      quality: hours >= profile.sleepBase ? (rng() > 0.4 ? 4 : 5) : rng() > 0.5 ? 3 : 2,
      note: null,
      createdAt: iso(date, "07:10"),
    });

    // Mood: most days. (An evening etch — skip it on the live "today".)
    if (i > 0 && rng() > 0.08) {
      data.mood.push({
        id: nextId(),
        userId: profile.id,
        date,
        mood: 3 + Math.floor(rng() * 2.4),
        energy: 2 + Math.floor(rng() * 3.4),
        note: null,
        createdAt: iso(date, "21:05"),
      });
    }

    // Water: daily total.
    data.waterDaily.push({
      date,
      totalMl: Math.round((profile.waterBase + (rng() - 0.4) * 900) / 250) * 250,
    });

    // Cardio on the member's cadence.
    if (i % profile.cardio.every === 0) {
      const [lo, hi] = profile.cardio.mins;
      const mins = lo + Math.floor(rng() * (hi - lo));
      data.cardio.push({
        id: nextId(),
        userId: profile.id,
        date,
        type: profile.cardio.type,
        durationMinutes: mins,
        distanceKm: (mins * (profile.cardio.type === "Run" ? 0.18 : 0.08)).toFixed(2),
        steps: null,
        note: null,
        // Today's entries read as "this morning" whatever the visitor's clock.
        createdAt: iso(date, i === 0 ? "08:05" : "18:05"),
      });
    }

    // Weigh-in roughly twice a week, drifting toward the goal.
    if (i % 4 === 0) {
      const progress = (HIST_DAYS - i) / HIST_DAYS;
      const w = profile.weightStart + profile.weightDrift * progress + (rng() - 0.5) * 0.4;
      data.body.push({
        id: nextId(),
        userId: profile.id,
        date,
        weightKg: w.toFixed(1),
        waistCm: null,
        chestCm: null,
        armsCm: null,
        hipsCm: null,
        thighsCm: null,
        note: null,
        createdAt: iso(date, "08:20"),
      });
    }

    // Meals: breakfast + lunch most days, dinner every day.
    const slots = [
      ["breakfast", "08:00", rng() > 0.12],
      // Today's lunch only exists once it's actually lunchtime.
      ["lunch", "13:00", i > 0 ? rng() > 0.18 : new Date().getHours() >= 13],
      ["dinner", "19:30", i > 0], // dinner hasn't happened on the live "today"
    ];
    slots.forEach(([slot, time, present], idx) => {
      if (!present) return;
      const menu = MEAL_MENUS[slot];
      const baseQ = profile.mealQuality[idx] ?? 2;
      const quality = rng() > 0.8 ? Math.max(1, baseQ - 1) : baseQ;
      data.meals.push({
        id: nextId(),
        userId: profile.id,
        date,
        slot,
        description: menu[Math.floor(rng() * menu.length)],
        quality,
        createdAt: iso(date, time),
      });
    });

    // Daily 4: 0–4 slots etched, scaled by the member's intensity.
    const slotsDone = rng() > 0.15 ? 4 : Math.floor(rng() * 4);
    for (let slot = 0; slot < slotsDone; slot++) {
      data.mini.push({
        id: nextId(),
        userId: profile.id,
        date,
        slot,
        count: Math.round((15 + Math.floor(rng() * 30)) * profile.miniScale),
        createdAt: iso(date, "07:40"),
        updatedAt: iso(date, "07:40"),
      });
    }

    // Sessions on the member's training days.
    if (profile.sessionDays.includes(dow)) {
      data.sessions.push({
        id: nextId(),
        userId: profile.id,
        date,
        planDayId: null,
        completed: rng() > 0.1,
        durationMinutes: 35 + Math.floor(rng() * 30),
        notes: null,
        createdAt: iso(date, i === 0 ? "07:35" : "19:00"),
        planDayLabel: SESSION_LABELS[Math.floor(rng() * SESSION_LABELS.length)],
      });
    }
  }

  return data;
}

// ── Seed ────────────────────────────────────────────────────────────────
function seed(mode) {
  _id = 1000;
  const today = todayStr();
  const profiles =
    mode === "solo" ? MEMBER_PROFILES.filter((p) => p.isMe) : MEMBER_PROFILES;

  const perUser = new Map();
  for (const p of profiles) perUser.set(p.id, generateMember(p));

  const mine = perUser.get(DEMO_USER_ID);

  // Today's partial state for "You" — rich, but still room to interact.
  const todaySleep = {
    id: nextId(),
    userId: DEMO_USER_ID,
    date: today,
    bedtime: "23:30",
    wakeTime: "07:00",
    hours: 7.5,
    quality: 4,
    note: null,
  };
  const todayMood = { id: nextId(), userId: DEMO_USER_ID, date: today, mood: 4, energy: 4, note: null };
  const todayWater = [
    { id: nextId(), userId: DEMO_USER_ID, date: today, amountMl: 250, createdAt: iso(today, "08:30") },
    { id: nextId(), userId: DEMO_USER_ID, date: today, amountMl: 500, createdAt: iso(today, "11:00") },
    { id: nextId(), userId: DEMO_USER_ID, date: today, amountMl: 500, createdAt: iso(today, "14:00") },
  ];
  const todayCardio = [
    { id: nextId(), userId: DEMO_USER_ID, date: today, type: "Walk", durationMinutes: 30, distanceKm: "2.40", steps: null, note: null, createdAt: iso(today, "12:30") },
  ];
  const todayMeals = [
    { id: nextId(), userId: DEMO_USER_ID, date: today, slot: "breakfast", description: "Oats & berries", quality: 3, createdAt: iso(today, "08:00") },
    { id: nextId(), userId: DEMO_USER_ID, date: today, slot: "lunch", description: "Chicken & rice", quality: 2, createdAt: iso(today, "13:00") },
  ];
  const todayMini = [0, 1, 2, 3].map((slot) => ({
    id: nextId(),
    userId: DEMO_USER_ID,
    date: today,
    slot,
    count: [40, 50, 30, 60][slot],
    createdAt: iso(today, "07:40"),
    updatedAt: iso(today, "07:40"),
  }));

  // Check-ins: a lived-in last two weeks. Today stays OPEN so the
  // close-the-day ritual is there to try.
  const checkIns = [];
  for (let i = 14; i >= 1; i--) {
    const date = daysAgo(i);
    if (i % 5 === 0) continue; // a few honest gaps
    checkIns.push({
      id: nextId(),
      userId: DEMO_USER_ID,
      date,
      resistance: 1 + ((i * 3) % 3),
      followThroughScore: null,
      intentionalRest: dayIndexOf(date) === 6,
      closedAt: i <= 10 ? iso(date, "21:4" + (i % 10)) : null,
      note: null,
      createdAt: iso(date, "21:30"),
    });
  }

  // ── Plan: a full week so Train + Today both read right ──
  const todayIdx = dayIndexOf(today);
  const dayLabels = ["Upper", "Rest", "Legs", "Rest", "Push", "Rest", "Rest"];
  // Rotate so TODAY lands on "Upper" (the demo's main act).
  const planDays = Array.from({ length: 7 }, (_, k) => ({
    id: k + 1,
    planId: 1,
    dayIndex: (todayIdx + k) % 7,
    label: dayLabels[k],
  }));
  const plan = {
    id: 1,
    userId: DEMO_USER_ID,
    name: "Push / Pull / Legs",
    description: "Three lifts a week. Walks in between.",
    isActive: true,
    repeatWeekly: true,
    activatedAt: iso(daysAgo(20), "09:00"),
    createdAt: iso(daysAgo(60), "09:00"),
  };

  const exerciseLibrary = [
    { id: 101, name: "Dumbbell Curl", muscleGroup: "Arms", equipment: "Dumbbell", notes: null },
    { id: 102, name: "Bench Press", muscleGroup: "Chest", equipment: "Barbell", notes: null },
    { id: 103, name: "Incline DB Press", muscleGroup: "Chest", equipment: "Dumbbell", notes: null },
    { id: 104, name: "Back Squat", muscleGroup: "Legs", equipment: "Barbell", notes: null },
    { id: 105, name: "Deadlift", muscleGroup: "Back", equipment: "Barbell", notes: null },
    { id: 106, name: "Overhead Press", muscleGroup: "Shoulders", equipment: "Barbell", notes: null },
    { id: 107, name: "Lat Pulldown", muscleGroup: "Back", equipment: "Machine", notes: null },
    { id: 108, name: "Cable Fly", muscleGroup: "Chest", equipment: "Cable", notes: null },
    { id: 109, name: "Leg Press", muscleGroup: "Legs", equipment: "Machine", notes: null },
    { id: 110, name: "Plank", muscleGroup: "Core", equipment: "Bodyweight", notes: null },
  ].map((e) => ({ ...e, createdAt: iso(daysAgo(60), "09:00") }));

  // Exercises programmed into today's "Upper" day (planDay id 1).
  const todayExercises = [
    { id: 11, planDayId: 1, exerciseId: 102, position: 0, targetSets: 3, targetReps: 6, targetWeight: "80.00", targetDurationMinutes: null, targetDistanceKm: null, notes: null, name: "Bench Press", muscleGroup: "Chest", equipment: "Barbell" },
    { id: 12, planDayId: 1, exerciseId: 103, position: 1, targetSets: 3, targetReps: 10, targetWeight: "22.50", targetDurationMinutes: null, targetDistanceKm: null, notes: null, name: "Incline DB Press", muscleGroup: "Chest", equipment: "Dumbbell" },
    { id: 13, planDayId: 1, exerciseId: 101, position: 2, targetSets: 3, targetReps: 8, targetWeight: "20.00", targetDurationMinutes: null, targetDistanceKm: null, notes: null, name: "Dumbbell Curl", muscleGroup: "Arms", equipment: "Dumbbell" },
  ];

  const todaySession = {
    id: 500,
    userId: DEMO_USER_ID,
    date: today,
    planDayId: 1,
    completed: false,
    durationMinutes: null,
    notes: null,
    createdAt: iso(today, "18:30"),
  };

  // ── Goals (shapes match /api/goals GET incl. annotations) ──
  const goals = [
    {
      id: 900,
      userId: DEMO_USER_ID,
      kind: "weight",
      exerciseId: null,
      targetValue: "76.00",
      targetUnit: "kg",
      targetDate: null,
      description: "Back to 76 kg",
      active: true,
      createdAt: iso(daysAgo(30), "10:00"),
    },
    {
      id: 901,
      userId: DEMO_USER_ID,
      kind: "junk-limit",
      exerciseId: null,
      targetValue: "3",
      targetUnit: null,
      targetDate: null,
      description: "Max 3 junk meals a week",
      active: true,
      createdAt: iso(daysAgo(30), "10:00"),
    },
    {
      id: 902,
      userId: DEMO_USER_ID,
      kind: "lift",
      exerciseId: 102,
      targetValue: "100.00",
      targetUnit: "kg",
      targetDate: null,
      description: "Bench 100 kg",
      active: true,
      createdAt: iso(daysAgo(25), "10:00"),
    },
  ];

  // userContext is complete so the "Get set up" card reads done — the
  // demo account is lived-in, not half-onboarded.
  const userContext = {
    id: 1,
    userId: DEMO_USER_ID,
    goals: "Show up daily. 76 kg by September.",
    restrictions: "Left knee — no deep lunges.",
    preferences: "Mornings. Short sessions over long ones.",
    chatRetentionDays: null,
    waterTargetMl: 2500,
    miniExercises: null,
    personality: "steady",
    updatedAt: iso(daysAgo(5), "10:00"),
  };

  // ── Journal (private) ──
  const journal = [
    { date: daysAgo(6), time: "21:42", content: "Skipped the snack drawer after dinner. Small thing, felt big." },
    { date: daysAgo(4), time: "07:55", content: "Walked before work instead of after. Better. Keep that." },
    { date: daysAgo(3), time: "22:01", content: "Bench felt heavy today. Slept 6h the night before — related, probably." },
    { date: daysAgo(1), time: "21:30", content: "Three healthy meals, no junk. First clean day this week." },
  ].map((j) => ({
    id: nextId(),
    userId: DEMO_USER_ID,
    date: j.date,
    content: j.content,
    source: "user",
    kind: "journal",
    createdAt: iso(j.date, j.time),
  }));

  // ── Family room (shared) ──
  const yesterday = daysAgo(1);
  const familyChat =
    mode === "solo"
      ? []
      : [
          { authorId: "demo-fam-2", date: yesterday, time: "19:12", content: "5k in 26:40. Knee held up." },
          { authorId: "demo-fam-1", date: yesterday, time: "19:30", content: "That's three this week. Show-off." },
          { authorId: DEMO_USER_ID, date: yesterday, time: "21:05", content: "Closed the day. 6 of 7." },
          { authorId: "demo-fam-3", date: today, time: "07:25", content: "Daily 4 before school. 60 squats." },
          { authorId: "demo-fam-1", date: today, time: "08:02", content: "Frost on the field this morning. Walk done anyway." },
          { authorId: "demo-fam-4", date: today, time: "10:45", content: "Gym after my shift. Holding me to it." },
        ].map((m) => ({
          id: nextId(),
          userId: m.authorId,
          date: m.date,
          content: m.content,
          createdAt: iso(m.date, m.time),
        }));

  // ── Invites (one pending, so the manager has something to show) ──
  const invites =
    mode === "solo"
      ? []
      : [
          {
            id: 700,
            email: "nan@example.com",
            role: "member",
            status: "pending",
            invitedByUserId: DEMO_USER_ID,
            createdAt: iso(daysAgo(2), "17:00"),
            expiresAt: iso(daysAgo(-12), "17:00"),
          },
        ];

  // ── Reminders ──
  const reminders = [
    { id: 800, kind: "water", label: "Drink a glass", schedule: "every 2h 09:00–21:00", channel: "push", enabled: true, quietOnRest: false },
    { id: 801, kind: "weighin", label: "Sunday weigh-in", schedule: "Sun 09:00", channel: "push", enabled: true, quietOnRest: false },
    { id: 802, kind: "winddown", label: "Wind down", schedule: "daily 21:30", channel: "push", enabled: false, quietOnRest: true },
  ].map((r) => ({ ...r, userId: DEMO_USER_ID, lastFiredAt: null, createdAt: iso(daysAgo(20), "10:00") }));

  return {
    mode,
    today,
    me: {
      id: DEMO_USER_ID,
      email: "you@demo.etch",
      displayName: "You",
      dateOfBirth: "1996-05-01",
      age: 30,
      heightCm: 178,
      visibility: null,
      role: "owner",
    },
    profiles,
    perUser,
    // Live "today" state for You (mutated by taps):
    sleep: todaySleep,
    water: todayWater,
    mood: todayMood,
    cardio: todayCardio,
    meals: todayMeals,
    mini: todayMini,
    checkIn: null,
    checkIns,
    plan,
    planDays,
    extraPlans: [],
    exerciseLibrary,
    todayExercises,
    todaySession,
    todaySets: [],
    exerciseMaxes: { 101: 22, 102: 95, 103: 24 },
    goals,
    userContext,
    journal,
    familyChat,
    pendingReply: null,
    invites,
    reminders,
    history: mine, // alias: You's generated history
  };
}

// Mode is decided once per tab: URL param wins, then sessionStorage,
// default 'family'. Called by MockProvider before the first fetch.
export function resolveMode(searchParams) {
  let fromUrl = null;
  try {
    fromUrl = searchParams?.get?.("mode") ?? null;
  } catch {
    /* no-op */
  }
  let stored = null;
  try {
    stored = window.sessionStorage.getItem(MODE_KEY);
  } catch {
    /* no-op */
  }
  const mode = fromUrl === "solo" || fromUrl === "family" ? fromUrl : stored === "solo" ? "solo" : "family";
  try {
    window.sessionStorage.setItem(MODE_KEY, mode);
  } catch {
    /* no-op */
  }
  return mode;
}

let store = seed("family");

export function getMode() {
  return store.mode;
}

export function setMode(mode) {
  if (mode !== store.mode) store = seed(mode);
}

export function resetStore() {
  store = seed(store.mode);
}

// ── Derived helpers ─────────────────────────────────────────────────────

// For You, the generated history is fused with today's live state so
// streaks / trends / tallies update as the visitor taps things.
function liveHistory() {
  const t = store.today;
  const h = store.history;
  const totalMl = store.water.reduce((s, e) => s + (e.amountMl ?? 0), 0);
  return {
    sleep: store.sleep ? [{ ...store.sleep }, ...h.sleep] : [...h.sleep],
    mood: store.mood ? [{ ...store.mood, date: t }, ...h.mood] : [...h.mood],
    waterDaily: [{ date: t, totalMl }, ...h.waterDaily],
    cardio: [...store.cardio, ...h.cardio],
    body: [...h.body],
    meals: [...store.meals, ...h.meals],
    mini: [...store.mini, ...h.mini],
    sessions: store.todaySession?.completed
      ? [{ ...store.todaySession, planDayLabel: "Upper" }, ...h.sessions]
      : [...h.sessions],
  };
}

function memberHistory(userId) {
  if (userId === DEMO_USER_ID) return liveHistory();
  return store.perUser.get(userId) ?? null;
}

function activeDatesFor(h) {
  const s = new Set();
  for (const r of h.sessions) if (r.completed) s.add(r.date);
  for (const r of h.sleep) s.add(r.date);
  for (const r of h.mood) if (r.mood || r.energy) s.add(r.date);
  for (const r of h.waterDaily) if (r.totalMl > 0) s.add(r.date);
  for (const r of h.cardio) s.add(r.date);
  for (const r of h.body) if (r.weightKg) s.add(r.date);
  for (const r of h.meals) s.add(r.date);
  for (const r of h.mini) if (Number(r.count) > 0) s.add(r.date);
  return s;
}

// "X of 7 etched" per (member, date): the seven categories Today counts.
function etchedCountOn(h, date) {
  let n = 0;
  if (h.sleep.some((r) => r.date === date)) n++;
  if (h.waterDaily.some((r) => r.date === date && r.totalMl > 0)) n++;
  if (h.mood.some((r) => r.date === date && (r.mood || r.energy))) n++;
  if (h.cardio.some((r) => r.date === date)) n++;
  if (h.meals.some((r) => r.date === date)) n++;
  if (h.mini.some((r) => r.date === date && Number(r.count) > 0)) n++;
  if (h.sessions.some((r) => r.date === date && r.completed)) n++;
  return n;
}

function inRange(rows, from, to) {
  return rows.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
}
function byDateDesc(rows) {
  return [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

// ── Builders (mirror the real route shapes) ────────────────────────────
function buildDashboard(viewingId) {
  const date = store.today;
  const dayIndex = dayIndexOf(date);
  const other =
    viewingId && viewingId !== DEMO_USER_ID
      ? store.profiles.find((p) => p.id === viewingId)
      : null;

  if (other) {
    // Read-only view of another member, with their visibility honoured —
    // hidden sections are blanked server-side exactly like the real route.
    const h = store.perUser.get(other.id);
    const vis = other.visibility ?? {
      body: true, age: true, height: true, sleep: true,
      mood: true, cardio: true, meals: true, workouts: true,
    };
    const hidden = (flag) => !vis[flag];
    return {
      date,
      dayIndex,
      isViewingOther: true,
      viewingId: other.id,
      viewee: { id: other.id, displayName: other.name },
      vieweeVisibility: vis,
      streak: computeStreak(activeDatesFor(h)),
      todaySession: {
        date,
        dayIndex,
        plan: null,
        planDay: null,
        planDays: [],
        exercises: [],
        session: hidden("workouts") ? null : h.sessions.find((r) => r.date === date) ?? null,
        sets: [],
      },
      today: {
        sleep: hidden("sleep") ? null : h.sleep.find((r) => r.date === date) ?? null,
        water: (() => {
          const t = h.waterDaily.find((r) => r.date === date)?.totalMl ?? 0;
          return { entries: [], totalMl: t };
        })(),
        mood: hidden("mood") ? null : h.mood.find((r) => r.date === date) ?? null,
        checkIn: null,
        cardio: hidden("cardio") ? [] : h.cardio.filter((r) => r.date === date),
        meals: hidden("meals") ? [] : h.meals.filter((r) => r.date === date),
        mini: h.mini.filter((r) => r.date === date),
      },
      history: {
        sessions: hidden("workouts") ? [] : byDateDesc(h.sessions),
        sleep: hidden("sleep") ? [] : byDateDesc(h.sleep),
        mood: hidden("mood") ? [] : byDateDesc(h.mood),
        water: byDateDesc(h.waterDaily),
        cardio: hidden("cardio") ? [] : byDateDesc(h.cardio),
        body: hidden("body") ? [] : byDateDesc(h.body),
        meals: hidden("meals") ? [] : byDateDesc(h.meals),
        mini: byDateDesc(h.mini),
      },
      userContext: null,
      exerciseMaxes: {},
    };
  }

  const h = liveHistory();
  const totalMl = store.water.reduce((s, e) => s + (e.amountMl ?? 0), 0);
  return {
    date,
    dayIndex,
    isViewingOther: false,
    viewingId: DEMO_USER_ID,
    viewee: null,
    vieweeVisibility: null,
    streak: computeStreak(activeDatesFor(h)),
    todaySession: {
      date,
      dayIndex,
      plan: store.plan,
      planDay: store.planDays.find((d) => d.dayIndex === dayIndex) ?? null,
      planDays: store.planDays,
      exercises: store.todayExercises,
      session: store.todaySession,
      sets: store.todaySets,
    },
    today: {
      sleep: store.sleep,
      water: { entries: store.water, totalMl },
      mood: store.mood,
      checkIn: store.checkIn,
      cardio: store.cardio,
      meals: store.meals,
      mini: store.mini,
    },
    history: {
      sessions: byDateDesc(h.sessions),
      sleep: byDateDesc(h.sleep),
      mood: byDateDesc(h.mood),
      water: byDateDesc(h.waterDaily),
      cardio: byDateDesc(h.cardio),
      body: byDateDesc(h.body),
      meals: byDateDesc(h.meals),
      mini: byDateDesc(h.mini),
    },
    userContext: store.userContext,
    exerciseMaxes: store.exerciseMaxes,
  };
}

function buildFamily() {
  const today = store.today;
  const members = store.profiles.map((p, i) => {
    const h = memberHistory(p.id);
    const last7 = Array.from({ length: 7 }, (_, k) => etchedCountOn(h, daysAgo(6 - k)));
    const weekStartOffset = dayIndexOf(today); // days since Monday
    const weekSessions = h.sessions.filter(
      (r) => r.completed && r.date >= daysAgo(weekStartOffset) && r.planDayLabel !== "Rest"
    ).length;
    const miniToday = h.mini
      .filter((r) => r.date === today)
      .reduce((s, r) => s + (Number(r.count) || 0), 0);
    const etchedToday = etchedCountOn(h, today);
    return {
      id: p.id,
      email: p.isMe ? store.me.email : null,
      displayName: p.name,
      dateOfBirth: p.isMe ? store.me.dateOfBirth : "1990-01-01",
      age: p.isMe ? store.me.age : 34 + i,
      heightCm: 170 + i * 3,
      visibility: p.visibility ?? {
        body: true, age: true, height: true, sleep: true,
        mood: true, cardio: true, meals: true, workouts: true,
      },
      lastActiveAt: new Date(Date.now() - i * 47 * 60_000).toISOString(),
      isMe: !!p.isMe,
      role: p.role,
      streak: computeStreak(activeDatesFor(h)),
      completedWorkoutsThisWeek: weekSessions,
      dailyMiniTodayTotal: miniToday,
      etchedToday: etchedToday > 0,
      etchedTodayCount: etchedToday,
      last7DaysTally: last7,
    };
  });
  return {
    today,
    members,
    family: {
      id: "fam_demo",
      name: store.mode === "solo" ? "Just you" : "Your family",
      ownerUserId: DEMO_USER_ID,
    },
    myRole: "owner",
  };
}

function buildActivity() {
  const items = [];
  const since = daysAgo(13);
  for (const p of store.profiles) {
    const h = memberHistory(p.id);
    const vis = p.visibility ?? {};
    const visible = (flag) => p.id === DEMO_USER_ID || vis[flag] !== false;
    if (visible("sleep"))
      for (const r of inRange(h.sleep, since, null))
        items.push({
          kind: "sleep", userId: p.id, userName: p.name, date: r.date, ts: r.createdAt,
          summary: `etched sleep · ${Number(r.hours)}h${r.quality ? ` · ${r.quality}/5` : ""}`,
        });
    if (visible("cardio"))
      for (const r of inRange(h.cardio, since, null)) {
        const type = (r.type || "cardio").toLowerCase();
        items.push({
          kind: "cardio", userId: p.id, userName: p.name, date: r.date, ts: r.createdAt,
          summary: `etched ${r.durationMinutes} min ${type}${r.distanceKm ? ` · ${Number(r.distanceKm)}km` : ""}`,
        });
      }
    if (visible("body"))
      for (const r of inRange(h.body, since, null))
        items.push({
          kind: "body", userId: p.id, userName: p.name, date: r.date, ts: r.createdAt,
          summary: `etched a weigh-in · ${Number(r.weightKg).toFixed(1)}kg`,
        });
    if (visible("meals"))
      for (const r of inRange(h.meals, since, null)) {
        const q = r.quality === 1 ? " · junk" : r.quality === 3 ? " · healthy" : "";
        items.push({
          kind: "meals", userId: p.id, userName: p.name, date: r.date, ts: r.createdAt,
          summary: `etched ${r.slot}${q}`,
        });
      }
    for (const r of inRange(h.mini, since, null))
      if (Number(r.count) > 0)
        items.push({
          kind: "mini", userId: p.id, userName: p.name, date: r.date, ts: r.updatedAt,
          summary: `etched Daily 4 · ${r.count} reps`,
        });
    if (visible("workouts"))
      for (const r of inRange(h.sessions, since, null))
        if (r.completed)
          items.push({
            kind: "session", userId: p.id, userName: p.name, date: r.date, ts: r.createdAt,
            summary: `etched ${r.planDayLabel || "a session"}`,
          });
  }
  items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return new Date(b.ts).getTime() - new Date(a.ts).getTime();
  });
  return { items: items.slice(0, 40) };
}

// Family-room chat with a scripted reply: the first time the visitor
// sends a message, Mum starts "typing" right away and answers ~3s later.
// The page polls every 1.5s, so the whole exchange feels live.
const REPLIES = [
  "Look at you. Six of seven.",
  "Etched. That's the whole job.",
  "Saw that. Keep going.",
];
let replyIdx = 0;

function buildFamilyChat() {
  // Materialise a due reply before answering.
  if (store.pendingReply && Date.now() >= store.pendingReply.dueAt) {
    const today = store.today;
    const d = new Date();
    store.familyChat.push({
      id: nextId(),
      userId: "demo-fam-1",
      date: today,
      content: store.pendingReply.content,
      createdAt: `${today}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
    });
    store.pendingReply = null;
  }
  const nameById = new Map(store.profiles.map((p) => [p.id, p.name]));
  const messages = [...store.familyChat]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map((m) => ({ ...m, authorName: nameById.get(m.userId) ?? "Family" }));
  const typing =
    store.pendingReply && Date.now() < store.pendingReply.dueAt
      ? [{ id: "demo-fam-1", displayName: "Mum" }]
      : [];
  return { messages, typing };
}

function annotatedGoals() {
  const h = liveHistory();
  const latestWeight = h.body.length ? Number(byDateDesc(h.body)[0].weightKg) : null;
  const weekStart = daysAgo(dayIndexOf(store.today));
  const junk = h.meals.filter((m) => m.date >= weekStart && m.quality === 1).length;
  const benchMax = store.exerciseMaxes[102] ?? null;
  return store.goals.map((g) => {
    let current = null;
    let exerciseName = null;
    if (g.kind === "weight") current = latestWeight;
    else if (g.kind === "junk-limit") current = junk;
    else if (g.kind === "lift") {
      current = benchMax;
      exerciseName = store.exerciseLibrary.find((e) => e.id === g.exerciseId)?.name ?? null;
    }
    const target = g.targetValue == null ? null : Number(g.targetValue);
    let progress01 = null;
    if (current != null && target != null && target > 0 && g.kind !== "weight") {
      progress01 = g.kind === "junk-limit" ? current / target : Math.min(1, current / target);
    }
    return { ...g, current, exerciseName, progress01 };
  });
}

// ── Write handlers ──────────────────────────────────────────────────────
function upsertMini(body) {
  const slot = Number(body?.slot);
  const count = Number(body?.count) || 0;
  const existing = store.mini.find((m) => m.slot === slot);
  if (existing) existing.count = count;
  else
    store.mini.push({
      id: nextId(),
      userId: DEMO_USER_ID,
      date: store.today,
      slot,
      count,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  return store.mini.find((m) => m.slot === slot);
}

function parseQuery(rawUrl) {
  const q = {};
  const i = rawUrl.indexOf("?");
  if (i === -1) return q;
  for (const [k, v] of new URLSearchParams(rawUrl.slice(i + 1))) q[k] = v;
  return q;
}

// ── Router ──────────────────────────────────────────────────────────────
// Returns { status, data }. Unmapped reads → empty, unmapped writes →
// { ok: true }, so an un-stubbed endpoint can never crash the demo.
// Deep-clone every response so callers never receive a live reference into
// the store. This mirrors a real HTTP boundary, where every response is
// serialized over the wire and re-parsed into fresh objects.
//
// Why it matters: the axios read path (GlobalApi.*) doesn't serialize, so
// without this it would hand a page the store's own array/object. After a
// mutating write that push()es into that same array, React's useState +
// useMemo see an UNCHANGED reference and skip re-rendering — e.g. a newly
// added exercise/goal/plan never appears until a full reload. JSON round-
// trip matches the real API exactly (the store already holds ISO strings,
// not Date objects). structuredClone is faster where available.
const _clone =
  typeof structuredClone === "function"
    ? structuredClone
    : (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

export function handleApi(method, rawUrl, body) {
  const res = routeApi(method, rawUrl, body);
  return { status: res.status, data: _clone(res.data) };
}

function routeApi(method, rawUrl, body) {
  const [path] = rawUrl.split("?");
  const q = parseQuery(rawUrl);
  const m = method.toUpperCase();
  const t = store.today;

  if (path === "/api/dashboard") return { status: 200, data: buildDashboard(q.viewing) };
  if (path === "/api/family") return { status: 200, data: buildFamily() };
  if (path === "/api/family/activity") return { status: 200, data: buildActivity() };

  if (path === "/api/users/me") {
    if (q.viewing && q.viewing !== DEMO_USER_ID) {
      const p = store.profiles.find((x) => x.id === q.viewing);
      if (p) {
        const vis = p.visibility ?? {};
        return {
          status: 200,
          data: {
            id: p.id,
            email: null,
            displayName: p.name,
            dateOfBirth: null,
            age: vis.age === false ? null : 34,
            heightCm: vis.height === false ? null : 172,
            visibility: p.visibility,
          },
        };
      }
    }
    if (m === "PUT") {
      store.me = { ...store.me, ...body };
      return { status: 200, data: store.me };
    }
    return { status: 200, data: store.me };
  }

  // ── Health modules: ?date= single-day reads, ?from&to ranges ──
  if (path === "/api/sleep") {
    if (m === "POST") {
      store.sleep = { id: store.sleep?.id ?? nextId(), userId: DEMO_USER_ID, date: body?.date ?? t, ...body };
      return { status: 200, data: store.sleep };
    }
    if (m === "DELETE") {
      store.sleep = null;
      return { status: 200, data: { ok: true } };
    }
    const h = liveHistory();
    if (q.date) return { status: 200, data: h.sleep.find((r) => r.date === q.date) ?? null };
    return { status: 200, data: byDateDesc(inRange(h.sleep, q.from, q.to)) };
  }

  if (path === "/api/water") {
    if (m === "POST") {
      const row = { id: nextId(), userId: DEMO_USER_ID, date: body?.date ?? t, amountMl: Number(body?.amountMl) || 0, createdAt: new Date().toISOString() };
      store.water.unshift(row);
      return { status: 200, data: row };
    }
    if (m === "DELETE") {
      const id = Number(q.id);
      store.water = store.water.filter((w) => w.id !== id);
      return { status: 200, data: { ok: true } };
    }
    if (q.date) {
      const entries = q.date === t ? store.water : [];
      const fromHist = q.date === t ? null : store.history.waterDaily.find((r) => r.date === q.date);
      const totalMl = q.date === t
        ? entries.reduce((s, e) => s + (e.amountMl ?? 0), 0)
        : fromHist?.totalMl ?? 0;
      // Past days: synthesise one entry so the page has something to list.
      const synth = fromHist && totalMl > 0
        ? [{ id: 1, userId: DEMO_USER_ID, date: q.date, amountMl: totalMl, createdAt: iso(q.date, "12:00") }]
        : [];
      return { status: 200, data: { entries: q.date === t ? entries : synth, totalMl } };
    }
    const h = liveHistory();
    return { status: 200, data: byDateDesc(inRange(h.waterDaily, q.from, q.to)) };
  }

  if (path === "/api/mood") {
    if (m === "POST") {
      store.mood = { id: store.mood?.id ?? nextId(), userId: DEMO_USER_ID, date: body?.date ?? t, ...body };
      return { status: 200, data: store.mood };
    }
    if (m === "DELETE") {
      store.mood = null;
      return { status: 200, data: { ok: true } };
    }
    const h = liveHistory();
    if (q.date) return { status: 200, data: h.mood.find((r) => r.date === q.date) ?? null };
    return { status: 200, data: byDateDesc(inRange(h.mood, q.from, q.to)) };
  }

  if (path === "/api/body-metrics") {
    if (m === "POST") {
      const row = { id: nextId(), userId: DEMO_USER_ID, date: body?.date ?? t, ...body, createdAt: new Date().toISOString() };
      store.history.body.unshift(row);
      return { status: 200, data: row };
    }
    if (m === "DELETE") {
      const id = Number(q.id);
      store.history.body = store.history.body.filter((r) => r.id !== id);
      return { status: 200, data: { ok: true } };
    }
    const h = liveHistory();
    return { status: 200, data: byDateDesc(inRange(h.body, q.from ?? q.date, q.to ?? q.date)) };
  }

  if (path === "/api/cardio") {
    if (m === "POST") {
      const row = { id: nextId(), userId: DEMO_USER_ID, date: body?.date ?? t, createdAt: new Date().toISOString(), ...body };
      store.cardio.unshift(row);
      return { status: 200, data: row };
    }
    if (m === "PUT") {
      const all = [store.cardio, store.history.cardio];
      for (const list of all) {
        const row = list.find((x) => x.id === Number(body?.id));
        if (row) Object.assign(row, body);
      }
      return { status: 200, data: { ok: true } };
    }
    if (m === "DELETE") {
      const id = Number(q.id);
      store.cardio = store.cardio.filter((x) => x.id !== id);
      store.history.cardio = store.history.cardio.filter((x) => x.id !== id);
      return { status: 200, data: { ok: true } };
    }
    const h = liveHistory();
    return { status: 200, data: byDateDesc(inRange(h.cardio, q.from, q.to)) };
  }

  if (path === "/api/meals") {
    if (m === "POST") {
      const row = { id: nextId(), userId: DEMO_USER_ID, date: body?.date ?? t, createdAt: new Date().toISOString(), ...body };
      if ((body?.date ?? t) === t) store.meals.push(row);
      else store.history.meals.push(row);
      return { status: 200, data: row };
    }
    if (m === "PUT") {
      const id = Number(body?.id);
      for (const list of [store.meals, store.history.meals]) {
        const row = list.find((x) => x.id === id);
        if (row) Object.assign(row, body);
      }
      return { status: 200, data: { ok: true } };
    }
    if (m === "DELETE") {
      const id = Number(q.id);
      store.meals = store.meals.filter((x) => x.id !== id);
      store.history.meals = store.history.meals.filter((x) => x.id !== id);
      return { status: 200, data: { ok: true } };
    }
    const h = liveHistory();
    if (q.date) return { status: 200, data: h.meals.filter((r) => r.date === q.date) };
    return { status: 200, data: byDateDesc(inRange(h.meals, q.from, q.to)) };
  }

  if (path === "/api/mini") {
    if (m === "POST") return { status: 200, data: upsertMini(body) };
    if (m === "DELETE") {
      const slot = Number(q.slot);
      const row = store.mini.find((x) => x.slot === slot);
      if (row) row.count = 0;
      return { status: 200, data: { ok: true } };
    }
    const h = liveHistory();
    if (q.date) return { status: 200, data: h.mini.filter((r) => r.date === q.date) };
    return { status: 200, data: byDateDesc(inRange(h.mini, q.from, q.to)) };
  }

  if (path === "/api/check-ins") {
    if (m === "POST") {
      store.checkIn = { id: store.checkIn?.id ?? nextId(), userId: DEMO_USER_ID, date: t, ...store.checkIn, ...body };
      if (body?.closedAt === true) store.checkIn.closedAt = new Date().toISOString();
      if (body?.closedAt === false) store.checkIn.closedAt = null;
      return { status: 200, data: store.checkIn };
    }
    const rows = [...store.checkIns, ...(store.checkIn ? [store.checkIn] : [])];
    return { status: 200, data: byDateDesc(inRange(rows, q.from, q.to)) };
  }

  // ── Training ──
  if (path === "/api/exercises") {
    if (m === "POST") {
      const row = { id: nextId(), createdAt: new Date().toISOString(), ...body };
      store.exerciseLibrary.push(row);
      return { status: 200, data: row };
    }
    if (m === "PUT") {
      const row = store.exerciseLibrary.find((e) => e.id === Number(body?.id));
      if (row) Object.assign(row, body);
      return { status: 200, data: row ?? { ok: true } };
    }
    if (m === "DELETE") {
      store.exerciseLibrary = store.exerciseLibrary.filter((e) => e.id !== Number(q.id));
      return { status: 200, data: { ok: true } };
    }
    return { status: 200, data: store.exerciseLibrary };
  }

  if (path === "/api/plans") {
    if (m === "POST") {
      const row = {
        id: nextId(),
        userId: DEMO_USER_ID,
        name: body?.name ?? "New plan",
        description: body?.description ?? null,
        isActive: false,
        repeatWeekly: body?.repeatWeekly !== false,
        activatedAt: null,
        createdAt: new Date().toISOString(),
        exerciseCount: 0,
        trainingDays: 0,
        restDays: 7,
        days: [],
      };
      store.extraPlans.push(row);
      return { status: 200, data: row };
    }
    if (m === "PUT") {
      const row = [store.plan, ...store.extraPlans].find((p) => p.id === Number(body?.id));
      if (row) Object.assign(row, body);
      return { status: 200, data: row ?? { ok: true } };
    }
    if (m === "DELETE") {
      store.extraPlans = store.extraPlans.filter((p) => p.id !== Number(q.id));
      return { status: 200, data: { ok: true } };
    }
    const trainingDays = store.planDays.filter((d) => d.label !== "Rest").length;
    return {
      status: 200,
      data: [
        {
          ...store.plan,
          exerciseCount: store.todayExercises.length,
          trainingDays,
          restDays: 7 - trainingDays,
          days: store.planDays.map((d) => ({ dayIndex: d.dayIndex, label: d.label })),
        },
        ...store.extraPlans,
      ],
    };
  }
  // Plan activate (POST /api/plans/<id>/activate): flip the active flag.
  if (path.startsWith("/api/plans/") && path.endsWith("/activate")) {
    const id = Number(path.split("/")[3]);
    for (const p of [store.plan, ...store.extraPlans]) p.isActive = p.id === id;
    return { status: 200, data: { ok: true } };
  }

  if (path === "/api/sessions") {
    if (m === "POST") {
      store.todaySession.completed = body?.completed !== false;
      if (body?.durationMinutes != null) store.todaySession.durationMinutes = body.durationMinutes;
      return { status: 200, data: store.todaySession };
    }
    if (m === "PUT") {
      Object.assign(store.todaySession, body ?? {});
      return { status: 200, data: store.todaySession };
    }
    if (m === "DELETE") {
      store.todaySession.completed = false;
      store.todaySets = [];
      return { status: 200, data: { ok: true } };
    }
    const h = liveHistory();
    return { status: 200, data: byDateDesc(inRange(h.sessions, q.from, q.to)) };
  }

  if (path === "/api/session-sets") {
    if (m === "POST") {
      const row = { id: nextId(), userId: DEMO_USER_ID, sessionId: store.todaySession.id, completed: true, ...body };
      store.todaySets.push(row);
      // A new best quietly raises the PR line, like the real app.
      const w = Number(body?.weight);
      if (body?.exerciseId && w > (store.exerciseMaxes[body.exerciseId] ?? 0)) {
        store.exerciseMaxes[body.exerciseId] = w;
      }
      return { status: 200, data: row };
    }
    if (m === "DELETE") {
      store.todaySets = store.todaySets.filter((x) => x.id !== Number(q.id));
      return { status: 200, data: { ok: true } };
    }
    return { status: 200, data: store.todaySets };
  }

  // ── Goals ──
  if (path === "/api/goals") {
    if (m === "POST") {
      const row = { id: nextId(), userId: DEMO_USER_ID, active: true, createdAt: new Date().toISOString(), ...body };
      store.goals.unshift(row);
      return { status: 200, data: row };
    }
    if (m === "PUT") {
      const row = store.goals.find((g) => g.id === Number(body?.id));
      if (row) Object.assign(row, body);
      return { status: 200, data: row ?? { ok: true } };
    }
    if (m === "DELETE") {
      store.goals = store.goals.filter((g) => g.id !== Number(q.id));
      return { status: 200, data: { ok: true } };
    }
    return { status: 200, data: annotatedGoals() };
  }

  // ── Context ──
  if (path === "/api/user-context") {
    if (m === "PUT") {
      store.userContext = { ...store.userContext, ...body, updatedAt: new Date().toISOString() };
      return { status: 200, data: store.userContext };
    }
    return { status: 200, data: store.userContext };
  }

  // ── Journal ──
  if (path === "/api/chat") {
    if (m === "POST") {
      const row = {
        id: nextId(),
        userId: DEMO_USER_ID,
        date: t,
        content: body?.content ?? "",
        source: "user",
        kind: "journal",
        createdAt: new Date().toISOString(),
      };
      store.journal.push(row);
      return { status: 200, data: row };
    }
    if (m === "PUT") {
      const row = store.journal.find((x) => x.id === Number(body?.id));
      if (row && body?.content != null) row.content = body.content;
      return { status: 200, data: row ?? null };
    }
    if (m === "DELETE") {
      store.journal = store.journal.filter((x) => x.id !== Number(q.id));
      return { status: 200, data: { ok: true } };
    }
    let rows = [...store.journal].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (q.q) rows = rows.filter((r) => r.content.toLowerCase().includes(q.q.toLowerCase()));
    return { status: 200, data: rows };
  }

  // ── Family room ──
  if (path === "/api/family/chat/typing") return { status: 200, data: { ok: true } };
  if (path === "/api/family/chat") {
    if (m === "POST") {
      const d = new Date();
      const row = {
        id: nextId(),
        userId: DEMO_USER_ID,
        date: t,
        content: body?.content ?? "",
        createdAt: `${t}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      };
      store.familyChat.push(row);
      if (store.mode !== "solo" && !store.pendingReply) {
        store.pendingReply = {
          dueAt: Date.now() + 3000,
          content: REPLIES[replyIdx++ % REPLIES.length],
        };
      }
      return { status: 200, data: { ...row, authorName: "You" } };
    }
    if (m === "DELETE") {
      const id = Number(q.id);
      store.familyChat = store.familyChat.filter((x) => !(x.id === id && x.userId === DEMO_USER_ID));
      return { status: 200, data: { ok: true } };
    }
    return { status: 200, data: buildFamilyChat() };
  }

  // ── Invites (visual only, nothing leaves the page) ──
  if (path === "/api/invites") {
    if (m === "POST") {
      const token = "demo-" + Math.random().toString(36).slice(2, 10);
      const invite = {
        id: nextId(),
        email: body?.email ?? "them@example.com",
        role: body?.role ?? "member",
        status: "pending",
        invitedByUserId: DEMO_USER_ID,
        createdAt: new Date().toISOString(),
        expiresAt: iso(daysAgo(-14), "12:00"),
        token,
        link: `https://demo.etch/join/${token}`,
      };
      store.invites.unshift(invite);
      return { status: 200, data: { invite, emailDelivered: false } };
    }
    if (m === "DELETE") {
      store.invites = store.invites.filter((i) => i.id !== Number(q.id));
      return { status: 200, data: { ok: true } };
    }
    return { status: 200, data: { invites: store.invites } };
  }

  // ── Reminders ──
  if (path === "/api/reminders") {
    if (m === "POST") {
      const row = { id: nextId(), userId: DEMO_USER_ID, enabled: true, lastFiredAt: null, createdAt: new Date().toISOString(), ...body };
      store.reminders.push(row);
      return { status: 200, data: row };
    }
    if (m === "PUT") {
      const row = store.reminders.find((r) => r.id === Number(body?.id));
      if (row) Object.assign(row, body);
      return { status: 200, data: row ?? { ok: true } };
    }
    if (m === "DELETE") {
      store.reminders = store.reminders.filter((r) => r.id !== Number(q.id));
      return { status: 200, data: { ok: true } };
    }
    return { status: 200, data: store.reminders };
  }

  // Views / notifications: quiet in the demo.
  if (path === "/api/family/views") {
    if (m === "POST") return { status: 200, data: { ok: true } };
    return { status: 200, data: { inbound: [], outbound: [], unreadCount: 0 } };
  }
  if (path === "/api/family/views/read") return { status: 200, data: { ok: true } };

  if (path === "/api/export") {
    return {
      status: 200,
      data: { note: "Demo export — sign up for the real thing.", today: t, journal: store.journal },
    };
  }

  // Benign fallbacks so nothing crashes the demo.
  if (m === "GET") return { status: 200, data: [] };
  return { status: 200, data: { ok: true } };
}
