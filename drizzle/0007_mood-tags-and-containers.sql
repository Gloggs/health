ALTER TABLE "mood_logs" ADD COLUMN IF NOT EXISTS "tags" jsonb;--> statement-breakpoint
ALTER TABLE "user_context" ADD COLUMN IF NOT EXISTS "water_containers" jsonb;