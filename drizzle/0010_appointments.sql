CREATE TABLE IF NOT EXISTS "appointments" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"date" date,
	"questions" text,
	"medicines" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_one_per_user" ON "appointments" USING btree ("family_id","user_id");