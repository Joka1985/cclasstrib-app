/*
  Warnings:

  - A unique constraint covering the columns `[token_acao_orcamento]` on the table `lotes` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."StatusLote" ADD VALUE 'ORCAMENTO_EXPIRADO';
ALTER TYPE "public"."StatusLote" ADD VALUE 'CANCELADO_PELO_CLIENTE';

-- AlterTable
ALTER TABLE "public"."lotes" ADD COLUMN     "data_cancelamento" TIMESTAMP(3),
ADD COLUMN     "data_orcamento_expira_em" TIMESTAMP(3),
ADD COLUMN     "motivo_cancelamento" TEXT,
ADD COLUMN     "token_acao_orcamento" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "lotes_token_acao_orcamento_key" ON "public"."lotes"("token_acao_orcamento");

-- CreateIndex
CREATE INDEX "lotes_data_orcamento_expira_em_idx" ON "public"."lotes"("data_orcamento_expira_em");

-- CreateIndex
CREATE INDEX "lotes_token_acao_orcamento_idx" ON "public"."lotes"("token_acao_orcamento");
