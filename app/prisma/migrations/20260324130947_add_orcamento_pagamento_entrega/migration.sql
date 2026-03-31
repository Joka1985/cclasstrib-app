-- AlterTable
ALTER TABLE "public"."lotes" ADD COLUMN     "arquivo_entrega_base64" TEXT,
ADD COLUMN     "arquivo_entrega_nome" TEXT,
ADD COLUMN     "data_entrega_enviada" TIMESTAMP(3),
ADD COLUMN     "data_orcamento_enviado" TIMESTAMP(3),
ADD COLUMN     "data_orcamento_gerado" TIMESTAMP(3),
ADD COLUMN     "data_pagamento_confirmado" TIMESTAMP(3),
ADD COLUMN     "itens_cobraveis" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "itens_com_ressalva" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "itens_imprecisos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "observacao_orcamento" TEXT;
