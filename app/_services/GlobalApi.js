'use client';

import axios from 'axios';

// Defeat browser caching on every GET to /api/* so writes followed by
// reads always see fresh data (notable example: rename a plan day, then
// re-fetch the plan).
axios.interceptors.request.use((config) => {
  if ((config.method ?? 'get').toLowerCase() === 'get' && config.url?.startsWith('/api/')) {
    config.headers = { ...(config.headers ?? {}), 'Cache-Control': 'no-cache' };
  }
  return config;
});

function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  });
  const q = search.toString();
  return q ? '?' + q : '';
}

// =====================================================================
// Workouts (existing)
// =====================================================================
const ListExercises = () => axios.get('/api/exercises');
const CreateExercise = (data) => axios.post('/api/exercises', data);
const UpdateExercise = (data) => axios.put('/api/exercises', data);
const DeleteExercise = (id) => axios.delete('/api/exercises?id=' + id);

const ListPlans = () => axios.get('/api/plans');
const GetPlan = (id) => axios.get('/api/plans/' + id);
const CreatePlan = (data) => axios.post('/api/plans', data);
const UpdatePlan = (data) => axios.put('/api/plans', data);
const DeletePlan = (id) => axios.delete('/api/plans?id=' + id);
const ActivatePlan = (id) => axios.post('/api/plans/' + id + '/activate');

const UpsertPlanDay = (data) => axios.put('/api/plan-days', data);
const AddPlanExercise = (data) => axios.post('/api/plan-exercises', data);
const UpdatePlanExercise = (data) => axios.put('/api/plan-exercises', data);
const RemovePlanExercise = (id) => axios.delete('/api/plan-exercises?id=' + id);

const GetSessions = (params = {}) => axios.get('/api/sessions' + qs(params));
const GetTodaySession = () => axios.get('/api/sessions/today');
const CompleteSession = (data) => axios.post('/api/sessions', data);
const UpdateSession = (data) => axios.put('/api/sessions', data);
const DeleteSession = (id) => axios.delete('/api/sessions?id=' + id);

const LogSet = (data) => axios.post('/api/session-sets', data);
const RemoveSet = (id) => axios.delete('/api/session-sets?id=' + id);

// =====================================================================
// Health modules
// =====================================================================
const GetSleep = (params = {}) => axios.get('/api/sleep' + qs(params));
const SaveSleep = (data) => axios.post('/api/sleep', data);
const DeleteSleep = (id) => axios.delete('/api/sleep?id=' + id);

const GetWater = (params = {}) => axios.get('/api/water' + qs(params));
const AddWater = (data) => axios.post('/api/water', data);
const DeleteWater = (id) => axios.delete('/api/water?id=' + id);

const GetMood = (params = {}) => axios.get('/api/mood' + qs(params));
const SaveMood = (data) => axios.post('/api/mood', data);
const DeleteMood = (id) => axios.delete('/api/mood?id=' + id);

const GetBody = (params = {}) => axios.get('/api/body-metrics' + qs(params));
const SaveBody = (data) => axios.post('/api/body-metrics', data);
const DeleteBody = (id) => axios.delete('/api/body-metrics?id=' + id);

const GetCardio = (params = {}) => axios.get('/api/cardio' + qs(params));
const AddCardio = (data) => axios.post('/api/cardio', data);
const UpdateCardio = (data) => axios.put('/api/cardio', data);
const DeleteCardio = (id) => axios.delete('/api/cardio?id=' + id);

const GetMeals = (params = {}) => axios.get('/api/meals' + qs(params));
const SaveMeal = (data) => axios.post('/api/meals', data);
const UpdateMeal = (data) => axios.put('/api/meals', data);
const DeleteMeal = (id) => axios.delete('/api/meals?id=' + id);

const GetMini = (params = {}) => axios.get('/api/mini' + qs(params));
const SaveMini = (data) => axios.post('/api/mini', data); // upserts on (date, slot)
const ClearMiniSlot = (date, slot) => axios.delete(`/api/mini?date=${date}&slot=${slot}`);

// =====================================================================
// Chat + check-ins
// =====================================================================
const GetChat = (params = {}) => axios.get('/api/chat' + qs(params));
const PostChat = (data) => axios.post('/api/chat', data);
const UpdateChat = (data) => axios.put('/api/chat', data);
const DeleteChat = (id) => axios.delete('/api/chat?id=' + id);

// Shared family room - separate endpoint from /api/chat (which is the
// per-user journal). GET returns { messages, typing }. POST creates a
// message; DELETE removes own. SetTypingIndicator bumps the user's
// typing_until on debounced keystroke so siblings see "X is typing..."
// next poll.
const GetFamilyChat = (params = {}) => axios.get('/api/family/chat' + qs(params));
const PostFamilyChat = (data) => axios.post('/api/family/chat', data);
const DeleteFamilyChat = (id) => axios.delete('/api/family/chat?id=' + id);
const SetTypingIndicator = () => axios.post('/api/family/chat/typing');

const GetCheckIn = (params = {}) => axios.get('/api/check-ins' + qs(params));
const SaveCheckIn = (data) => axios.post('/api/check-ins', data);
const DeleteCheckIn = (id) => axios.delete('/api/check-ins?id=' + id);

// =====================================================================
// Insights, reminders, context, export
// =====================================================================
const GetUserContext = () => axios.get('/api/user-context');
const SaveUserContext = (data) => axios.put('/api/user-context', data);

// Own profile (name, age, height, visibility). Auto-creates the row on first GET.
const GetMe = () => axios.get('/api/users/me');
const UpdateMe = (data) => axios.put('/api/users/me', data);

// Onboarding / family creation
const CreateFamily = (data) => axios.post('/api/family/create', data);

// Per-member role + remove. Owner-only for role changes; owner/admin for
// removing members (admin can't remove other admins). Self-leave goes via
// LeaveFamily so the server can apply the "owner must transfer first" rule.
const SetMemberRole = (userId, role) =>
  axios.patch('/api/family/members/' + encodeURIComponent(userId), { role });
const RemoveMember = (userId) =>
  axios.delete('/api/family/members/' + encodeURIComponent(userId));
const LeaveFamily = () => axios.post('/api/family/leave');

// Invites - owner/admin only for create/list/revoke. /join/[token] flow
// uses the validate + accept endpoints which are open to any authed user.
const ListInvites = () => axios.get('/api/invites');
const CreateInvite = (data) => axios.post('/api/invites', data);
const RevokeInvite = (id) => axios.delete('/api/invites?id=' + id);
const ValidateInvite = (token) =>
  axios.get('/api/invites/' + encodeURIComponent(token));
const AcceptInvite = (token) =>
  axios.post('/api/invites/' + encodeURIComponent(token) + '/accept');

// Same endpoint, but with ?viewing= - returns the viewee's profile with
// visibility-filtered age/height. Used by the ViewingBanner.
const GetMeViewing = (viewingId) =>
  axios.get('/api/users/me?viewing=' + encodeURIComponent(viewingId));

// Family roster + per-member motivation strip (streak, week workouts,
// today's mini-rep total). Powers /dashboard/family.
const GetFamily = () => axios.get('/api/family');

// Record that the viewer opened a family member's profile today. Server
// enforces one row per (viewer, viewee, date) - calling this on every
// /dashboard?viewing= mount is safe.
const PingProfileView = (vieweeId) =>
  axios.post('/api/family/views', { vieweeId });

// Notification surface: inbound (others -> me), outbound (me -> others),
// plus unreadCount for the bell badge.
const GetFamilyViews = (params = {}) => axios.get('/api/family/views' + qs(params));
const MarkViewsRead = () => axios.post('/api/family/views/read');

// Unified activity stream across the whole family, filtered by each
// member's visibility flags. Powers the feed on /dashboard/family.
const GetFamilyActivity = (params = {}) =>
  axios.get('/api/family/activity' + qs(params));

const GetReminders = () => axios.get('/api/reminders');
const CreateReminder = (data) => axios.post('/api/reminders', data);
const UpdateReminder = (data) => axios.put('/api/reminders', data);
const DeleteReminder = (id) => axios.delete('/api/reminders?id=' + id);

const ListGoals = () => axios.get('/api/goals');
const CreateGoal = (data) => axios.post('/api/goals', data);
const UpdateGoal = (data) => axios.put('/api/goals', data);
const DeleteGoal = (id) => axios.delete('/api/goals?id=' + id);

const ExportAll = () => axios.get('/api/export');

export default {
  // workouts
  ListExercises, CreateExercise, UpdateExercise, DeleteExercise,
  ListPlans, GetPlan, CreatePlan, UpdatePlan, DeletePlan, ActivatePlan,
  UpsertPlanDay, AddPlanExercise, UpdatePlanExercise, RemovePlanExercise,
  GetSessions, GetTodaySession, CompleteSession, UpdateSession, DeleteSession,
  LogSet, RemoveSet,
  // health modules
  GetSleep, SaveSleep, DeleteSleep,
  GetWater, AddWater, DeleteWater,
  GetMood, SaveMood, DeleteMood,
  GetBody, SaveBody, DeleteBody,
  GetCardio, AddCardio, UpdateCardio, DeleteCardio,
  GetMeals, SaveMeal, UpdateMeal, DeleteMeal,
  GetMini, SaveMini, ClearMiniSlot,
  // chat + check-ins
  GetChat, PostChat, UpdateChat, DeleteChat,
  GetFamilyChat, PostFamilyChat, DeleteFamilyChat, SetTypingIndicator,
  GetCheckIn, SaveCheckIn, DeleteCheckIn,
  // insights, reminders, context, export
  GetUserContext, SaveUserContext,
  GetMe, UpdateMe, GetMeViewing,
  CreateFamily,
  SetMemberRole, RemoveMember, LeaveFamily,
  ListInvites, CreateInvite, RevokeInvite, ValidateInvite, AcceptInvite,
  GetFamily, PingProfileView, GetFamilyViews, MarkViewsRead, GetFamilyActivity,
  GetReminders, CreateReminder, UpdateReminder, DeleteReminder,
  ListGoals, CreateGoal, UpdateGoal, DeleteGoal,
  ExportAll,
};
