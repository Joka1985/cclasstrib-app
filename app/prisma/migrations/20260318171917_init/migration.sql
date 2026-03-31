-- CreateEnum
CREATE TYPE "public"."TipoPessoa" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "public"."StatusLote" AS ENUM ('CADASTRO_PENDENTE', 'DOCUMENTACAO_PENDENTE', 'AGUARDANDO_VALIDACAO', 'ORCAMENTO_GERADO', 'AGUARDANDO_PAGAMENTO', 'PAGAMENTO_APROVADO', 'EM_PROCESSAMENTO', 'PROCESSADO_COM_SUCESSO', 'PROCESSADO_COM_DIVERGENCIAS', 'PROCESSADO_COM_REVISAO_HUMANA', 'ERRO_PROCESSAMENTO', 'EMAIL_ENVIADO');

-- CreateTable
CREATE TABLE "public"."clientes" (
    "id" TEXT NOT NULL,
    "tipo_pessoa" "public"."TipoPessoa" NOT NULL,
    "nome_razao_social" TEXT NOT NULL,
    "cpf_cnpj" TEXT NOT NULL,
    "atividade_principal" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "uf" VARCHAR(2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lotes" (
    "id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "status_lote" "public"."StatusLote" NOT NULL DEFAULT 'DOCUMENTACAO_PENDENTE',
    "quantidade_linhas_planilha" INTEGER NOT NULL DEFAULT 0,
    "quantidade_linhas_validas" INTEGER NOT NULL DEFAULT 0,
    "quantidade_linhas_invalidas" INTEGER NOT NULL DEFAULT 0,
    "valor_unitario" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "observacoes_internas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clientes_cpf_cnpj_key" ON "public"."clientes"("cpf_cnpj");

-- CreateIndex
CREATE INDEX "lotes_cliente_id_idx" ON "public"."lotes"("cliente_id");

-- CreateIndex
CREATE INDEX "lotes_status_lote_idx" ON "public"."lotes"("status_lote");

-- AddForeignKey
ALTER TABLE "public"."lotes" ADD CONSTRAINT "lotes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
