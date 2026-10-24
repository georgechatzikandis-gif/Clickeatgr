ALTER TABLE "orders" ADD COLUMN "estimated_minutes" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "estimated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "order_estimated_minutes_range" CHECK ("orders"."estimated_minutes" is null or "orders"."estimated_minutes" between 1 and 240);