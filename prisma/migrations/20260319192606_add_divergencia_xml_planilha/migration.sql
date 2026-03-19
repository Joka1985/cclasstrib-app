-- CreateTable
CREATE TABLE "public"."divergencias_xml_planilha" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "codigo_planilha" TEXT,
    "codigo_xml" TEXT,
    "descricao_planilha" TEXT,
    "descricao_xml" TEXT,
    "tipo_divergencia" TEXT NOT NULL,
    "observacao" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "divergencias_xml_planilha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "divergencias_xml_planilha_lote_id_idx" ON "public"."divergencias_xml_planilha"("lote_id");

-- CreateIndex
CREATE INDEX "divergencias_xml_planilha_tipo_divergencia_idx" ON "public"."divergencias_xml_planilha"("tipo_divergencia");

-- AddForeignKey
ALTER TABLE "public"."divergencias_xml_planilha" ADD CONSTRAINT "divergencias_xml_planilha_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
