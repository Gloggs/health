// Shared helpers for rendering plan-exercise targets. Cardio moves are
// duration/distance-based; everything else is sets/reps/weight. Both the
// plan editor and the Today session card use this so the format stays
// consistent across surfaces.

export function isCardio(pe) {
  return pe?.muscleGroup === "Cardio";
}

// Returns a leading-separator string like " · 30 min · 5 km" or " · 3 × 8 @ 80kg".
// Empty string when there are no targets set.
export function formatPlanTargets(pe) {
  if (!pe) return "";
  if (isCardio(pe)) {
    const parts = [];
    if (pe.targetDurationMinutes) parts.push(`${pe.targetDurationMinutes} min`);
    if (pe.targetDistanceKm) parts.push(`${pe.targetDistanceKm} km`);
    return parts.length ? ` · ${parts.join(" · ")}` : "";
  }
  if (pe.targetSets || pe.targetReps || pe.targetWeight) {
    let s = ` · ${pe.targetSets ?? "?"} × ${pe.targetReps ?? "?"}`;
    if (pe.targetWeight) s += ` @ ${pe.targetWeight}kg`;
    return s;
  }
  return "";
}
