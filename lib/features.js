/**
 * Feature switches, set in code so every copy of health behaves the same way.
 *
 * FAMILY_SHARING (off since 6 November 2026): health is a personal app for one person. With it off,
 * nobody can see anyone else's data at all: no family page, no family chat, no invites, no viewing
 * another person. Each account gets its own private space behind the scenes, which is how the
 * database keeps every person's rows apart. The family code is still in the repo until it is removed.
 */
export const FAMILY_SHARING = false;

/** Paths that only exist for family sharing. Blocked by middleware.js while FAMILY_SHARING is off. */
export const FAMILY_ONLY_PATHS = [
  "/dashboard/family",
  "/dashboard/chat",
  "/demo/family",
  "/demo/chat",
  "/join",
  "/api/family/activity",
  "/api/family/chat",
  "/api/family/leave",
  "/api/family/members",
  "/api/family/views",
  "/api/invites",
];

/** True when this path belongs to family sharing. /api/family itself (the roster) is included; /api/family/create is not. */
export function isFamilyOnlyPath(path) {
  if (path === "/api/family") return true;
  return FAMILY_ONLY_PATHS.some((p) => path === p || path.startsWith(p + "/"));
}
