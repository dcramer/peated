CREATE TABLE "bottle_barcode" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"bottle_id" bigint NOT NULL,
	"value" varchar(14) NOT NULL,
	"gtin14" varchar(14) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by_actor_id" bigint NOT NULL,
	CONSTRAINT "bottle_barcode_value_check" CHECK ("bottle_barcode"."value" ~ '^[0-9]+$' AND char_length("bottle_barcode"."value") IN (8, 12, 13, 14)),
	CONSTRAINT "bottle_barcode_gtin14_check" CHECK ("bottle_barcode"."gtin14" ~ '^[0-9]{14}$')
);

ALTER TABLE "bottle_barcode" ADD CONSTRAINT "bottle_barcode_bottle_id_bottle_id_fk" FOREIGN KEY ("bottle_id") REFERENCES "public"."bottle"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "bottle_barcode" ADD CONSTRAINT "bottle_barcode_created_by_actor_id_actor_id_fk" FOREIGN KEY ("created_by_actor_id") REFERENCES "public"."actor"("id") ON DELETE no action ON UPDATE no action;
CREATE UNIQUE INDEX "bottle_barcode_gtin14_unq" ON "bottle_barcode" USING btree ("gtin14");
CREATE INDEX "bottle_barcode_bottle_idx" ON "bottle_barcode" USING btree ("bottle_id");
CREATE INDEX "bottle_barcode_created_by_actor_idx" ON "bottle_barcode" USING btree ("created_by_actor_id");