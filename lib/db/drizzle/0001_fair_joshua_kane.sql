ALTER TABLE "notifications" ADD COLUMN "sender_role" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "sender_name" text;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "metadata" json;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trial_starts_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "subscription_expires_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_manually_activated" boolean DEFAULT false NOT NULL;