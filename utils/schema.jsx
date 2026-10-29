import {
  pgTable,
  serial,
  varchar,
  integer,
  text,
  numeric,
  date,
  boolean,
  timestamp,
  jsonb,
  time,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/pg-core';

// =====================================================================
// WORKSPACE (F1 - Phase B of Milestone 03 - added 2026-05-22)
// =====================================================================
// One row per family/workspace. Each Etch subscription owns a FAMILIES
// row; up to 7 USERS link to it via MEMBERSHIPS. The shift from "1
// hard-coded family via FAMILY_EMAILS" to "N families via FAMILIES rows"
// is what makes Etch SaaS-ready.
//
// id is a string so we can use UUIDs / nanoids and avoid collision across
// regions in the future. Matches USERS.id's varchar(64) shape.
//
// billing_plan / billing_external_id are Stripe-driven once Phase C ships;
// nullable until then so v1 families can exist before Stripe is wired.
export const FAMILIES = pgTable('families', {
  id: varchar('id', { length: 64 }).primaryKey(),
  name: varchar('name', { length: 60 }).notNull(),
  ownerUserId: varchar('owner_user_id', { length: 64 }).notNull(),
  billingPlan: varchar('billing_plan', { length: 20 }), // 'free' | 'solo' | 'family' | 'coach' | null
  billingExternalId: varchar('billing_external_id', { length: 80 }), // Stripe customer/subscription id
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Many-to-many join between USERS and FAMILIES. Composite primary key
// (user_id, family_id) inherently prevents duplicates. v1 supports the
// simple case (one user, one family) but the table is already shaped
// for the multi-family future without a schema change.
//
// role:
//   'owner'  - billing payer + can delete family
//   'admin'  - can invite/remove members
//   'member' - basic access
export const MEMBERSHIPS = pgTable('memberships', {
  userId: varchar('user_id', { length: 64 }).notNull(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.familyId] }),
  byUser: index('memberships_by_user').on(table.userId),
  byFamily: index('memberships_by_family').on(table.familyId),
}));

// Pending / accepted / revoked invites to join a family. Tokens are
// random 32-byte base64url strings (length 43) generated server-side
// in /api/invites POST. The token is the only thing the URL carries -
// /join/<token> -> validates, prompts sign-in if needed, then accepts.
//
// Status is derived from the timestamp columns rather than stored as
// a string, which keeps the truth in one place:
//   - pending  = accepted_at IS NULL AND revoked_at IS NULL AND expires_at > NOW()
//   - accepted = accepted_at IS NOT NULL
//   - revoked  = revoked_at IS NOT NULL
//   - expired  = accepted_at IS NULL AND revoked_at IS NULL AND expires_at <= NOW()
//
// Default expiry is 14 days, set in the API route (not at the DB level)
// so we can tune it without a migration.
//
// `email` is the address the invite was sent to. Stored lowercased so
// case-mismatched Kinde sign-ins still match. Multiple invites to the
// same email + family are allowed (a fresh send after revoke or expiry),
// so there's no unique index on (email, family_id).
export const INVITES = pgTable('invites', {
  id: serial('id').primaryKey(),
  token: varchar('token', { length: 60 }).notNull(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  email: varchar('email', { length: 200 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'), // 'member' | 'admin'
  invitedByUserId: varchar('invited_by_user_id', { length: 64 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  acceptedByUserId: varchar('accepted_by_user_id', { length: 64 }),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniqueToken: uniqueIndex('invites_unique_token').on(table.token),
  byFamily: index('invites_by_family').on(table.familyId),
  byEmail: index('invites_by_email').on(table.email),
}));

// =====================================================================
// FAMILY (multi-tenant foundation - added 2026-05-18)
// =====================================================================
// One row per signed-in family member, keyed by Kinde sub.
// `visibility` is a jsonb blob of boolean toggles controlling what other
// family members can see when they view this user's profile.
// Default visibility (when null): every section ON except chat (always
// private, never togglable).
export const USERS = pgTable('users', {
  id: varchar('id', { length: 64 }).primaryKey(), // Kinde sub (e.g. "kp_abc123")
  email: varchar('email', { length: 200 }).notNull(),
  displayName: varchar('display_name', { length: 60 }),
  // Store DOB rather than age - age is then accurate forever without
  // anyone having to remember to bump it on their birthday. Computed
  // on read via lib/age.js so consumers see both fields.
  dateOfBirth: date('date_of_birth'),
  heightCm: numeric('height_cm', { precision: 5, scale: 1 }),
  // { body, age, height, sleep, mood, cardio, meals, workouts } booleans
  visibility: jsonb('visibility'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
  // Family-chat typing indicator. Client POSTs to /api/family/chat/typing
  // on debounced keystroke, bumping this to NOW() + ~5s. The chat GET
  // surfaces every user whose typing_until is still in the future as
  // an active typer. Null when not currently typing.
  typingUntil: timestamp('typing_until', { withTimezone: true }),
});

// One row per (viewer, viewee, day) - unique constraint prevents the same
// person triggering multiple pings to you per day no matter how many
// pages of yours they browse. Created on first view of the day.
export const PROFILE_VIEWS = pgTable('profile_views', {
  id: serial('id').primaryKey(),
  // F1: tenant column (NOT NULL as of Phase B.2 after backfill)
  familyId: varchar('family_id', { length: 64 }).notNull(),
  viewerId: varchar('viewer_id', { length: 64 }).notNull(),
  vieweeId: varchar('viewee_id', { length: 64 }).notNull(),
  date: date('date').notNull(),
  // Read-state: when the viewee opens their notifications, we flip this
  // so the bell badge clears. Null = unread.
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  uniquePerDay: uniqueIndex('profile_views_unique_per_day').on(
    table.viewerId,
    table.vieweeId,
    table.date
  ),
  byViewee: index('profile_views_by_viewee').on(table.vieweeId, table.date),
  byViewer: index('profile_views_by_viewer').on(table.viewerId, table.date),
  byFamilyDate: index('profile_views_by_family_date').on(table.familyId, table.date),
}));

// =====================================================================
// WORKOUTS (existing — kept intact for the Train tab)
// =====================================================================

// Exercise library: every move you can program into a plan
// family_id NULL = starter exercise, shared by every family and read-only.
// family_id set = an exercise that family added; only they see or change it.
export const EXERCISES = pgTable('exercises', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }),
  name: varchar('name', { length: 80 }).notNull(),
  muscleGroup: varchar('muscle_group', { length: 30 }).notNull(),
  equipment: varchar('equipment', { length: 30 }).notNull().default('Bodyweight'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byFamily: index('exercises_by_family').on(table.familyId),
}));

// Plans: named training routines (e.g. "PPL", "Upper/Lower")
// `repeatWeekly` controls whether the plan carries over week-to-week or is a
// one-off block. One-off plans are hidden from the Today screen once the
// `activatedAt` mark is more than 7 days in the past.
//
// `userId` (nullable during the multi-tenant migration; will become NOT NULL
// after backfill) scopes each plan to one family member. Plans are not shared
// - everyone gets their own routine.
export const PLANS = pgTable('plans', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  name: varchar('name', { length: 60 }).notNull(),
  description: text('description'),
  isActive: boolean('is_active').notNull().default(false),
  repeatWeekly: boolean('repeat_weekly').notNull().default(true),
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUser: index('plans_by_user').on(table.userId),
  byFamilyUser: index('plans_by_family_user').on(table.familyId, table.userId),
}));

// Plan day slot: one per day-of-week (0=Mon..6=Sun) per plan.
// userId is denormalised from the parent plan so day-level queries don't
// need a join to filter by owner.
export const PLAN_DAYS = pgTable('plan_days', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  planId: integer('plan_id').notNull(),
  dayIndex: integer('day_index').notNull(),
  label: varchar('label', { length: 40 }).notNull().default('Rest'),
}, (table) => ({
  byUser: index('plan_days_by_user').on(table.userId),
  byFamilyUser: index('plan_days_by_family_user').on(table.familyId, table.userId),
}));

// Exercise programmed into a plan day. Strength moves use targetSets/Reps/Weight;
// cardio moves use targetDurationMinutes/DistanceKm. Both kept nullable so the
// existing strength shape isn't disturbed.
export const PLAN_EXERCISES = pgTable('plan_exercises', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  planDayId: integer('plan_day_id').notNull(),
  exerciseId: integer('exercise_id').notNull(),
  position: integer('position').notNull().default(0),
  targetSets: integer('target_sets'),
  targetReps: integer('target_reps'),
  targetWeight: numeric('target_weight', { precision: 6, scale: 2 }),
  targetDurationMinutes: integer('target_duration_minutes'),
  targetDistanceKm: numeric('target_distance_km', { precision: 6, scale: 2 }),
  notes: text('notes'),
}, (table) => ({
  byUser: index('plan_exercises_by_user').on(table.userId),
  byFamilyUser: index('plan_exercises_by_family_user').on(table.familyId, table.userId),
}));

// A logged training session
export const SESSIONS = pgTable('sessions', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  date: date('date').notNull(),
  planDayId: integer('plan_day_id'),
  completed: boolean('completed').notNull().default(false),
  durationMinutes: integer('duration_minutes'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUserDate: index('sessions_by_user_date').on(table.userId, table.date),
  byFamilyUserDate: index('sessions_by_family_user_date').on(table.familyId, table.userId, table.date),
}));

// Optional per-set detail for a session exercise.
export const SESSION_SETS = pgTable('session_sets', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  sessionId: integer('session_id').notNull(),
  exerciseId: integer('exercise_id').notNull(),
  setNumber: integer('set_number').notNull(),
  reps: integer('reps'),
  weight: numeric('weight', { precision: 6, scale: 2 }),
  completed: boolean('completed').notNull().default(true),
}, (table) => ({
  byUser: index('session_sets_by_user').on(table.userId),
  byFamilyUser: index('session_sets_by_family_user').on(table.familyId, table.userId),
}));

// =====================================================================
// HEALTH MODULES (new)
// =====================================================================

// Sleep: one row per night. `date` = the morning you woke up.
export const SLEEP_LOGS = pgTable('sleep_logs', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  date: date('date').notNull(),
  bedtime: time('bedtime'),
  wakeTime: time('wake_time'),
  hours: numeric('hours', { precision: 4, scale: 2 }),
  quality: integer('quality'), // 1..5
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUserDate: index('sleep_logs_by_user_date').on(table.userId, table.date),
  byFamilyUserDate: index('sleep_logs_by_family_user_date').on(table.familyId, table.userId, table.date),
}));

// Water: tap-to-add entries. Aggregated per day in the UI.
export const WATER_LOGS = pgTable('water_logs', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  date: date('date').notNull(),
  amountMl: integer('amount_ml').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUserDate: index('water_logs_by_user_date').on(table.userId, table.date),
  byFamilyUserDate: index('water_logs_by_family_user_date').on(table.familyId, table.userId, table.date),
}));

// Mood + energy: one row per day.
export const MOOD_LOGS = pgTable('mood_logs', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  date: date('date').notNull(),
  mood: integer('mood'), // 1..5
  energy: integer('energy'), // 1..5
  tags: jsonb('tags'), // short labels such as "Training" (lib/usuals.js normaliseTags)
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUserDate: index('mood_logs_by_user_date').on(table.userId, table.date),
  byFamilyUserDate: index('mood_logs_by_family_user_date').on(table.familyId, table.userId, table.date),
}));

// Body metrics: weight + optional measurements. Weekly preferred.
export const BODY_METRICS = pgTable('body_metrics', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  date: date('date').notNull(),
  weightKg: numeric('weight_kg', { precision: 5, scale: 2 }),
  waistCm: numeric('waist_cm', { precision: 5, scale: 1 }),
  chestCm: numeric('chest_cm', { precision: 5, scale: 1 }),
  armsCm: numeric('arms_cm', { precision: 5, scale: 1 }),
  hipsCm: numeric('hips_cm', { precision: 5, scale: 1 }),
  thighsCm: numeric('thighs_cm', { precision: 5, scale: 1 }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUserDate: index('body_metrics_by_user_date').on(table.userId, table.date),
  byFamilyUserDate: index('body_metrics_by_family_user_date').on(table.familyId, table.userId, table.date),
}));

// Meals: per-slot daily logging. Designed for very low friction —
// description is optional, only `quality` is needed to flag junk vs healthy.
//   slot: 'breakfast' | 'lunch' | 'dinner' | 'snack'
//   quality: 1=junk, 2=mixed, 3=healthy   (3-step Likert keeps the choice quick)
// Multiple rows per slot per day are allowed (e.g. two snacks).
export const MEAL_LOGS = pgTable('meal_logs', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  date: date('date').notNull(),
  slot: varchar('slot', { length: 12 }).notNull(),
  description: text('description'),
  quality: integer('quality'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUserDate: index('meal_logs_by_user_date').on(table.userId, table.date),
  byFamilyUserDate: index('meal_logs_by_family_user_date').on(table.familyId, table.userId, table.date),
}));

// Cardio: walks, runs, cycles, etc.
export const CARDIO_LOGS = pgTable('cardio_logs', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  date: date('date').notNull(),
  type: varchar('type', { length: 30 }).notNull().default('Walk'),
  durationMinutes: integer('duration_minutes'),
  distanceKm: numeric('distance_km', { precision: 6, scale: 2 }),
  steps: integer('steps'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUserDate: index('cardio_logs_by_user_date').on(table.userId, table.date),
  byFamilyUserDate: index('cardio_logs_by_family_user_date').on(table.familyId, table.userId, table.date),
}));

// =====================================================================
// CHAT + JOURNAL
// =====================================================================

// Two flavours of chat message, both live in this table and are
// distinguished by the `kind` column:
//
//   kind='journal'  - per-user private journal. Always scoped by user_id;
//                     never returned to anyone but the author. Legacy
//                     `redacted` + `tags` columns kept for old rows
//                     (Claude is gone but the columns are harmless).
//   kind='family'   - shared family room. All family members read + write
//                     the same stream; user_id stamps the author.
//
// The default is 'journal' so existing rows (and any client that hasn't
// learned about the column yet) keep behaving the way they always have.
// Phase 3 introduces the family-room surface that uses kind='family'.
export const CHAT_MESSAGES = pgTable('chat_messages', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  date: date('date').notNull(),
  content: text('content').notNull(),
  source: varchar('source', { length: 20 }).notNull().default('user'), // 'user' | 'check_in'
  tags: jsonb('tags'), // legacy - reserved for batch parsing that never landed
  redacted: boolean('redacted').notNull().default(false), // legacy Claude-redact flag
  kind: varchar('kind', { length: 10 }).notNull().default('journal'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUserDate: index('chat_messages_by_user_date').on(table.userId, table.date),
  byKindCreated: index('chat_messages_by_kind_created').on(table.kind, table.createdAt),
  byFamilyKindCreated: index('chat_messages_by_family_kind_created').on(table.familyId, table.kind, table.createdAt),
}));

// Daily resistance / follow-through capture. One row per day.
// resistance: 1=easy, 2=med, 3=hard (kept 1..3 for honest answers).
// closedAt: timestamp the user tapped "Close today" - the ritual moment
//   from UX-PATTERNS §5. Null = day still open. Used for the close-day
//   streak metric and to short-circuit the nightly prompt once tapped.
export const DAILY_CHECK_INS = pgTable('daily_check_ins', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  date: date('date').notNull(),
  resistance: integer('resistance'), // 1..3
  followThroughScore: numeric('follow_through_score', { precision: 4, scale: 2 }), // 0..1 or 0..10 (we'll pick a convention in the scoring layer)
  intentionalRest: boolean('intentional_rest').notNull().default(false),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUserDate: index('daily_check_ins_by_user_date').on(table.userId, table.date),
  byFamilyUserDate: index('daily_check_ins_by_family_user_date').on(table.familyId, table.userId, table.date),
}));

// (WEEKLY_SUMMARIES + AI insights surface removed 2026-05-18. Trends page
// now carries the visual-pattern duty. Run db:push after pulling this
// commit to drop the weekly_summaries table.)

// Per-user coaching context + preferences. After the multi-tenant migration
// there is one row per family member instead of one row globally.
// `chatRetentionDays`: if set, chat entries older than N days are auto-purged
// on every chat read. 0/null = retain forever.
// `waterTargetMl`: daily water goal in ml. Null = 2500ml default.
// `miniExercises`: configurable Daily 4 slots, shape [{key,label,target?}]
// capped at 4. Null = use code defaults.
// `personality`: UX-PATTERNS §"3-preset Personality system" - one of
//   'calm' | 'steady' | 'warm'. Null = use 'steady' (default for new
//   accounts). Tunes etch animation duration, haptic intensity, close-day
//   prompt timing and family-chorus volume. See lib/personality.js for the
//   single source of truth on what each preset does.
export const USER_CONTEXT = pgTable('user_context', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  goals: text('goals'),
  // `restrictions` covers both diet/lifestyle limits AND injuries (the UI
  // labels the field "Restrictions / injuries"). We previously had a
  // separate `injuriesNotes` column that no UI wrote to - dropped to keep
  // the schema honest with the form.
  restrictions: text('restrictions'),
  preferences: text('preferences'),
  chatRetentionDays: integer('chat_retention_days'),
  waterTargetMl: integer('water_target_ml'),
  waterContainers: jsonb('water_containers'), // [{ name, ml }] (lib/usuals.js normaliseContainers)
  miniExercises: jsonb('mini_exercises'),
  personality: varchar('personality', { length: 10 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUser: uniqueIndex('user_context_by_user').on(table.userId),
  byFamilyUser: index('user_context_by_family_user').on(table.familyId, table.userId),
}));

// Daily Mini ("Daily 4"): a fixed-slot daily-rep counter for press-ups,
// squats, sit-ups, jumping jacks (configurable in user_context). One row
// per (user, date, slot). Counts > 0 feed the activity streak on Today.
export const DAILY_MINI_LOGS = pgTable('daily_mini_logs', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  date: date('date').notNull(),
  slot: integer('slot').notNull(), // 0..3 - position in the user's 4-slot grid
  count: integer('count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUserDate: index('daily_mini_logs_by_user_date').on(table.userId, table.date),
  byFamilyUserDate: index('daily_mini_logs_by_family_user_date').on(table.familyId, table.userId, table.date),
}));

// =====================================================================
// REMINDERS (v1: UI + storage only; no delivery yet)
// =====================================================================

// =====================================================================
// STRUCTURED GOALS (free-text Coach goals stay in user_context; this is
// for measurable goals with progress bars)
// =====================================================================
//
// kind:
//   'lift'       — best weight for a single exercise; progress from SESSION_SETS.weight
//   'weight'     — body weight target; progress from BODY_METRICS.weightKg
//   'junk-limit' — max junk meals/week (lower is better); progress from MEAL_LOGS this week
//   'custom'     — no auto-progress; just a written intention
export const GOALS = pgTable('goals', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  kind: varchar('kind', { length: 20 }).notNull(),
  exerciseId: integer('exercise_id'), // nullable; only for kind='lift'
  targetValue: numeric('target_value', { precision: 7, scale: 2 }),
  targetUnit: varchar('target_unit', { length: 10 }),
  targetDate: date('target_date'),
  description: varchar('description', { length: 120 }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUser: index('goals_by_user').on(table.userId),
  byFamilyUser: index('goals_by_family_user').on(table.familyId, table.userId),
}));

export const REMINDERS = pgTable('reminders', {
  id: serial('id').primaryKey(),
  familyId: varchar('family_id', { length: 64 }).notNull(),
  userId: varchar('user_id', { length: 64 }),
  kind: varchar('kind', { length: 30 }).notNull(), // 'water'|'meal'|'workout'|'walk'|'weighin'|'winddown'|'supplement'
  label: varchar('label', { length: 80 }).notNull(),
  schedule: varchar('schedule', { length: 80 }), // human-readable: "every 2h 09:00-21:00", "daily 21:30", "Mon Wed Fri 18:00"
  channel: varchar('channel', { length: 20 }).notNull().default('push'), // 'push'|'calendar'|'both'
  enabled: boolean('enabled').notNull().default(true),
  quietOnRest: boolean('quiet_on_rest').notNull().default(false),
  lastFiredAt: timestamp('last_fired_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  byUser: index('reminders_by_user').on(table.userId),
  byFamilyUser: index('reminders_by_family_user').on(table.familyId, table.userId),
}));
