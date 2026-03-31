-- CreateTable
CREATE TABLE "public"."itens_xml" (
    "id" TEXT NOT NULL,
    "xml_documento_id" TEXT NOT NULL,
    "numero_item" INTEGER NOT NULL,
    "codigo_item" TEXT,
    "descricao_item" TEXT NOT NULL,
    "ncm" TEXT,
    "cfop" TEXT,
    "quantidade" DECIMAL(14,4),
    "valor_unitario" DECIMAL(14,4),
    "valor_total" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "itens_xml_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "itens_xml_xml_documento_id_idx" ON "public"."itens_xml"("xml_documento_id");

-- CreateIndex
CREATE INDEX "itens_xml_codigo_item_idx" ON "public"."itens_xml"("codigo_item");

-- CreateIndex
CREATE INDEX "itens_xml_ncm_idx" ON "public"."itens_xml"("ncm");

-- AddForeignKey
ALTER TABLE "public"."itens_xml" ADD CONSTRAINT "itens_xml_xml_documento_id_fkey" FOREIGN KEY ("xml_documento_id") REFERENCES "public"."xml_documentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
