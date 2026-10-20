CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"kind" text DEFAULT 'image' NOT NULL,
	"mime_type" text NOT NULL,
	"filename" text,
	"byte_size" integer DEFAULT 0 NOT NULL,
	"data" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
