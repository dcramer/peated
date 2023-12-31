ALTER TABLE "bottle_alias" DROP CONSTRAINT "bottle_alias_bottle_id_full_name" IF EXISTS;
ALTER TABLE "bottle_alias" ADD CONSTRAINT "bottle_alias_name_pk" PRIMARY KEY("name");
ALTER TABLE "bottle_alias" ALTER COLUMN "bottle_id" DROP NOT NULL;
