ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "family_id" varchar(64);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exercises_by_family" ON "exercises" USING btree ("family_id");
--> statement-breakpoint
-- Backfill. Starter exercises keep family_id NULL (shared, read-only).
-- Any other exercise goes to the one family that uses it in a plan or a set.
UPDATE "exercises" e SET "family_id" = used."family_id"
FROM (
  SELECT "exercise_id", MIN("family_id") AS "family_id"
  FROM (
    SELECT "exercise_id", "family_id" FROM "plan_exercises"
    UNION ALL
    SELECT "exercise_id", "family_id" FROM "session_sets"
  ) refs
  GROUP BY "exercise_id"
  HAVING COUNT(DISTINCT "family_id") = 1
) used
WHERE e."id" = used."exercise_id"
  AND e."name" NOT IN (
  'Bench Press',
  'Incline Dumbbell Press',
  'Press-ups',
  'Chest Fly',
  'Deadlift',
  'Pull-ups',
  'Barbell Row',
  'Lat Pulldown',
  'Seated Row',
  'Back Squat',
  'Front Squat',
  'Romanian Deadlift',
  'Leg Press',
  'Walking Lunges',
  'Leg Curl',
  'Calf Raise',
  'Overhead Press',
  'Dumbbell Shoulder Press',
  'Lateral Raise',
  'Face Pull',
  'Barbell Curl',
  'Dumbbell Curl',
  'Hammer Curl',
  'Triceps Pushdown',
  'Overhead Triceps Extension',
  'Dips',
  'Plank',
  'Hanging Knee Raise',
  'Cable Crunch',
  'Treadmill Run',
  'Rowing Machine',
  'Stationary Bike'
);--> statement-breakpoint
-- Unused custom exercises: if there is only one family, they are theirs.
UPDATE "exercises" SET "family_id" = (SELECT "id" FROM "families" LIMIT 1)
WHERE "family_id" IS NULL
  AND (SELECT COUNT(*) FROM "families") = 1
  AND "name" NOT IN (
  'Bench Press',
  'Incline Dumbbell Press',
  'Press-ups',
  'Chest Fly',
  'Deadlift',
  'Pull-ups',
  'Barbell Row',
  'Lat Pulldown',
  'Seated Row',
  'Back Squat',
  'Front Squat',
  'Romanian Deadlift',
  'Leg Press',
  'Walking Lunges',
  'Leg Curl',
  'Calf Raise',
  'Overhead Press',
  'Dumbbell Shoulder Press',
  'Lateral Raise',
  'Face Pull',
  'Barbell Curl',
  'Dumbbell Curl',
  'Hammer Curl',
  'Triceps Pushdown',
  'Overhead Triceps Extension',
  'Dips',
  'Plank',
  'Hanging Knee Raise',
  'Cable Crunch',
  'Treadmill Run',
  'Rowing Machine',
  'Stationary Bike'
);
