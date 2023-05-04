/*
  Warnings:

  - You are about to drop the column `distillerId` on the `bottle` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "bottle" DROP CONSTRAINT "bottle_distillerId_fkey";

-- AlterTable
ALTER TABLE "bottle" DROP COLUMN "distillerId";

-- CreateTable
CREATE TABLE "_BottleToDistiller" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_BottleToDistiller_AB_unique" ON "_BottleToDistiller"("A", "B");

-- CreateIndex
CREATE INDEX "_BottleToDistiller_B_index" ON "_BottleToDistiller"("B");

-- AddForeignKey
ALTER TABLE "_BottleToDistiller" ADD CONSTRAINT "_BottleToDistiller_A_fkey" FOREIGN KEY ("A") REFERENCES "bottle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_BottleToDistiller" ADD CONSTRAINT "_BottleToDistiller_B_fkey" FOREIGN KEY ("B") REFERENCES "distiller"("id") ON DELETE CASCADE ON UPDATE CASCADE;
