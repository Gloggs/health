CREATE TABLE IF NOT EXISTS "feelings" (
	"id" serial PRIMARY KEY NOT NULL,
	"family_id" varchar(64) NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"date" date NOT NULL,
	"what" varchar(80) NOT NULL,
	"where_on_body" varchar(60),
	"how_bad" varchar(10),
	"better" text,
	"worse" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "feelings_by_family_user_date" ON "feelings" USING btree ("family_id","user_id","date");