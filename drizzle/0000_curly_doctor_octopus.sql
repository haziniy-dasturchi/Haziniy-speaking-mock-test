CREATE TABLE "mocks" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"title" text NOT NULL,
	"level_label" text DEFAULT 'B1–C1' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parts" (
	"id" text PRIMARY KEY NOT NULL,
	"mock_id" text NOT NULL,
	"order" integer NOT NULL,
	"type" text NOT NULL,
	"display_label" text NOT NULL,
	"instruction_text" text NOT NULL,
	"instruction_audio_url" text,
	"instruction_audio_public_id" text,
	"default_prep_seconds" integer NOT NULL,
	"default_answer_seconds" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY NOT NULL,
	"part_id" text NOT NULL,
	"order" integer NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"audio_url" text,
	"audio_public_id" text,
	"image_urls" jsonb DEFAULT '[]'::jsonb,
	"prep_seconds" integer,
	"answer_seconds" integer,
	"topic" text,
	"for_points" jsonb DEFAULT '[]'::jsonb,
	"against_points" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"login" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'teacher' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_login_unique" UNIQUE("login")
);
--> statement-breakpoint
ALTER TABLE "mocks" ADD CONSTRAINT "mocks_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parts" ADD CONSTRAINT "parts_mock_id_mocks_id_fk" FOREIGN KEY ("mock_id") REFERENCES "public"."mocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;