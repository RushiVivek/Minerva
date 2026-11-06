CREATE TABLE "kosync_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"document" text NOT NULL,
	"progress" text NOT NULL,
	"percentage" text NOT NULL,
	"device" text NOT NULL,
	"device_id" text,
	"timestamp" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kosync_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"credential_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kosync_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "kosync_progress" ADD CONSTRAINT "kosync_progress_user_id_kosync_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."kosync_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "kosync_progress_user_document_idx" ON "kosync_progress" USING btree ("user_id","document");