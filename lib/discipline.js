// Discipline / follow-through scoring.
//
// Formula: showed-up-despite-resistance.
//
//   weekly_score = sum( resistance × completed )  /  sum( resistance )
//
// where:
//   - resistance is 1 (easy), 2 (medium), or 3 (hard) - captured per day
//   - completed is 1 if a workout session was logged for that date, else 0
//   - days flagged intentionalRest are excluded entirely
//   - days with no resistance captured are excluded (no signal to score)
//
// Worked example:
//   Mon: resistance 3, completed → 3
//   Tue: resistance 1, completed → 1
//   Wed: intentional rest        → excluded
//   Thu: resistance 3, skipped   → 0 (out of 3)
//   Fri: resistance 2, completed → 2
//
//   numerator   = 3 + 1 + 0 + 2 = 6
//   denominator = 3 + 1 + 3 + 2 = 9
//   score (0..1) = 0.667
//   score (0..10) = 6.7
//
// Rationale: a workout you dragged yourself through on a hard day counts more
// than one you breezed into on an easy day. Skipped easy days hurt the score
// less than skipped hard ones - which we want, because skipping when nothing
// was in the way is the strongest "didn't show up" signal.

export function computeWeeklyDiscipline(checkIns, sessionDates) {
  let num = 0;
  let denom = 0;
  let scored = 0;

  for (const c of checkIns) {
    if (!c.resistance || c.intentionalRest) continue;
    const completed = sessionDates.has(c.date) ? 1 : 0;
    num += c.resistance * completed;
    denom += c.resistance;
    scored += 1;
  }

  if (denom === 0) return { score01: null, score10: null, scoredDays: 0 };
  const score01 = num / denom;
  return {
    score01,
    score10: Math.round(score01 * 100) / 10,
    scoredDays: scored,
  };
}

// Series of weekly discipline scores. weeks = array of {weekStart, weekEnd, checkIns, sessionDates}.
export function computeDisciplineSeries(weeks) {
  return weeks.map((w) => ({
    weekStart: w.weekStart,
    weekEnd: w.weekEnd,
    ...computeWeeklyDiscipline(w.checkIns, w.sessionDates),
  }));
}
