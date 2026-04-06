/*
  Warnings:

  - You are about to drop the column `erro_envio` on the `alertas_suporte` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."alertas_suporte" DROP COLUMN "erro_envio",
ADD COLUMN     "mensagem_erro" TEXT;

-- AlterTable
ALTER TABLE "public"."bases_oficiais_classificacao" ADD COLUMN     "descricao_cst_ibs_cbs" TEXT,
ADD COLUMN     "lc_214" TEXT,
ALTER COLUMN "nome_cclasstrib" DROP NOT NULL;

-- CreateTable
CREATE TABLE "public"."ncm_anexos_vigentes" (
    "id" TEXT NOT NULL,
    "fonte_normativa_id" TEXT,
    "codigo_ncm" TEXT NOT NULL,
    "capitulo" TEXT,
    "ordem" INTEGER,
    "codigo_original" TEXT,
    "descricao" TEXT,
    "anexo_lc214" TEXT,
    "anexo_i" TEXT,
    "anexo_iv" TEXT,
    "anexo_v" TEXT,
    "anexo_vi" TEXT,
    "anexo_vii" TEXT,
    "anexo_viii" TEXT,
    "anexo_ix" TEXT,
    "anexo_xi" TEXT,
    "anexo_xii" TEXT,
    "anexo_xiii" TEXT,
    "anexo_xiv" TEXT,
    "anexo_xv" TEXT,
    "data_inicio" TIMESTAMP(3),
    "data_fim" TIMESTAMP(3),
    "ato_legal_inicio" TEXT,
    "numero_ato" TEXT,
    "ano_ato" TEXT,
    "observacoes" TEXT,
    "hash_linha" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ncm_anexos_vigentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ncm_anexos_vigentes_codigo_ncm_idx" ON "public"."ncm_anexos_vigentes"("codigo_ncm");

-- CreateIndex
CREATE INDEX "ncm_anexos_vigentes_anexo_lc214_idx" ON "public"."ncm_anexos_vigentes"("anexo_lc214");

-- CreateIndex
CREATE INDEX "ncm_anexos_vigentes_capitulo_idx" ON "public"."ncm_anexos_vigentes"("capitulo");

-- CreateIndex
CREATE INDEX "ncm_anexos_vigentes_fonte_normativa_id_idx" ON "public"."ncm_anexos_vigentes"("fonte_normativa_id");

-- CreateIndex
CREATE INDEX "alertas_suporte_destinatario_alerta_id_idx" ON "public"."alertas_suporte"("destinatario_alerta_id");

-- AddForeignKey
ALTER TABLE "public"."ncm_anexos_vigentes" ADD CONSTRAINT "ncm_anexos_vigentes_fonte_normativa_id_fkey" FOREIGN KEY ("fonte_normativa_id") REFERENCES "public"."fontes_normativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
