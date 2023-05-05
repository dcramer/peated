-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Category" ADD VALUE 'blended_grain';
ALTER TYPE "Category" ADD VALUE 'bourbon';
ALTER TYPE "Category" ADD VALUE 'blended_scotch';
ALTER TYPE "Category" ADD VALUE 'rye';
ALTER TYPE "Category" ADD VALUE 'single_grain';

-- AlterTable
ALTER TABLE "Bottle" ADD COLUMN     "distillerId" INTEGER;

-- AlterTable
ALTER TABLE "Checkin" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Distiller" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,

    CONSTRAINT "Distiller_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Distiller_name_key" ON "Distiller"("name");

-- AddForeignKey
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_distillerId_fkey" FOREIGN KEY ("distillerId") REFERENCES "Distiller"("id") ON DELETE SET NULL ON UPDATE CASCADE;
