CREATE TABLE "invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" varchar(60) NOT NULL,
	"family_id" varchar(64) NOT NULL,
	"email" varchar(200) NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"invited_by_user_id" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" varchar(64),
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "invites_unique_token" ON "invites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "invites_by_family" ON "invites" USING btree ("family_id");--> statement-breakpoint
CREATE INDEX "invites_by_email" ON "invites" USING btree ("email");