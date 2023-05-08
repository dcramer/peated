/*
  Warnings:

  - The values [blended_malt,blended_grain,blended_scotch] on the enum `Category` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `abv` on the `bottle` table. All the data in the column will be lost.
  - You are about to drop the column `series` on the `bottle` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[name,brandId]` on the table `bottle` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "Category_new" AS ENUM ('blend', 'bourbon', 'rye', 'single_grain', 'single_malt', 'spirit');
ALTER TABLE "bottle" ALTER COLUMN "category" TYPE "Category_new" USING ("category"::text::"Category_new");
ALTER TYPE "Category" RENAME TO "Category_old";
ALTER TYPE "Category_new" RENAME TO "Category";
DROP TYPE "Category_old";
COMMIT;

-- DropIndex
DROP INDEX "bottle_name_brandId_series_key";

-- AlterTable
ALTER TABLE "bottle" DROP COLUMN "abv",
DROP COLUMN "series";

-- CreateTable
CREATE TABLE "edition" (
    "id" SERIAL NOT NULL,
    "bottleId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "barrel" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,

    CONSTRAINT "edition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "edition_bottleId_name_barrel_key" ON "edition"("bottleId", "name", "barrel");

-- CreateIndex
CREATE UNIQUE INDEX "bottle_name_brandId_key" ON "bottle"("name", "brandId");

-- AddForeignKey
ALTER TABLE "edition" ADD CONSTRAINT "edition_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "bottle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edition" ADD CONSTRAINT "edition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
