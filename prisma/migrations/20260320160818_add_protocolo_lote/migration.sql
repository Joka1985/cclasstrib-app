/*
  Warnings:

  - A unique constraint covering the columns `[protocolo]` on the table `lotes` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "public"."lotes" ADD COLUMN     "protocolo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "lotes_protocolo_key" ON "public"."lotes"("protocolo");
