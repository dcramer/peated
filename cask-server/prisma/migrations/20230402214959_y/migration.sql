/*
  Warnings:

  - The values [Blend,BlendedMalt,SingleMalt,Spirit] on the enum `Category` will be removed. If these variants are still used in the database, this will fail.

*/
-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('google');

-- AlterEnum
BEGIN;
CREATE TYPE "Category_new" AS ENUM ('blend', 'blended_malt', 'single_malt', 'spirit');
ALTER TABLE "Bottle" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TYPE "Category" RENAME TO "Category_old";
ALTER TYPE "Category_new" RENAME TO "Category";
DROP TYPE "Category_old";
COMMIT;

-- CreateTable
CREATE TABLE "Identity" (
    "id" SERIAL NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Identity_provider_externalId_key" ON "Identity"("provider", "externalId");
