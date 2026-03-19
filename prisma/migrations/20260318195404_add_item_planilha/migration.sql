-- CreateTable
CREATE TABLE "public"."itens_planilha" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "linha_origem" INTEGER NOT NULL,
    "codigo_item_ou_servico" TEXT NOT NULL,
    "descricao_item_ou_servico" TEXT NOT NULL,
    "ncm" TEXT,
    "nbs" TEXT,
    "linha_valida" BOOLEAN NOT NULL DEFAULT false,
    "motivo_invalidade" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itens_planilha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "itens_planilha_lote_id_idx" ON "public"."itens_planilha"("lote_id");

-- CreateIndex
CREATE INDEX "itens_planilha_linha_valida_idx" ON "public"."itens_planilha"("linha_valida");

-- AddForeignKey
ALTER TABLE "public"."itens_planilha" ADD CONSTRAINT "itens_planilha_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
