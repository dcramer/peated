ALTER TYPE "public"."report_object_type" ADD VALUE 'bottle';
ALTER TYPE "public"."report_object_type" ADD VALUE 'entity';
ALTER TYPE "public"."report_object_type" ADD VALUE 'bottle_series';
ALTER TYPE "public"."report_object_type" ADD VALUE 'flight';
ALTER TYPE "public"."report_reason" ADD VALUE 'inaccurate' BEFORE 'other';
ALTER TABLE "report" ALTER COLUMN "reported_user_id" DROP NOT NULL;