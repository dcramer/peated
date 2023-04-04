-- CreateEnum
CREATE TYPE "IdentityProvider" AS ENUM ('google');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('blend', 'blended_malt', 'single_malt', 'spirit');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Identity" (
    "id" SERIAL NOT NULL,
    "provider" "IdentityProvider" NOT NULL,
    "externalId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Producer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,

    CONSTRAINT "Producer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bottler" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Bottler_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bottle" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "brandId" INTEGER,
    "bottlerId" INTEGER,
    "producerId" INTEGER,
    "category" "Category",
    "abv" DOUBLE PRECISION,
    "statedAge" INTEGER,
    "vintageYear" INTEGER,
    "bottleYear" INTEGER,
    "series" TEXT,
    "caskType" TEXT,
    "caskNumber" TEXT,
    "totalBottles" INTEGER,

    CONSTRAINT "Bottle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MashBill" (
    "id" SERIAL NOT NULL,
    "bottleId" INTEGER NOT NULL,
    "barley" DOUBLE PRECISION,
    "corn" DOUBLE PRECISION,
    "rye" DOUBLE PRECISION,
    "wheat" DOUBLE PRECISION,

    CONSTRAINT "MashBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Checkin" (
    "id" SERIAL NOT NULL,
    "bottleId" INTEGER NOT NULL,
    "tastingNotes" TEXT,
    "tags" TEXT[],
    "rating" DOUBLE PRECISION NOT NULL,
    "userId" INTEGER NOT NULL,

    CONSTRAINT "Checkin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Identity_provider_externalId_key" ON "Identity"("provider", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Producer_name_country_key" ON "Producer"("name", "country");

-- CreateIndex
CREATE UNIQUE INDEX "Bottler_name_key" ON "Bottler"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_name_key" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MashBill_bottleId_key" ON "MashBill"("bottleId");

-- AddForeignKey
ALTER TABLE "Identity" ADD CONSTRAINT "Identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "Brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_bottlerId_fkey" FOREIGN KEY ("bottlerId") REFERENCES "Bottler"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_producerId_fkey" FOREIGN KEY ("producerId") REFERENCES "Producer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MashBill" ADD CONSTRAINT "MashBill_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_bottleId_fkey" FOREIGN KEY ("bottleId") REFERENCES "Bottle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Checkin" ADD CONSTRAINT "Checkin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
