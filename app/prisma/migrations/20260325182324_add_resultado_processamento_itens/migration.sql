-- CreateEnum
CREATE TYPE "public"."StatusClassificacaoItem" AS ENUM ('CLASSIFICADO', 'RESSALVA', 'IMPRECISO');

-- AlterTable
ALTER TABLE "public"."lotes" ADD COLUMN     "data_processamento_fim" TIMESTAMP(3),
ADD COLUMN     "data_processamento_iniciado" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "public"."resultados_processamento_itens" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "item_planilha_id" TEXT,
    "item_xml_id" TEXT,
    "linha_origem" INTEGER,
    "chave_consolidacao" TEXT NOT NULL,
    "codigo_item" TEXT,
    "descricao_original" TEXT NOT NULL,
    "descricao_normalizada" TEXT NOT NULL,
    "ncm_planilha" TEXT,
    "ncm_xml" TEXT,
    "ncm_final" TEXT,
    "nbs" TEXT,
    "cfop_manual" TEXT,
    "cfop_xml" TEXT,
    "cfop_final" TEXT,
    "criterio_relacionamento" TEXT,
    "possui_relacao_xml" BOOLEAN NOT NULL DEFAULT false,
    "descricao_divergente" BOOLEAN NOT NULL DEFAULT false,
    "ncm_divergente" BOOLEAN NOT NULL DEFAULT false,
    "quantidade_consolidada" INTEGER NOT NULL DEFAULT 1,
    "apto_analise" BOOLEAN NOT NULL DEFAULT false,
    "status_classificacao" "public"."StatusClassificacaoItem" NOT NULL,
    "cclasstrib_codigo" TEXT,
    "cclasstrib_descricao" TEXT,
    "fundamento" TEXT,
    "observacoes" TEXT,
    "confianca" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resultados_processamento_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resultados_processamento_itens_lote_id_idx" ON "public"."resultados_processamento_itens"("lote_id");

-- CreateIndex
CREATE INDEX "resultados_processamento_itens_item_planilha_id_idx" ON "public"."resultados_processamento_itens"("item_planilha_id");

-- CreateIndex
CREATE INDEX "resultados_processamento_itens_item_xml_id_idx" ON "public"."resultados_processamento_itens"("item_xml_id");

-- CreateIndex
CREATE INDEX "resultados_processamento_itens_status_classificacao_idx" ON "public"."resultados_processamento_itens"("status_classificacao");

-- CreateIndex
CREATE INDEX "resultados_processamento_itens_cclasstrib_codigo_idx" ON "public"."resultados_processamento_itens"("cclasstrib_codigo");

-- AddForeignKey
ALTER TABLE "public"."resultados_processamento_itens" ADD CONSTRAINT "resultados_processamento_itens_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resultados_processamento_itens" ADD CONSTRAINT "resultados_processamento_itens_item_planilha_id_fkey" FOREIGN KEY ("item_planilha_id") REFERENCES "public"."itens_planilha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resultados_processamento_itens" ADD CONSTRAINT "resultados_processamento_itens_item_xml_id_fkey" FOREIGN KEY ("item_xml_id") REFERENCES "public"."itens_xml"("id") ON DELETE SET NULL ON UPDATE CASCADE;
