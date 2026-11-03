CREATE TYPE "public"."visibility" AS ENUM('public', 'private');--> statement-breakpoint
CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_used_at" timestamp with time zone,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_authors" (
	"book_id" uuid NOT NULL,
	"author_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_collections" (
	"book_id" uuid NOT NULL,
	"collection_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"description" text,
	"language" text DEFAULT 'en' NOT NULL,
	"publisher" text,
	"published_at" timestamp with time zone,
	"identifier" text,
	"visibility" "visibility" DEFAULT 'public' NOT NULL,
	"cloudinary_public_id" text NOT NULL,
	"cloudinary_resource_type" text DEFAULT 'raw' NOT NULL,
	"mime_type" text DEFAULT 'application/epub+zip' NOT NULL,
	"byte_size" integer,
	"checksum" text,
	"cover_cloudinary_public_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	CONSTRAINT "collections_name_unique" UNIQUE("name"),
	CONSTRAINT "collections_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "reading_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"location" text NOT NULL,
	"percentage" integer,
	"bookmarks" text DEFAULT '[]' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_authors" ADD CONSTRAINT "book_authors_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_authors" ADD CONSTRAINT "book_authors_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_collections" ADD CONSTRAINT "book_collections_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_collections" ADD CONSTRAINT "book_collections_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_token_id_api_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."api_tokens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "book_authors_pair_idx" ON "book_authors" USING btree ("book_id","author_id");--> statement-breakpoint
CREATE UNIQUE INDEX "book_collections_pair_idx" ON "book_collections" USING btree ("book_id","collection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "books_identifier_idx" ON "books" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "books_title_idx" ON "books" USING btree ("title");--> statement-breakpoint
CREATE INDEX "books_visibility_idx" ON "books" USING btree ("visibility");--> statement-breakpoint
CREATE UNIQUE INDEX "reading_progress_token_book_idx" ON "reading_progress" USING btree ("token_id","book_id");