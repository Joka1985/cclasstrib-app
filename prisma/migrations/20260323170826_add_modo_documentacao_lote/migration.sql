-- CreateEnum
CREATE TYPE "public"."ModoDocumentacao" AS ENUM ('NAO_DEFINIDO', 'COM_XML', 'SEM_XML');

-- AlterTable
ALTER TABLE "public"."lotes" ADD COLUMN     "modo_documentacao" "public"."ModoDocumentacao" NOT NULL DEFAULT 'NAO_DEFINIDO';
