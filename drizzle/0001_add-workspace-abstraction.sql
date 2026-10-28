CREATE TABLE "families" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(60) NOT NULL,
	"owner_user_id" varchar(64) NOT NULL,
	"billing_plan" varchar(20),
	"billing_external_id" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" varchar(64) NOT NULL,
	"family_id" varchar(64) NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memberships_user_id_family_id_pk" PRIMARY KEY("user_id","family_id")
);
--> statement-breakpoint
ALTER TABLE "body_metrics" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "cardio_logs" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "daily_check_ins" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "daily_mini_logs" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "goals" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "meal_logs" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "mood_logs" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "plans" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "plan_days" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "plan_exercises" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "profile_views" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "reminders" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "session_sets" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "sleep_logs" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "user_context" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
ALTER TABLE "water_logs" ADD COLUMN "family_id" varchar(64);--> statement-breakpoint
CREATE INDEX "memberships_by_user" ON "memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "memberships_by_family" ON "memberships" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "body_metrics_by_family_user_date" ON "body_metrics" USING btree ("family_id","user_id","date");--> statement-breakpoint
CREATE INDEX "cardio_logs_by_family_user_date" ON "cardio_logs" USING btree ("family_id","user_id","date");--> statement-breakpoint
CREATE INDEX "chat_messages_by_family_kind_created" ON "chat_messages" USING btree ("family_id","kind","created_at");--> statement-breakpoint
CREATE INDEX "daily_check_ins_by_family_user_date" ON "daily_check_ins" USING btree ("family_id","user_id","date");--> statement-breakpoint
CREATE INDEX "daily_mini_logs_by_family_user_date" ON "daily_mini_logs" USING btree ("family_id","user_id","date");--> statement-breakpoint
CREATE INDEX "goals_by_family_user" ON "goals" USING btree ("family_id","user_id");--> statement-breakpoint
CREATE INDEX "meal_logs_by_family_user_date" ON "meal_logs" USING btree ("family_id","user_id","date");--> statement-breakpoint
CREATE INDEX "mood_logs_by_family_user_date" ON "mood_logs" USING btree ("family_id","user_id","date");--> statement-breakpoint
CREATE INDEX "plans_by_family_user" ON "plans" USING btree ("family_id","user_id");--> statement-breakpoint
CREATE INDEX "plan_days_by_family_user" ON "plan_days" USING btree ("family_id","user_id");--> statement-breakpoint
CREATE INDEX "plan_exercises_by_family_user" ON "plan_exercises" USING btree ("family_id","user_id");--> statement-breakpoint
CREATE INDEX "profile_views_by_family_date" ON "profile_views" USING btree ("family_id","date");--> statement-breakpoint
CREATE INDEX "reminders_by_family_user" ON "reminders" USING btree ("family_id","user_id");--> statement-breakpoint
CREATE INDEX "sessions_by_family_user_date" ON "sessions" USING btree ("family_id","user_id","date");--> statement-breakpoint
CREATE INDEX "session_sets_by_family_user" ON "session_sets" USING btree ("family_id","user_id");--> statement-breakpoint
CREATE INDEX "sleep_logs_by_family_user_date" ON "sleep_logs" USING btree ("family_id","user_id","date");--> statement-breakpoint
CREATE INDEX "user_context_by_family_user" ON "user_context" USING btree ("family_id","user_id");--> statement-breakpoint
CREATE INDEX "water_logs_by_family_user_date" ON "water_logs" USING btree ("family_id","user_id","date");