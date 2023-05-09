-- AlterTable
ALTER TABLE "checkin" ADD COLUMN     "editionId" INTEGER;

-- AddForeignKey
ALTER TABLE "checkin" ADD CONSTRAINT "checkin_editionId_fkey" FOREIGN KEY ("editionId") REFERENCES "edition"("id") ON DELETE SET NULL ON UPDATE CASCADE;
