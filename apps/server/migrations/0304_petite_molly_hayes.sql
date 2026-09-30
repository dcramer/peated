CREATE TYPE "public"."auction_lot_state" AS ENUM('upcoming', 'live', 'aftersale', 'closed', 'withdrawn', 'unknown');
CREATE TYPE "public"."auction_match_status" AS ENUM('pending', 'matched', 'review', 'ignored');
CREATE TYPE "public"."auction_outcome" AS ENUM('sold', 'unsold', 'cancelled', 'unknown');
CREATE TYPE "public"."auction_price_kind" AS ENUM('hammer', 'aftersale');
ALTER TYPE "public"."notification_type" ADD VALUE 'auction_available';
CREATE TABLE "auction_alert" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"lot_id" bigint NOT NULL,
	"bottle_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "auction_lot_result" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"lot_id" bigint NOT NULL,
	"outcome" "auction_outcome" NOT NULL,
	"amount" bigint,
	"currency" text,
	"price_kind" "auction_price_kind",
	"sold_at" timestamp with time zone,
	"price_note" text,
	"source_url" text NOT NULL,
	"observed_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auction_lot_result_price_check" CHECK (("auction_lot_result"."amount" IS NULL AND "auction_lot_result"."currency" IS NULL AND "auction_lot_result"."price_kind" IS NULL) OR ("auction_lot_result"."outcome" = 'sold' AND "auction_lot_result"."amount" > 0 AND "auction_lot_result"."currency" IN ('gbp','usd','eur') AND "auction_lot_result"."price_kind" IS NOT NULL)),
	CONSTRAINT "auction_lot_result_time_check" CHECK ("auction_lot_result"."sold_at" IS NULL OR "auction_lot_result"."outcome" = 'sold')
);

CREATE TABLE "auction_lot" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"auction_id" bigint NOT NULL,
	"source_key" text NOT NULL,
	"lot_number" text,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"image_url" text,
	"volume" integer,
	"condition" text,
	"source_bottle_identity" jsonb,
	"source_fingerprint" text NOT NULL,
	"bottle_id" bigint,
	"match_status" "auction_match_status" DEFAULT 'pending' NOT NULL,
	"match_check_id" bigint,
	"matched_by_id" bigint,
	"matched_at" timestamp with time zone,
	"available_since" timestamp with time zone,
	"state" "auction_lot_state" DEFAULT 'unknown' NOT NULL,
	"ends_at" timestamp with time zone,
	"current_bid" bigint,
	"bid_currency" text,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"last_checked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "auction_lot_volume_check" CHECK ("auction_lot"."volume" IS NULL OR "auction_lot"."volume" > 0),
	CONSTRAINT "auction_lot_bid_check" CHECK (("auction_lot"."current_bid" IS NULL AND "auction_lot"."bid_currency" IS NULL) OR ("auction_lot"."current_bid" > 0 AND "auction_lot"."bid_currency" IN ('gbp','usd','eur'))),
	CONSTRAINT "auction_lot_match_check" CHECK (("auction_lot"."bottle_id" IS NOT NULL) = ("auction_lot"."match_status" = 'matched'))
);

CREATE TABLE "auction_watch" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"bottle_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "auction" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"external_site_id" bigint NOT NULL,
	"source_key" text NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone NOT NULL
);

ALTER TABLE "auction_alert" ADD CONSTRAINT "auction_alert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "auction_alert" ADD CONSTRAINT "auction_alert_lot_id_auction_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."auction_lot"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auction_alert" ADD CONSTRAINT "auction_alert_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auction_lot_result" ADD CONSTRAINT "auction_lot_result_lot_id_auction_lot_id_fk" FOREIGN KEY ("lot_id") REFERENCES "public"."auction_lot"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auction_lot" ADD CONSTRAINT "auction_lot_auction_id_auction_id_fk" FOREIGN KEY ("auction_id") REFERENCES "public"."auction"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auction_lot" ADD CONSTRAINT "auction_lot_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auction_lot" ADD CONSTRAINT "auction_lot_match_check_id_bottle_check_id_fk" FOREIGN KEY ("match_check_id") REFERENCES "public"."bottle_check"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auction_lot" ADD CONSTRAINT "auction_lot_matched_by_id_user_id_fk" FOREIGN KEY ("matched_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "auction_watch" ADD CONSTRAINT "auction_watch_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "auction_watch" ADD CONSTRAINT "auction_watch_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "auction" ADD CONSTRAINT "auction_external_site_id_external_site_id_fk" FOREIGN KEY ("external_site_id") REFERENCES "public"."external_site"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "auction_alert_user_lot_unq" ON "auction_alert" USING btree ("user_id","lot_id");
CREATE INDEX "auction_lot_result_latest_idx" ON "auction_lot_result" USING btree ("lot_id","id");
CREATE UNIQUE INDEX "auction_lot_result_observation_unq" ON "auction_lot_result" USING btree ("lot_id","observed_at");
CREATE UNIQUE INDEX "auction_lot_occurrence_unq" ON "auction_lot" USING btree ("auction_id","source_key");
CREATE INDEX "auction_lot_bottle_idx" ON "auction_lot" USING btree ("bottle_id");
CREATE INDEX "auction_lot_state_end_idx" ON "auction_lot" USING btree ("state","ends_at");
CREATE UNIQUE INDEX "auction_watch_user_bottle_unq" ON "auction_watch" USING btree ("user_id","bottle_id");
CREATE INDEX "auction_watch_bottle_idx" ON "auction_watch" USING btree ("bottle_id");
CREATE UNIQUE INDEX "auction_site_source_unq" ON "auction" USING btree ("external_site_id","source_key");