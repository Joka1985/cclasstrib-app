-- CreateEnum
CREATE TYPE "public"."TipoFonteNormativa" AS ENUM ('CCLASSTRIB_OFICIAL', 'CST_OFICIAL', 'NCM_BENEFICIO', 'NBS_OFICIAL', 'CREDITO_PRESUMIDO', 'DFE_NT', 'NFSE_NT', 'OUTRA');

-- CreateEnum
CREATE TYPE "public"."FormatoFonteNormativa" AS ENUM ('XLSX', 'CSV', 'PDF', 'JSON', 'XML', 'HTML', 'TXT');

-- CreateEnum
CREATE TYPE "public"."StatusAtualizacaoNormativa" AS ENUM ('PENDENTE', 'BAIXADO', 'PARSEADO', 'VALIDADO', 'PUBLICADO', 'ERRO');

-- CreateEnum
CREATE TYPE "public"."TipoMudancaNormativa" AS ENUM ('INCLUSAO', 'ALTERACAO', 'REVOGACAO');

-- CreateEnum
CREATE TYPE "public"."SeveridadeAlerta" AS ENUM ('BAIXA', 'MEDIA', 'ALTA', 'CRITICA');

-- CreateEnum
CREATE TYPE "public"."OnerosidadeOperacao" AS ENUM ('ONEROSA', 'NAO_ONEROSA', 'INDETERMINADA');

-- CreateEnum
CREATE TYPE "public"."TipoResultadoRegra" AS ENUM ('EXCECAO_DA_EXCECAO', 'EXCECAO', 'REGRA_GERAL');

-- CreateEnum
CREATE TYPE "public"."StatusDecisaoParametrizacao" AS ENUM ('FECHADO', 'FECHADO_COM_RESSALVA', 'REVISAR', 'SEM_EVIDENCIA');

-- CreateEnum
CREATE TYPE "public"."StatusHomologacaoParametrizacao" AS ENUM ('PENDENTE', 'EM_TESTE', 'HOMOLOGADO', 'REPROVADO');

-- CreateEnum
CREATE TYPE "public"."TipoDestinatarioOperacao" AS ENUM ('CONTRIBUINTE', 'NAO_CONTRIBUINTE', 'CONSUMIDOR_FINAL', 'EXTERIOR', 'ORGAO_PUBLICO', 'FILIAL', 'ONG', 'OUTRO');

-- CreateTable
CREATE TABLE "public"."fontes_normativas" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo_fonte" "public"."TipoFonteNormativa" NOT NULL,
    "formato" "public"."FormatoFonteNormativa" NOT NULL,
    "url_oficial" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "frequencia_horas" INTEGER NOT NULL DEFAULT 24,
    "parser" TEXT,
    "descricao" TEXT,
    "ultima_verificacao_em" TIMESTAMP(3),
    "ultima_versao_publicada" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fontes_normativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."downloads_normativos" (
    "id" TEXT NOT NULL,
    "fonte_normativa_id" TEXT NOT NULL,
    "status_atualizacao" "public"."StatusAtualizacaoNormativa" NOT NULL DEFAULT 'PENDENTE',
    "url_baixada" TEXT,
    "nome_arquivo" TEXT,
    "mime_type" TEXT,
    "hash_arquivo" TEXT,
    "tamanho_bytes" INTEGER,
    "data_deteccao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_baixou" TIMESTAMP(3),
    "data_processou" TIMESTAMP(3),
    "mensagem_erro" TEXT,
    "payload_meta" JSONB,
    "arquivo_bruto_base64" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "downloads_normativos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."versoes_normativas" (
    "id" TEXT NOT NULL,
    "fonte_normativa_id" TEXT NOT NULL,
    "download_normativo_id" TEXT,
    "versao_identificada" TEXT NOT NULL,
    "status_atualizacao" "public"."StatusAtualizacaoNormativa" NOT NULL DEFAULT 'PARSEADO',
    "data_publicacao" TIMESTAMP(3),
    "data_vigencia_inicio" TIMESTAMP(3),
    "data_vigencia_fim" TIMESTAMP(3),
    "hash_conteudo" TEXT,
    "resumo" TEXT,
    "payload_resumo" JSONB,
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "data_publicada" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "versoes_normativas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."diffs_normativos" (
    "id" TEXT NOT NULL,
    "fonte_normativa_id" TEXT NOT NULL,
    "versao_anterior_id" TEXT,
    "versao_nova_id" TEXT NOT NULL,
    "tipo_mudanca" "public"."TipoMudancaNormativa" NOT NULL,
    "chave_registro" TEXT NOT NULL,
    "campo_alterado" TEXT,
    "valor_anterior" TEXT,
    "valor_novo" TEXT,
    "impacto" TEXT,
    "resumo" TEXT,
    "severidade" "public"."SeveridadeAlerta" NOT NULL DEFAULT 'MEDIA',
    "email_suporte_enviado" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diffs_normativos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."destinatarios_alerta" (
    "id" TEXT NOT NULL,
    "nome" TEXT,
    "email" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destinatarios_alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."alertas_suporte" (
    "id" TEXT NOT NULL,
    "fonte_normativa_id" TEXT,
    "diff_normativo_id" TEXT,
    "destinatario_alerta_id" TEXT,
    "severidade" "public"."SeveridadeAlerta" NOT NULL DEFAULT 'MEDIA',
    "assunto" TEXT NOT NULL,
    "resumo" TEXT NOT NULL,
    "payload" JSONB,
    "email_enviado" BOOLEAN NOT NULL DEFAULT false,
    "data_envio" TIMESTAMP(3),
    "erro_envio" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alertas_suporte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."bases_oficiais_classificacao" (
    "id" TEXT NOT NULL,
    "versao_normativa_id" TEXT NOT NULL,
    "cst_ibs_cbs" TEXT NOT NULL,
    "descricao_cst" TEXT,
    "cclasstrib" TEXT NOT NULL,
    "nome_cclasstrib" TEXT NOT NULL,
    "descricao_cclasstrib" TEXT,
    "lc_redacao" TEXT,
    "artigo_lc214" TEXT,
    "tipo_aliquota" TEXT,
    "p_red_ibs" DECIMAL(8,4),
    "p_red_cbs" DECIMAL(8,4),
    "ind_g_trib_regular" BOOLEAN NOT NULL DEFAULT false,
    "ind_g_cred_pres_oper" BOOLEAN NOT NULL DEFAULT false,
    "ind_g_mono_padrao" BOOLEAN NOT NULL DEFAULT false,
    "ind_g_mono_reten" BOOLEAN NOT NULL DEFAULT false,
    "ind_g_mono_ret" BOOLEAN NOT NULL DEFAULT false,
    "ind_g_mono_dif" BOOLEAN NOT NULL DEFAULT false,
    "ind_g_estorno_cred" BOOLEAN NOT NULL DEFAULT false,
    "d_ini_vig" TIMESTAMP(3),
    "d_fim_vig" TIMESTAMP(3),
    "data_atualizacao_fonte" TIMESTAMP(3),
    "ind_nfe" BOOLEAN NOT NULL DEFAULT false,
    "ind_nfce" BOOLEAN NOT NULL DEFAULT false,
    "ind_nfse" BOOLEAN NOT NULL DEFAULT false,
    "ind_cte" BOOLEAN NOT NULL DEFAULT false,
    "ind_nfcom" BOOLEAN NOT NULL DEFAULT false,
    "link_normativo" TEXT,
    "anexo" TEXT,
    "hash_linha" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bases_oficiais_classificacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."operacoes_fiscais" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome_operacao" TEXT NOT NULL,
    "familia_operacao" TEXT,
    "onerosidade" "public"."OnerosidadeOperacao" NOT NULL,
    "descricao_funcional" TEXT,
    "exige_xml" BOOLEAN NOT NULL DEFAULT true,
    "exige_evento_posterior" BOOLEAN NOT NULL DEFAULT false,
    "exige_destinatario" BOOLEAN NOT NULL DEFAULT false,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "observacao_tecnica" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operacoes_fiscais_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."evidencias_operacao" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "item_planilha_id" TEXT,
    "item_xml_id" TEXT,
    "operacao_fiscal_id" TEXT,
    "cfop" TEXT,
    "tipo_documento" "public"."TipoDocumentoFiscal",
    "chave_documento" TEXT,
    "destinatario_tipo" "public"."TipoDestinatarioOperacao",
    "ha_contraprestacao" BOOLEAN,
    "depende_evento_posterior" BOOLEAN,
    "consta_no_documento" BOOLEAN,
    "origem_evidencia" TEXT,
    "grau_confianca" INTEGER NOT NULL DEFAULT 0,
    "validado" BOOLEAN NOT NULL DEFAULT false,
    "observacoes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "evidencias_operacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."regras_excecao_tributaria" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "prioridade" INTEGER NOT NULL,
    "nome_regra" TEXT NOT NULL,
    "operacao_fiscal_id" TEXT,
    "resultado_regra" "public"."TipoResultadoRegra" NOT NULL,
    "ramo_onerosidade" "public"."OnerosidadeOperacao" NOT NULL,
    "exige_ncm" BOOLEAN NOT NULL DEFAULT false,
    "ncm_inicio" TEXT,
    "ncm_fim" TEXT,
    "cfop_lista" TEXT,
    "exige_destinatario_tipo" BOOLEAN NOT NULL DEFAULT false,
    "destinatario_tipo" "public"."TipoDestinatarioOperacao",
    "exige_evento_posterior" BOOLEAN NOT NULL DEFAULT false,
    "exige_constar_documento" BOOLEAN NOT NULL DEFAULT false,
    "exige_contraprestacao" BOOLEAN,
    "fundamento_legal" TEXT,
    "artigo_lc214" TEXT,
    "base_oficial_classificacao_id" TEXT,
    "observacoes" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "inicio_vigencia" TIMESTAMP(3),
    "fim_vigencia" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regras_excecao_tributaria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cenarios_ambiguidade" (
    "id" TEXT NOT NULL,
    "codigo_cenario" TEXT NOT NULL,
    "descricao_produto_cenario" TEXT NOT NULL,
    "ncm" TEXT,
    "operacao_fiscal_id" TEXT,
    "cfop" TEXT,
    "base_oficial_classificacao_id" TEXT,
    "fundamentacao" TEXT,
    "resultado_esperado" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cenarios_ambiguidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."resultados_parametrizacao" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "item_planilha_id" TEXT,
    "item_xml_id" TEXT,
    "operacao_fiscal_id" TEXT,
    "base_oficial_classificacao_id" TEXT,
    "cod_produto" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "ncm" TEXT,
    "cfop" TEXT,
    "cst" TEXT,
    "cclasstrib" TEXT,
    "desc_cclasstrib" TEXT,
    "tipo_aliquota" TEXT,
    "p_red_ibs" DECIMAL(8,4),
    "p_red_cbs" DECIMAL(8,4),
    "artigo_lc214" TEXT,
    "observacoes" TEXT,
    "responsavel" TEXT,
    "data_referencia" TIMESTAMP(3),
    "status_decisao" "public"."StatusDecisaoParametrizacao" NOT NULL,
    "status_homologacao" "public"."StatusHomologacaoParametrizacao" NOT NULL DEFAULT 'PENDENTE',
    "aba_destino" TEXT NOT NULL DEFAULT 'PARAMETRIZACAO_FINAL',
    "fundamento" TEXT,
    "acao_programador" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resultados_parametrizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."fila_revisao_tributaria" (
    "id" TEXT NOT NULL,
    "lote_id" TEXT NOT NULL,
    "item_planilha_id" TEXT,
    "operacao_fiscal_id" TEXT,
    "motivo_revisao" TEXT NOT NULL,
    "tipo_ambiguidade" TEXT,
    "dados_faltantes" TEXT,
    "sugestao_motor" TEXT,
    "status_decisao" "public"."StatusDecisaoParametrizacao" NOT NULL DEFAULT 'REVISAR',
    "responsavel" TEXT,
    "data_abertura" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_fechamento" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fila_revisao_tributaria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fontes_normativas_codigo_key" ON "public"."fontes_normativas"("codigo");

-- CreateIndex
CREATE INDEX "fontes_normativas_tipo_fonte_idx" ON "public"."fontes_normativas"("tipo_fonte");

-- CreateIndex
CREATE INDEX "fontes_normativas_ativa_idx" ON "public"."fontes_normativas"("ativa");

-- CreateIndex
CREATE INDEX "downloads_normativos_fonte_normativa_id_idx" ON "public"."downloads_normativos"("fonte_normativa_id");

-- CreateIndex
CREATE INDEX "downloads_normativos_status_atualizacao_idx" ON "public"."downloads_normativos"("status_atualizacao");

-- CreateIndex
CREATE INDEX "downloads_normativos_data_deteccao_idx" ON "public"."downloads_normativos"("data_deteccao");

-- CreateIndex
CREATE UNIQUE INDEX "versoes_normativas_download_normativo_id_key" ON "public"."versoes_normativas"("download_normativo_id");

-- CreateIndex
CREATE INDEX "versoes_normativas_fonte_normativa_id_idx" ON "public"."versoes_normativas"("fonte_normativa_id");

-- CreateIndex
CREATE INDEX "versoes_normativas_publicada_idx" ON "public"."versoes_normativas"("publicada");

-- CreateIndex
CREATE UNIQUE INDEX "versoes_normativas_fonte_normativa_id_versao_identificada_key" ON "public"."versoes_normativas"("fonte_normativa_id", "versao_identificada");

-- CreateIndex
CREATE INDEX "diffs_normativos_fonte_normativa_id_idx" ON "public"."diffs_normativos"("fonte_normativa_id");

-- CreateIndex
CREATE INDEX "diffs_normativos_versao_nova_id_idx" ON "public"."diffs_normativos"("versao_nova_id");

-- CreateIndex
CREATE INDEX "diffs_normativos_tipo_mudanca_idx" ON "public"."diffs_normativos"("tipo_mudanca");

-- CreateIndex
CREATE INDEX "diffs_normativos_email_suporte_enviado_idx" ON "public"."diffs_normativos"("email_suporte_enviado");

-- CreateIndex
CREATE UNIQUE INDEX "destinatarios_alerta_email_key" ON "public"."destinatarios_alerta"("email");

-- CreateIndex
CREATE INDEX "destinatarios_alerta_ativo_idx" ON "public"."destinatarios_alerta"("ativo");

-- CreateIndex
CREATE INDEX "alertas_suporte_fonte_normativa_id_idx" ON "public"."alertas_suporte"("fonte_normativa_id");

-- CreateIndex
CREATE INDEX "alertas_suporte_diff_normativo_id_idx" ON "public"."alertas_suporte"("diff_normativo_id");

-- CreateIndex
CREATE INDEX "alertas_suporte_email_enviado_idx" ON "public"."alertas_suporte"("email_enviado");

-- CreateIndex
CREATE INDEX "bases_oficiais_classificacao_versao_normativa_id_idx" ON "public"."bases_oficiais_classificacao"("versao_normativa_id");

-- CreateIndex
CREATE INDEX "bases_oficiais_classificacao_cclasstrib_idx" ON "public"."bases_oficiais_classificacao"("cclasstrib");

-- CreateIndex
CREATE INDEX "bases_oficiais_classificacao_cst_ibs_cbs_idx" ON "public"."bases_oficiais_classificacao"("cst_ibs_cbs");

-- CreateIndex
CREATE UNIQUE INDEX "bases_oficiais_classificacao_versao_normativa_id_cst_ibs_cb_key" ON "public"."bases_oficiais_classificacao"("versao_normativa_id", "cst_ibs_cbs", "cclasstrib");

-- CreateIndex
CREATE UNIQUE INDEX "operacoes_fiscais_codigo_key" ON "public"."operacoes_fiscais"("codigo");

-- CreateIndex
CREATE INDEX "operacoes_fiscais_onerosidade_idx" ON "public"."operacoes_fiscais"("onerosidade");

-- CreateIndex
CREATE INDEX "operacoes_fiscais_ativa_idx" ON "public"."operacoes_fiscais"("ativa");

-- CreateIndex
CREATE INDEX "evidencias_operacao_lote_id_idx" ON "public"."evidencias_operacao"("lote_id");

-- CreateIndex
CREATE INDEX "evidencias_operacao_item_planilha_id_idx" ON "public"."evidencias_operacao"("item_planilha_id");

-- CreateIndex
CREATE INDEX "evidencias_operacao_item_xml_id_idx" ON "public"."evidencias_operacao"("item_xml_id");

-- CreateIndex
CREATE INDEX "evidencias_operacao_operacao_fiscal_id_idx" ON "public"."evidencias_operacao"("operacao_fiscal_id");

-- CreateIndex
CREATE UNIQUE INDEX "regras_excecao_tributaria_codigo_key" ON "public"."regras_excecao_tributaria"("codigo");

-- CreateIndex
CREATE INDEX "regras_excecao_tributaria_prioridade_idx" ON "public"."regras_excecao_tributaria"("prioridade");

-- CreateIndex
CREATE INDEX "regras_excecao_tributaria_operacao_fiscal_id_idx" ON "public"."regras_excecao_tributaria"("operacao_fiscal_id");

-- CreateIndex
CREATE INDEX "regras_excecao_tributaria_ramo_onerosidade_idx" ON "public"."regras_excecao_tributaria"("ramo_onerosidade");

-- CreateIndex
CREATE INDEX "regras_excecao_tributaria_ativa_idx" ON "public"."regras_excecao_tributaria"("ativa");

-- CreateIndex
CREATE UNIQUE INDEX "cenarios_ambiguidade_codigo_cenario_key" ON "public"."cenarios_ambiguidade"("codigo_cenario");

-- CreateIndex
CREATE INDEX "cenarios_ambiguidade_operacao_fiscal_id_idx" ON "public"."cenarios_ambiguidade"("operacao_fiscal_id");

-- CreateIndex
CREATE INDEX "cenarios_ambiguidade_ncm_idx" ON "public"."cenarios_ambiguidade"("ncm");

-- CreateIndex
CREATE INDEX "resultados_parametrizacao_lote_id_idx" ON "public"."resultados_parametrizacao"("lote_id");

-- CreateIndex
CREATE INDEX "resultados_parametrizacao_cliente_id_idx" ON "public"."resultados_parametrizacao"("cliente_id");

-- CreateIndex
CREATE INDEX "resultados_parametrizacao_status_decisao_idx" ON "public"."resultados_parametrizacao"("status_decisao");

-- CreateIndex
CREATE INDEX "resultados_parametrizacao_aba_destino_idx" ON "public"."resultados_parametrizacao"("aba_destino");

-- CreateIndex
CREATE INDEX "resultados_parametrizacao_cst_idx" ON "public"."resultados_parametrizacao"("cst");

-- CreateIndex
CREATE INDEX "resultados_parametrizacao_cclasstrib_idx" ON "public"."resultados_parametrizacao"("cclasstrib");

-- CreateIndex
CREATE INDEX "fila_revisao_tributaria_lote_id_idx" ON "public"."fila_revisao_tributaria"("lote_id");

-- CreateIndex
CREATE INDEX "fila_revisao_tributaria_status_decisao_idx" ON "public"."fila_revisao_tributaria"("status_decisao");

-- AddForeignKey
ALTER TABLE "public"."downloads_normativos" ADD CONSTRAINT "downloads_normativos_fonte_normativa_id_fkey" FOREIGN KEY ("fonte_normativa_id") REFERENCES "public"."fontes_normativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."versoes_normativas" ADD CONSTRAINT "versoes_normativas_fonte_normativa_id_fkey" FOREIGN KEY ("fonte_normativa_id") REFERENCES "public"."fontes_normativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."versoes_normativas" ADD CONSTRAINT "versoes_normativas_download_normativo_id_fkey" FOREIGN KEY ("download_normativo_id") REFERENCES "public"."downloads_normativos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."diffs_normativos" ADD CONSTRAINT "diffs_normativos_fonte_normativa_id_fkey" FOREIGN KEY ("fonte_normativa_id") REFERENCES "public"."fontes_normativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."diffs_normativos" ADD CONSTRAINT "diffs_normativos_versao_anterior_id_fkey" FOREIGN KEY ("versao_anterior_id") REFERENCES "public"."versoes_normativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."diffs_normativos" ADD CONSTRAINT "diffs_normativos_versao_nova_id_fkey" FOREIGN KEY ("versao_nova_id") REFERENCES "public"."versoes_normativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."alertas_suporte" ADD CONSTRAINT "alertas_suporte_fonte_normativa_id_fkey" FOREIGN KEY ("fonte_normativa_id") REFERENCES "public"."fontes_normativas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."alertas_suporte" ADD CONSTRAINT "alertas_suporte_diff_normativo_id_fkey" FOREIGN KEY ("diff_normativo_id") REFERENCES "public"."diffs_normativos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."alertas_suporte" ADD CONSTRAINT "alertas_suporte_destinatario_alerta_id_fkey" FOREIGN KEY ("destinatario_alerta_id") REFERENCES "public"."destinatarios_alerta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."bases_oficiais_classificacao" ADD CONSTRAINT "bases_oficiais_classificacao_versao_normativa_id_fkey" FOREIGN KEY ("versao_normativa_id") REFERENCES "public"."versoes_normativas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evidencias_operacao" ADD CONSTRAINT "evidencias_operacao_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evidencias_operacao" ADD CONSTRAINT "evidencias_operacao_item_planilha_id_fkey" FOREIGN KEY ("item_planilha_id") REFERENCES "public"."itens_planilha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evidencias_operacao" ADD CONSTRAINT "evidencias_operacao_item_xml_id_fkey" FOREIGN KEY ("item_xml_id") REFERENCES "public"."itens_xml"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."evidencias_operacao" ADD CONSTRAINT "evidencias_operacao_operacao_fiscal_id_fkey" FOREIGN KEY ("operacao_fiscal_id") REFERENCES "public"."operacoes_fiscais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."regras_excecao_tributaria" ADD CONSTRAINT "regras_excecao_tributaria_operacao_fiscal_id_fkey" FOREIGN KEY ("operacao_fiscal_id") REFERENCES "public"."operacoes_fiscais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."regras_excecao_tributaria" ADD CONSTRAINT "regras_excecao_tributaria_base_oficial_classificacao_id_fkey" FOREIGN KEY ("base_oficial_classificacao_id") REFERENCES "public"."bases_oficiais_classificacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cenarios_ambiguidade" ADD CONSTRAINT "cenarios_ambiguidade_operacao_fiscal_id_fkey" FOREIGN KEY ("operacao_fiscal_id") REFERENCES "public"."operacoes_fiscais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."cenarios_ambiguidade" ADD CONSTRAINT "cenarios_ambiguidade_base_oficial_classificacao_id_fkey" FOREIGN KEY ("base_oficial_classificacao_id") REFERENCES "public"."bases_oficiais_classificacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resultados_parametrizacao" ADD CONSTRAINT "resultados_parametrizacao_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resultados_parametrizacao" ADD CONSTRAINT "resultados_parametrizacao_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resultados_parametrizacao" ADD CONSTRAINT "resultados_parametrizacao_item_planilha_id_fkey" FOREIGN KEY ("item_planilha_id") REFERENCES "public"."itens_planilha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resultados_parametrizacao" ADD CONSTRAINT "resultados_parametrizacao_item_xml_id_fkey" FOREIGN KEY ("item_xml_id") REFERENCES "public"."itens_xml"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resultados_parametrizacao" ADD CONSTRAINT "resultados_parametrizacao_operacao_fiscal_id_fkey" FOREIGN KEY ("operacao_fiscal_id") REFERENCES "public"."operacoes_fiscais"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."resultados_parametrizacao" ADD CONSTRAINT "resultados_parametrizacao_base_oficial_classificacao_id_fkey" FOREIGN KEY ("base_oficial_classificacao_id") REFERENCES "public"."bases_oficiais_classificacao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fila_revisao_tributaria" ADD CONSTRAINT "fila_revisao_tributaria_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fila_revisao_tributaria" ADD CONSTRAINT "fila_revisao_tributaria_item_planilha_id_fkey" FOREIGN KEY ("item_planilha_id") REFERENCES "public"."itens_planilha"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."fila_revisao_tributaria" ADD CONSTRAINT "fila_revisao_tributaria_operacao_fiscal_id_fkey" FOREIGN KEY ("operacao_fiscal_id") REFERENCES "public"."operacoes_fiscais"("id") ON DELETE SET NULL ON UPDATE CASCADE;
