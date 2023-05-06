/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `user` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "user" DROP COLUMN "imageUrl",
ADD COLUMN     "pictureUrl" TEXT;
