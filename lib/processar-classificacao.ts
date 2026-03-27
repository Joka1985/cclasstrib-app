import { prisma } from "@/lib/prisma";

type OrigemProcessamento = "API" | "BOTAO_TESTE" | "WEBHOOK" | "MANUAL";

type ParamsProcessamento = {
  loteId: string;
  ignorarPagamento?: boolean;
  origem?: OrigemProcessamento;
};

type StatusClassificacao = "CLASSIFICADO" | "RESSALVA" | "IMPRECISO";

function normalizarTexto(valor?: string | null) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .trim();
}

function chaveCodigoDescricao(codigo?: string | null, descricao?: string | null) {
  const codigoNormalizado = normalizarTexto(codigo);
  const descricaoNormalizada = normalizarTexto(descricao);

  if (codigoNormalizado) return `COD:${codigoNormalizado}`;
  if (descricaoNormalizada) return `DESC:${descricaoNormalizada}`;
  return "";
}

function obterPrimeiroItemXmlRelacionado(params: {
  codigoItemOuServico?: string | null;
  descricaoItemOuServico?: string | null;
  itensXml: Array<{
    id: string;
    codigoItem: string | null;
    descricaoItem: string;
    ncm: string | null;
    cfop: string | null;
  }>;
}) {
  const chavePrincipal = chaveCodigoDescricao(
    params.codigoItemOuServico,
    params.descricaoItemOuServico
  );

  const chaveDescricao = params.descricaoItemOuServico
    ? `DESC:${normalizarTexto(params.descricaoItemOuServico)}`
    : "";

  const candidato =
    params.itensXml.find((itemXml) => {
      const chaveXml = chaveCodigoDescricao(
        itemXml.codigoItem,
        itemXml.descricaoItem
      );
      return !!chavePrincipal && chaveXml === chavePrincipal;
    }) ??
    params.itensXml.find((itemXml) => {
      const chaveXmlDesc = itemXml.descricaoItem
        ? `DESC:${normalizarTexto(itemXml.descricaoItem)}`
        : "";
      return !!chaveDescricao && chaveXmlDesc === chaveDescricao;
    }) ??
    null;

  return candidato;
}

function resumirMotivoClassificacao(params: {
  possuiRelacaoXml: boolean;
  descricaoDivergente: boolean;
  ncmDivergente: boolean;
  ncmFinal: string | null;
  cfopFinal: string | null;
}) {
  const motivos: string[] = [];

  if (!params.possuiRelacaoXml) {
    motivos.push("Sem relação identificada com item de XML.");
  }

  if (!params.ncmFinal) {
    motivos.push("NCM final ausente.");
  }

  if (!params.cfopFinal) {
    motivos.push("CFOP final ausente.");
  }

  if (params.descricaoDivergente) {
    motivos.push("Descrição divergente entre planilha e XML.");
  }

  if (params.ncmDivergente) {
    motivos.push("NCM divergente entre planilha e XML.");
  }

  return motivos.join(" ");
}

function classificarStatus(params: {
  possuiRelacaoXml: boolean;
  descricaoDivergente: boolean;
  ncmDivergente: boolean;
  ncmFinal: string | null;
  cfopFinal: string | null;
}): {
  statusClassificacao: StatusClassificacao;
  aptoAnalise: boolean;
  observacoes: string | null;
  confianca: number;
} {
  const observacoes = resumirMotivoClassificacao(params) || null;

  if (!params.ncmFinal || !params.cfopFinal) {
    return {
      statusClassificacao: "IMPRECISO",
      aptoAnalise: false,
      observacoes,
      confianca: 20,
    };
  }

  if (!params.possuiRelacaoXml) {
    return {
      statusClassificacao: "IMPRECISO",
      aptoAnalise: false,
      observacoes,
      confianca: 25,
    };
  }

  if (params.descricaoDivergente || params.ncmDivergente) {
    return {
      statusClassificacao: "RESSALVA",
      aptoAnalise: true,
      observacoes,
      confianca: 65,
    };
  }

  return {
    statusClassificacao: "CLASSIFICADO",
    aptoAnalise: true,
    observacoes: null,
    confianca: 90,
  };
}

export async function executarProcessamentoClassificacao(
  params: ParamsProcessamento
) {
  const lote = await prisma.lote.findUnique({
    where: { id: params.loteId },
    include: {
      cliente: true,
      itensPlanilha: {
        orderBy: { linhaOrigem: "asc" },
      },
      xmlDocumentos: {
        include: {
          itensXml: true,
        },
      },
      divergenciasXmlPlanilha: true,
    },
  });

  if (!lote) {
    throw new Error("Lote não encontrado.");
  }

  if (!lote.dataOrcamentoGerado) {
    throw new Error("Não é possível processar antes de gerar o orçamento.");
  }

  if (!params.ignorarPagamento && !lote.dataPagamentoConfirmado) {
    throw new Error(
      "Não é possível processar antes da confirmação do pagamento."
    );
  }

  await prisma.lote.update({
    where: { id: lote.id },
    data: {
      statusLote: "EM_PROCESSAMENTO",
      dataProcessamentoIniciado: lote.dataProcessamentoIniciado ?? new Date(),
    },
  });

  const itensPlanilhaValidos = lote.itensPlanilha.filter((item) => item.linhaValida);
  const itensXmlRelacionados = lote.xmlDocumentos
    .filter((doc) => doc.statusXml === "SAIDA" || doc.statusXml === "ENTRADA")
    .flatMap((doc) => doc.itensXml);

  const resultadosParaSalvar = itensPlanilhaValidos.map((item) => {
    const itemXmlRelacionado = obterPrimeiroItemXmlRelacionado({
      codigoItemOuServico: item.codigoItemOuServico,
      descricaoItemOuServico: item.descricaoItemOuServico,
      itensXml: itensXmlRelacionados.map((xml) => ({
        id: xml.id,
        codigoItem: xml.codigoItem,
        descricaoItem: xml.descricaoItem,
        ncm: xml.ncm,
        cfop: xml.cfop,
      })),
    });

    const divergenciasDoItem = lote.divergenciasXmlPlanilha.filter((div) => {
      const codigoBate =
        normalizarTexto(div.codigoPlanilha) ===
        normalizarTexto(item.codigoItemOuServico);

      const descricaoBate =
        normalizarTexto(div.descricaoPlanilha) ===
        normalizarTexto(item.descricaoItemOuServico);

      return codigoBate || descricaoBate;
    });

    const descricaoDivergente = divergenciasDoItem.some(
      (div) => div.tipoDivergencia === "DESCRICAO_DIVERGENTE"
    );

    const ncmDivergente = divergenciasDoItem.some(
      (div) => div.tipoDivergencia === "NCM_DIVERGENTE"
    );

    const ncmFinal = item.ncm ?? itemXmlRelacionado?.ncm ?? null;
    const cfopFinal =
      item.cfopInformadoManual ?? itemXmlRelacionado?.cfop ?? null;

    const classificacao = classificarStatus({
      possuiRelacaoXml: Boolean(itemXmlRelacionado),
      descricaoDivergente,
      ncmDivergente,
      ncmFinal,
      cfopFinal,
    });

    const criterioRelacionamento = itemXmlRelacionado
      ? normalizarTexto(item.codigoItemOuServico) &&
        normalizarTexto(item.codigoItemOuServico) ===
          normalizarTexto(itemXmlRelacionado.codigoItem)
        ? "CODIGO_ITEM"
        : "DESCRICAO_ITEM"
      : "SEM_RELACAO_XML";

    return {
      loteId: lote.id,
      itemPlanilhaId: item.id,
      itemXmlId: itemXmlRelacionado?.id ?? null,
      linhaOrigem: item.linhaOrigem,
      chaveConsolidacao: `${lote.id}:${item.id}`,
      codigoItem: item.codigoItemOuServico,
      descricaoOriginal: item.descricaoItemOuServico,
      descricaoNormalizada: normalizarTexto(item.descricaoItemOuServico),
      ncmPlanilha: item.ncm ?? null,
      ncmXml: itemXmlRelacionado?.ncm ?? null,
      ncmFinal,
      nbs: item.nbs ?? null,
      cfopManual: item.cfopInformadoManual ?? null,
      cfopXml: itemXmlRelacionado?.cfop ?? null,
      cfopFinal,
      criterioRelacionamento,
      possuiRelacaoXml: Boolean(itemXmlRelacionado),
      descricaoDivergente,
      ncmDivergente,
      quantidadeConsolidada: 1,
      aptoAnalise: classificacao.aptoAnalise,
      statusClassificacao: classificacao.statusClassificacao,
      cclassTribCodigo: null,
      cclassTribDescricao: null,
      fundamento: null,
      observacoes: classificacao.observacoes,
      confianca: classificacao.confianca,
    };
  });

  const itensCobraveis = resultadosParaSalvar.filter((r) => r.aptoAnalise).length;
  const itensComRessalva = resultadosParaSalvar.filter(
    (r) => r.statusClassificacao === "RESSALVA"
  ).length;
  const itensImprecisos = resultadosParaSalvar.filter(
    (r) => r.statusClassificacao === "IMPRECISO"
  ).length;

  const statusFinalLote =
    itensImprecisos > 0
      ? "PROCESSADO_COM_REVISAO_HUMANA"
      : itensComRessalva > 0
        ? "PROCESSADO_COM_DIVERGENCIAS"
        : "PROCESSADO_COM_SUCESSO";

  await prisma.$transaction(
    async (tx) => {
      await tx.resultadoProcessamentoItem.deleteMany({
        where: { loteId: lote.id },
      });

      if (resultadosParaSalvar.length > 0) {
        await tx.resultadoProcessamentoItem.createMany({
          data: resultadosParaSalvar,
        });
      }

      await tx.lote.update({
        where: { id: lote.id },
        data: {
          itensCobraveis,
          itensComRessalva,
          itensImprecisos,
          dataProcessamentoFim: new Date(),
          statusLote: statusFinalLote,
        },
      });
    },
    {
      timeout: 30000,
      maxWait: 10000,
    }
  );

  const loteAtualizado = await prisma.lote.findUnique({
    where: { id: lote.id },
    include: {
      cliente: true,
      resultadosProcessamento: {
        orderBy: { linhaOrigem: "asc" },
      },
    },
  });

  return {
    ok: true,
    mensagem:
      statusFinalLote === "PROCESSADO_COM_SUCESSO"
        ? "Processamento concluído com sucesso."
        : statusFinalLote === "PROCESSADO_COM_DIVERGENCIAS"
          ? "Processamento concluído com ressalvas."
          : "Processamento concluído com necessidade de revisão humana.",
    lote: loteAtualizado,
    totalResultados: resultadosParaSalvar.length,
    emailEnviado: false,
    emailErro: null,
    origem: params.origem ?? "MANUAL",
  };
}