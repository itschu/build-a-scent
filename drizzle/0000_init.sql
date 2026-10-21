CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('user', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"display_name" text,
	"bio" text,
	"avatar_url" text,
	"phone" text,
	"delivery_address" text,
	"city" text,
	"state" text,
	"seller_available_kobo" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bottle_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"size_label" text NOT NULL,
	"volume_ml" integer NOT NULL,
	"format" text NOT NULL,
	"concentration_pct" integer NOT NULL,
	"base_price_kobo" bigint NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bottle_options_volume_format_unique" UNIQUE("volume_ml","format"),
	CONSTRAINT "bottle_options_format_check" CHECK ("bottle_options"."format" in ('spray', 'roll_on', 'oil')),
	CONSTRAINT "bottle_options_volume_check" CHECK ("bottle_options"."volume_ml" > 0),
	CONSTRAINT "bottle_options_concentration_check" CHECK ("bottle_options"."concentration_pct" between 1 and 100),
	CONSTRAINT "bottle_options_price_check" CHECK ("bottle_options"."base_price_kobo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"note_tier" text NOT NULL,
	"scent_family" text NOT NULL,
	"color_hex" text NOT NULL,
	"price_per_ml_kobo" bigint NOT NULL,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredients_name_unique" UNIQUE("name"),
	CONSTRAINT "ingredients_note_tier_check" CHECK ("ingredients"."note_tier" in ('base', 'heart', 'top')),
	CONSTRAINT "ingredients_color_hex_check" CHECK ("ingredients"."color_hex" ~ '^#[0-9a-fA-F]{6}$'),
	CONSTRAINT "ingredients_price_check" CHECK ("ingredients"."price_per_ml_kobo" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"size_label" text NOT NULL,
	"format" text NOT NULL,
	"price_kobo" bigint NOT NULL,
	"stock_qty" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_format_check" CHECK ("product_variants"."format" in ('spray', 'roll_on', 'oil')),
	CONSTRAINT "product_variants_price_check" CHECK ("product_variants"."price_kobo" >= 0),
	CONSTRAINT "product_variants_stock_check" CHECK ("product_variants"."stock_qty" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"scent_family" text NOT NULL,
	"notes" jsonb DEFAULT '{"base":[],"heart":[],"top":[]}'::jsonb NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "shipping_zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"states" text[] NOT NULL,
	"fee_kobo" bigint NOT NULL,
	"eta_min_days" integer NOT NULL,
	"eta_max_days" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_zones_name_unique" UNIQUE("name"),
	CONSTRAINT "shipping_zones_fee_check" CHECK ("shipping_zones"."fee_kobo" >= 0),
	CONSTRAINT "shipping_zones_eta_check" CHECK ("shipping_zones"."eta_min_days" >= 0 and "shipping_zones"."eta_min_days" <= "shipping_zones"."eta_max_days")
);
--> statement-breakpoint
CREATE TABLE "marketplace_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"saved_scent_id" uuid NOT NULL,
	"seller_id" uuid NOT NULL,
	"bottle_option_id" uuid NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"creator_markup_kobo" bigint NOT NULL,
	"featured_ingredient_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'pending_review' NOT NULL,
	"rejection_reason" text,
	"unavailable_reason" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_listings_status_check" CHECK ("marketplace_listings"."status" in ('pending_review', 'approved', 'rejected', 'unavailable', 'withdrawn')),
	CONSTRAINT "marketplace_listings_markup_check" CHECK ("marketplace_listings"."creator_markup_kobo" > 0),
	CONSTRAINT "marketplace_listings_description_check" CHECK (char_length("marketplace_listings"."description") <= 200),
	CONSTRAINT "marketplace_listings_rejection_reason_check" CHECK ("marketplace_listings"."status" <> 'rejected' or coalesce(btrim("marketplace_listings"."rejection_reason"), '') <> '')
);
--> statement-breakpoint
CREATE TABLE "saved_scents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_scent_id" uuid,
	"name" text,
	"formula" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"formula_hash" text,
	"bottle_option_id" uuid,
	"status" text NOT NULL,
	"current_step" text,
	"is_shared" boolean DEFAULT false NOT NULL,
	"share_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_scents_share_token_unique" UNIQUE("share_token"),
	CONSTRAINT "saved_scents_status_check" CHECK ("saved_scents"."status" in ('draft', 'saved')),
	CONSTRAINT "saved_scents_current_step_check" CHECK ("saved_scents"."current_step" is null or "saved_scents"."current_step" in ('base', 'heart', 'top', 'preview')),
	CONSTRAINT "saved_scents_saved_complete_check" CHECK ("saved_scents"."status" <> 'saved' or ("saved_scents"."name" is not null and "saved_scents"."bottle_option_id" is not null and "saved_scents"."formula_hash" is not null))
);
--> statement-breakpoint
CREATE TABLE "inventory_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_variant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_reservations_status_check" CHECK ("inventory_reservations"."status" in ('active', 'consumed', 'released')),
	CONSTRAINT "inventory_reservations_quantity_check" CHECK ("inventory_reservations"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"item_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"item_snapshot" jsonb NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_kobo" bigint NOT NULL,
	"line_total_kobo" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_type_check" CHECK ("order_items"."item_type" in ('custom_scent', 'standard_product', 'marketplace_listing')),
	CONSTRAINT "order_items_quantity_check" CHECK ("order_items"."quantity" > 0),
	CONSTRAINT "order_items_total_check" CHECK ("order_items"."line_total_kobo" = "order_items"."unit_price_kobo" * "order_items"."quantity")
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"status" text DEFAULT 'pending_payment' NOT NULL,
	"needs_attention" boolean DEFAULT false NOT NULL,
	"attention_reason" text,
	"payment_gateway" text NOT NULL,
	"payment_reference" text,
	"subtotal_kobo" bigint NOT NULL,
	"shipping_fee_kobo" bigint NOT NULL,
	"total_kobo" bigint NOT NULL,
	"currency" text DEFAULT 'NGN' NOT NULL,
	"delivery_address" jsonb NOT NULL,
	"shipping_zone_id" uuid,
	"eta_from" date,
	"eta_to" date,
	"paid_at" timestamp with time zone,
	"refund_reason" text,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number"),
	CONSTRAINT "orders_payment_reference_unique" UNIQUE("payment_reference"),
	CONSTRAINT "orders_status_check" CHECK ("orders"."status" in ('pending_payment', 'verifying_payment', 'payment_failed', 'expired', 'paid', 'in_production', 'shipped', 'fulfilled', 'cancelled', 'refunded')),
	CONSTRAINT "orders_gateway_check" CHECK ("orders"."payment_gateway" in ('paystack', 'flutterwave')),
	CONSTRAINT "orders_currency_check" CHECK ("orders"."currency" = 'NGN'),
	CONSTRAINT "orders_totals_check" CHECK ("orders"."subtotal_kobo" >= 0 and "orders"."shipping_fee_kobo" >= 0 and "orders"."total_kobo" = "orders"."subtotal_kobo" + "orders"."shipping_fee_kobo")
);
--> statement-breakpoint
CREATE TABLE "seller_earnings_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"marketplace_listing_id" uuid NOT NULL,
	"amount_kobo" bigint NOT NULL,
	"entry_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seller_earnings_ledger_item_entry_unique" UNIQUE("order_item_id","entry_type"),
	CONSTRAINT "seller_earnings_ledger_entry_type_check" CHECK ("seller_earnings_ledger"."entry_type" in ('sale_credit', 'refund_debit', 'payout_debit')),
	CONSTRAINT "seller_earnings_ledger_status_check" CHECK ("seller_earnings_ledger"."status" in ('pending', 'available', 'void'))
);
--> statement-breakpoint
CREATE TABLE "email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedupe_key" text NOT NULL,
	"to_email" text NOT NULL,
	"template" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_outbox_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "email_outbox_status_check" CHECK ("email_outbox"."status" in ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"message" text NOT NULL,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_count_check" CHECK ("rate_limits"."count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gateway" text NOT NULL,
	"event_id" text NOT NULL,
	"reference" text,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "webhook_events_gateway_event_unique" UNIQUE("gateway","event_id"),
	CONSTRAINT "webhook_events_gateway_check" CHECK ("webhook_events"."gateway" in ('paystack', 'flutterwave'))
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_saved_scent_id_saved_scents_id_fk" FOREIGN KEY ("saved_scent_id") REFERENCES "public"."saved_scents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_bottle_option_id_bottle_options_id_fk" FOREIGN KEY ("bottle_option_id") REFERENCES "public"."bottle_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_scents" ADD CONSTRAINT "saved_scents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_scents" ADD CONSTRAINT "saved_scents_parent_scent_id_saved_scents_id_fk" FOREIGN KEY ("parent_scent_id") REFERENCES "public"."saved_scents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_scents" ADD CONSTRAINT "saved_scents_bottle_option_id_bottle_options_id_fk" FOREIGN KEY ("bottle_option_id") REFERENCES "public"."bottle_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_product_variant_id_product_variants_id_fk" FOREIGN KEY ("product_variant_id") REFERENCES "public"."product_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_reservations" ADD CONSTRAINT "inventory_reservations_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipping_zone_id_shipping_zones_id_fk" FOREIGN KEY ("shipping_zone_id") REFERENCES "public"."shipping_zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_earnings_ledger" ADD CONSTRAINT "seller_earnings_ledger_seller_id_users_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_earnings_ledger" ADD CONSTRAINT "seller_earnings_ledger_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_earnings_ledger" ADD CONSTRAINT "seller_earnings_ledger_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_earnings_ledger" ADD CONSTRAINT "seller_earnings_ledger_marketplace_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("marketplace_listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "marketplace_listings_saved_scent_unique" ON "marketplace_listings" USING btree ("saved_scent_id");--> statement-breakpoint
CREATE INDEX "marketplace_listings_status_idx" ON "marketplace_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "marketplace_listings_seller_idx" ON "marketplace_listings" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "saved_scents_user_idx" ON "saved_scents" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "saved_scents_formula_hash_idx" ON "saved_scents" USING btree ("formula_hash");--> statement-breakpoint
CREATE INDEX "inventory_reservations_variant_idx" ON "inventory_reservations" USING btree ("product_variant_id","status");--> statement-breakpoint
CREATE INDEX "inventory_reservations_expiry_idx" ON "inventory_reservations" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_needs_attention_idx" ON "orders" USING btree ("needs_attention") WHERE "orders"."needs_attention";--> statement-breakpoint
CREATE INDEX "seller_earnings_ledger_seller_idx" ON "seller_earnings_ledger" USING btree ("seller_id","status");--> statement-breakpoint
CREATE INDEX "email_outbox_due_idx" ON "email_outbox" USING btree ("status","next_attempt_at");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "webhook_events_reference_idx" ON "webhook_events" USING btree ("reference");