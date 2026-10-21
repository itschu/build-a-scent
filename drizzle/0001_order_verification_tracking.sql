ALTER TABLE "orders" ADD COLUMN "verifying_since" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_verify_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "verify_attempts" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "last_gateway_status" text;