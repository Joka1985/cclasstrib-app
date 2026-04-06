-- CreateEnum
CREATE TYPE "public"."TipoAliquotaContextual" AS ENUM ('ZERO', 'REDUZIDA', 'NORMAL');

-- CreateTable
CREATE TABLE "public"."regras_anexo_contextual" (
    "id" TEXT NOT NULL,
    "anexo" TEXT NOT NULL,
    "descricao_anexo" TEXT NOT NULL,
    "operacao_fiscal_id" TEXT,
    "exige_ncm" BOOLEAN NOT NULL DEFAULT false,
    "ncm_inicio" TEXT,
    "ncm_fim" TEXT,
    "palavras_chave_obrigatorias" TEXT,
    "palavras_chave_excludentes" TEXT,
    "atividade_permitida" TEXT,
    "operacao_permitida" TEXT,
    "exige_destinacao" BOOLEAN NOT NULL DEFAULT false,
    "destinacao" TEXT,
    "cst" TEXT NOT NULL,
    "cclasstrib" TEXT NOT NULL,
    "tipo_aliquota" "public"."TipoAliquotaContextual" NOT NULL,
    "p_red_ibs" DECIMAL(8,4),
    "p_red_cbs" DECIMAL(8,4),
    "fundamento_legal" TEXT NOT NULL,
    "artigo_lc214" TEXT,
    "prioridade" INTEGER NOT NULL,
    "base_oficial_classificacao_id" TEXT,
    "observacoes" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_anexo_contextual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "regras_anexo_contextual_anexo_idx" ON "public"."regras_anexo_contextual"("anexo");

-- CreateIndex
CREATE INDEX "regras_anexo_contextual_operacao_fiscal_id_idx" ON "public"."regras_anexo_contextual"("operacao_fiscal_id");

-- CreateIndex
CREATE INDEX "regras_anexo_contextual_ncm_inicio_ncm_fim_idx" ON "public"."regras_anexo_contextual"("ncm_inicio", "ncm_fim");

-- CreateIndex
CREATE INDEX "regras_anexo_contextual_prioridade_idx" ON "public"."regras_anexo_contextual"("prioridade");

-- CreateIndex
CREATE INDEX "regras_anexo_contextual_ativa_idx" ON "public"."regras_anexo_contextual"("ativa");

-- AddForeignKey
ALTER TABLE "public"."regras_anexo_contextual" ADD CONSTRAINT "regras_anexo_contextual_operacao_fiscal_id_fkey" FOREIGN KEY ("operacao_fiscal_id") REFERENCES "public"."operacoes_fiscais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."regras_anexo_contextual" ADD CONSTRAINT "regras_anexo_contextual_base_oficial_classificacao_id_fkey" FOREIGN KEY ("base_oficial_classificacao_id") REFERENCES "public"."bases_oficiais_classificacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
