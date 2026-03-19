-- CreateEnum
CREATE TYPE "public"."TipoDocumentoFiscal" AS ENUM ('NFE', 'NFCE', 'NFSE', 'OUTRO');

-- CreateEnum
CREATE TYPE "public"."StatusXml" AS ENUM ('SAIDA', 'ENTRADA', 'NAO_RELACIONADO', 'INVALIDO');

-- CreateTable
CREATE TABLE "public"."xml_documentos" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "tipo_documento" "public"."TipoDocumentoFiscal" NOT NULL DEFAULT 'NFE',
    "chave_documento" TEXT,
    "emitente_cpf_cnpj" TEXT NOT NULL,
    "emitente_nome" TEXT,
    "destinatario_cpf_cnpj" TEXT,
    "destinatario_nome" TEXT,
    "data_emissao" TIMESTAMP(3),
    "status_xml" "public"."StatusXml" NOT NULL DEFAULT 'INVALIDO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "xml_documentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "xml_documentos_lote_id_idx" ON "public"."xml_documentos"("lote_id");

-- CreateIndex
CREATE INDEX "xml_documentos_status_xml_idx" ON "public"."xml_documentos"("status_xml");

-- AddForeignKey
ALTER TABLE "public"."xml_documentos" ADD CONSTRAINT "xml_documentos_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
