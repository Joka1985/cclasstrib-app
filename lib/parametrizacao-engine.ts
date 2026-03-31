import { prisma } from "@/lib/prisma";
import { obterRegistroNcmComplementar } from "@/lib/ncm-complementar-node";

type ClassificacaoOperacao = {
  operacaoFiscalId: string | null;
  codigoOperacao: string | null;
  onerosidade: "ONEROSA" | "NAO_ONEROSA" | "INDETERMINADA";
  cfop: string | null;
  destinatarioTipo:
    | "CONTRIBUINTE"
    | "NAO_CONTRIBUINTE"
    | "CONSUMIDOR_FINAL"
    | "EXTERIOR"
    | "ORGAO_PUBLICO"
    | "FILIAL"
    | "ONG"
    | "OUTRO"
    | null;
};

type FallbackFechamento = {
  cst: string;
  cclassTrib: string;
  fundamento: string;
  observacoes: string;
};

function somenteNumeros(valor?: string | null) {
  return String(valor ?? "").replace(/\D/g, "");
}

function normalizarTexto(valor?: string | null) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function inferirDestinatarioTipo(params: {
  clienteCpfCnpj?: string | null;
  destinatarioCpfCnpj?: string | null;
  destinatarioNome?: string | null;
}) {
  const cliente = somenteNumeros(params.clienteCpfCnpj);
  const destinatario = somenteNumeros(params.destinatarioCpfCnpj);
  const nome = normalizarTexto(params.destinatarioNome);

  if (!destinatario && nome.includes("EXTERIOR")) return "EXTERIOR";
  if (cliente && destinatario && cliente === destinatario) return "FILIAL";
  if (nome.includes("ONG")) return "ONG";
  if (
    nome.includes("PREFEITURA") ||
    nome.includes("MUNICIPIO") ||
    nome.includes("ESTADO")
  ) {
    return "ORGAO_PUBLICO";
  }

  return "CONTRIBUINTE";
}

function classificarOperacaoPorCfop(cfop?: string | null): {
  codigoOperacao: string | null;
  onerosidade: "ONEROSA" | "NAO_ONEROSA" | "INDETERMINADA";
} {
  const valor = somenteNumeros(cfop);

  if (!valor || valor.length !== 4) {
    return {
      codigoOperacao: null,
      onerosidade: "INDETERMINADA",
    };
  }

  if (["5102", "6102", "5101", "6101"].includes(valor)) {
    return { codigoOperacao: "VENDA_NORMAL", onerosidade: "ONEROSA" };
  }

  if (["5405", "6405"].includes(valor)) {
    return {
      codigoOperacao: "VENDA_ST_SUBSTITUIDO",
      onerosidade: "ONEROSA",
    };
  }

  if (["7101", "7102"].includes(valor)) {
    return { codigoOperacao: "EXPORTACAO", onerosidade: "ONEROSA" };
  }

  if (["5910", "6910"].includes(valor)) {
    return { codigoOperacao: "BONIFICACAO", onerosidade: "NAO_ONEROSA" };
  }

  if (["5152", "6152", "5151", "6151"].includes(valor)) {
    return {
      codigoOperacao: "TRANSFERENCIA_FILIAL",
      onerosidade: "NAO_ONEROSA",
    };
  }

  if (["5915", "6915"].includes(valor)) {
    return {
      codigoOperacao: "REMESSA_CONSERTO",
      onerosidade: "NAO_ONEROSA",
    };
  }

  return {
    codigoOperacao: "OPERACAO_A_REVISAR",
    onerosidade: "INDETERMINADA",
  };
}

async function resolverOperacao(params: {
  cfop: string | null;
  clienteCpfCnpj?: string | null;
  destinatarioCpfCnpj?: string | null;
  destinatarioNome?: string | null;
}): Promise<ClassificacaoOperacao> {
  const base = classificarOperacaoPorCfop(params.cfop);

  const operacao = base.codigoOperacao
    ? await prisma.operacaoFiscal.findFirst({
        where: {
          codigo: base.codigoOperacao,
          ativa: true,
        },
      })
    : null;

  return {
    operacaoFiscalId: operacao?.id ?? null,
    codigoOperacao: operacao?.codigo ?? base.codigoOperacao,
    onerosidade: operacao?.onerosidade ?? base.onerosidade,
    cfop: params.cfop,
    destinatarioTipo: inferirDestinatarioTipo({
      clienteCpfCnpj: params.clienteCpfCnpj,
      destinatarioCpfCnpj: params.destinatarioCpfCnpj,
      destinatarioNome: params.destinatarioNome,
    }),
  };
}

async function resolverRegraVencedora(params: {
  operacaoFiscalId: string | null;
  onerosidade: "ONEROSA" | "NAO_ONEROSA" | "INDETERMINADA";
  ncm: string | null;
  cfop: string | null;
  destinatarioTipo: string | null;
  dependeEventoPosterior?: boolean | null;
  constaNoDocumento?: boolean | null;
}) {
  const ncm = somenteNumeros(params.ncm);
  const cfop = somenteNumeros(params.cfop);

  const regras = await prisma.regraExcecaoTributaria.findMany({
    where: {
      ativa: true,
      ramoOnerosidade: params.onerosidade,
      OR: [
        { operacaoFiscalId: params.operacaoFiscalId },
        { operacaoFiscalId: null },
      ],
    },
    include: {
      baseOficialClassificacao: true,
    },
    orderBy: [{ prioridade: "asc" }, { codigo: "asc" }],
  });

  for (const regra of regras) {
    if (regra.exigeNcm) {
      if (!ncm) continue;
      if (regra.ncmInicio && ncm < regra.ncmInicio) continue;
      if (regra.ncmFim && ncm > regra.ncmFim) continue;
    }

    if (regra.cfopLista) {
      const lista = regra.cfopLista
        .split(",")
        .map((item) => somenteNumeros(item))
        .filter(Boolean);

      if (!cfop || !lista.includes(cfop)) continue;
    }

    if (regra.exigeDestinatarioTipo) {
      if (
        !params.destinatarioTipo ||
        params.destinatarioTipo !== regra.destinatarioTipo
      ) {
        continue;
      }
    }

    if (regra.exigeEventoPosterior && !params.dependeEventoPosterior) {
      continue;
    }

    if (regra.exigeConstarDocumento && !params.constaNoDocumento) {
      continue;
    }

    return regra;
  }

  return null;
}

const NCM_ANEXO_I_200003 = new Set([
  "04011010",
  "04012010",
]);

const NCM_ANEXO_XV_200014 = new Set([
  // hortícolas
  "07019000", // batata
  "07020000", // tomate
  "07031019", // cebola / cebola roxa
  "07061000", // cenoura
  "07069000", // beterraba
  "07093000", // berinjela
  "07096000", // pimentão
  "07099300", // abóbora

  // frutas
  "08039000", // banana
  "08043000", // abacaxi
  "08045020", // manga
  "08061000", // uva
]);

async function resolverFallbackPorNcm(ncm?: string | null) {
  const registro = await obterRegistroNcmComplementar(ncm);
  const codigo = somenteNumeros(ncm);

  if (!registro || !codigo) return null;

  if (NCM_ANEXO_I_200003.has(codigo)) {
    return {
      cst: "200",
      cclassTrib: "200003",
      fundamento: "Art. 125 / Anexo I",
      observacoes:
        "NCM enquadrado em produtos destinados à alimentação humana do Anexo I. Benefício específico prevalece sobre o fallback operacional do CFOP.",
    } satisfies FallbackFechamento;
  }

  if (NCM_ANEXO_XV_200014.has(codigo)) {
    return {
      cst: "200",
      cclassTrib: "200014",
      fundamento: "Art. 148 / Anexo XV",
      observacoes:
        "NCM enquadrado em produtos hortícolas, frutas e ovos do Anexo XV. Benefício específico prevalece sobre o fallback operacional do CFOP.",
    } satisfies FallbackFechamento;
  }

  if (codigo.startsWith("96190000")) {
    return {
      cst: "200",
      cclassTrib: "200013",
      fundamento: "Art. 147",
      observacoes:
        "NCM correlacionado a absorventes higiênicos com tendência de enquadramento em redução de 100%.",
    } satisfies FallbackFechamento;
  }

  return null;
}

function resolverFallbackPorCfop(cfop?: string | null): FallbackFechamento | null {
  const valor = somenteNumeros(cfop);

  if (["5405", "6405"].includes(valor)) {
    return {
      cst: "000",
      cclassTrib: "000001",
      fundamento: "Art. 4º",
      observacoes:
        "Venda onerosa com ST na condição de contribuinte substituído. Fechamento automático transitório até detalhamento específico da regra operacional.",
    };
  }

  if (["5102", "6102", "5101", "6101"].includes(valor)) {
    return {
      cst: "000",
      cclassTrib: "000001",
      fundamento: "Art. 4º",
      observacoes:
        "Venda normal sem benefício, imunidade ou exceção específica.",
    };
  }

  return null;
}

export async function gerarParametrizacaoDoLote(params: {
  loteId: string;
  responsavel: string;
}) {
  const lote = await prisma.lote.findUnique({
    where: { id: params.loteId },
    include: {
      cliente: true,
      itensPlanilha: {
        where: { linhaValida: true },
        orderBy: { linhaOrigem: "asc" },
      },
      xmlDocumentos: {
        where: {
          statusXml: {
            in: ["SAIDA", "ENTRADA"],
          },
        },
        include: {
          itensXml: true,
        },
      },
      resultadosProcessamento: true,
    },
  });

  if (!lote) {
    throw new Error("Lote não encontrado.");
  }

  const versaoPublicada = await prisma.versaoNormativa.findFirst({
    where: {
      publicada: true,
      fonteNormativa: {
        tipoFonte: "CCLASSTRIB_OFICIAL",
      },
    },
    include: {
      basesOficiais: true,
    },
    orderBy: [{ dataPublicada: "desc" }, { createdAt: "desc" }],
  });

  if (!versaoPublicada) {
    throw new Error(
      "Não existe versão normativa publicada da base oficial cClassTrib."
    );
  }

  await prisma.resultadoParametrizacao.deleteMany({
    where: { loteId: lote.id },
  });

  const resultadosCriados: string[] = [];

  for (const item of lote.itensPlanilha) {
    const resultadoProcessado = lote.resultadosProcessamento.find(
      (r) => r.itemPlanilhaId === item.id
    );

    const itemXmlRelacionado =
      lote.xmlDocumentos
        .flatMap((doc) => doc.itensXml)
        .find((xml) => {
          const codigoBate =
            normalizarTexto(xml.codigoItem) ===
            normalizarTexto(item.codigoItemOuServico);

          const descricaoBate =
            normalizarTexto(xml.descricaoItem) ===
            normalizarTexto(item.descricaoItemOuServico);

          return codigoBate || descricaoBate;
        }) ?? null;

    const cfopEfetivo =
      resultadoProcessado?.cfopFinal ??
      item.cfopInformadoManual ??
      itemXmlRelacionado?.cfop ??
      null;

    const classificacaoOperacao = await resolverOperacao({
      cfop: cfopEfetivo,
      clienteCpfCnpj: lote.cliente.cpfCnpj,
      destinatarioCpfCnpj: null,
      destinatarioNome: null,
    });

    const regra = await resolverRegraVencedora({
      operacaoFiscalId: classificacaoOperacao.operacaoFiscalId,
      onerosidade: classificacaoOperacao.onerosidade,
      ncm: item.ncm,
      cfop: cfopEfetivo,
      destinatarioTipo: classificacaoOperacao.destinatarioTipo,
      dependeEventoPosterior: false,
      constaNoDocumento: Boolean(itemXmlRelacionado),
    });

    let baseVencedora = regra?.baseOficialClassificacao ?? null;
    let fundamentoVencedor = regra?.fundamentoLegal ?? null;
    let observacaoVencedora = regra?.observacoes ?? null;

    if (!baseVencedora) {
      const fallbackNcm = await resolverFallbackPorNcm(item.ncm);

      if (fallbackNcm) {
        baseVencedora =
          versaoPublicada.basesOficiais.find(
            (base) =>
              base.cstIbsCbs === fallbackNcm.cst &&
              base.cclassTrib === fallbackNcm.cclassTrib
          ) ?? null;

        fundamentoVencedor = fallbackNcm.fundamento;
        observacaoVencedora = fallbackNcm.observacoes;
      }
    }

    if (!baseVencedora) {
      const fallback = resolverFallbackPorCfop(cfopEfetivo);

      if (fallback) {
        baseVencedora =
          versaoPublicada.basesOficiais.find(
            (base) =>
              base.cstIbsCbs === fallback.cst &&
              base.cclassTrib === fallback.cclassTrib
          ) ?? null;

        fundamentoVencedor = fallback.fundamento;
        observacaoVencedora = fallback.observacoes;
      }
    }

    if (!baseVencedora) {
      await prisma.filaRevisaoTributaria.create({
        data: {
          loteId: lote.id,
          itemPlanilhaId: item.id,
          operacaoFiscalId: classificacaoOperacao.operacaoFiscalId,
          motivoRevisao: "Nenhuma regra vencedora encontrada para o item.",
          tipoAmbiguidade: "SEM_REGRA_VENCEDORA",
          dadosFaltantes: !cfopEfetivo ? "CFOP efetivo" : null,
          sugestaoMotor:
            classificacaoOperacao.codigoOperacao ?? "OPERACAO_A_REVISAR",
          responsavel: params.responsavel,
        },
      });

      await prisma.resultadoParametrizacao.create({
        data: {
          loteId: lote.id,
          clienteId: lote.cliente.id,
          itemPlanilhaId: item.id,
          itemXmlId: itemXmlRelacionado?.id ?? null,
          operacaoFiscalId: classificacaoOperacao.operacaoFiscalId,
          codProduto: item.codigoItemOuServico,
          descricao: item.descricaoItemOuServico,
          ncm: item.ncm,
          cfop: cfopEfetivo,
          cst: null,
          cclassTrib: null,
          descCclassTrib: null,
          tipoAliquota: null,
          pRedIbs: null,
          pRedCbs: null,
          artigoLc214: null,
          observacoes:
            "Caso sem fechamento automático. Direcionado para revisão.",
          responsavel: params.responsavel,
          dataReferencia: new Date(),
          statusDecisao: "REVISAR",
          abaDestino: "CENARIOS_AMBIGUIDADE",
          fundamento: null,
          acaoProgramador: "Não parametrizar sem validação técnica.",
        },
      });

      continue;
    }

    const abaDestino =
      regra &&
      !(
        regra.resultadoRegra === "REGRA_GERAL" ||
        regra.resultadoRegra === "EXCECAO" ||
        regra.resultadoRegra === "EXCECAO_DA_EXCECAO"
      )
        ? "CENARIOS_AMBIGUIDADE"
        : "PARAMETRIZACAO_FINAL";

    const statusDecisao =
      abaDestino === "PARAMETRIZACAO_FINAL"
        ? "FECHADO"
        : "FECHADO_COM_RESSALVA";

    const criado = await prisma.resultadoParametrizacao.create({
      data: {
        loteId: lote.id,
        clienteId: lote.cliente.id,
        itemPlanilhaId: item.id,
        itemXmlId: itemXmlRelacionado?.id ?? null,
        operacaoFiscalId: classificacaoOperacao.operacaoFiscalId,
        baseOficialClassificacaoId: baseVencedora.id,
        codProduto: item.codigoItemOuServico,
        descricao: item.descricaoItemOuServico,
        ncm: item.ncm,
        cfop: cfopEfetivo,
        cst: baseVencedora.cstIbsCbs,
        cclassTrib: baseVencedora.cclassTrib,
        descCclassTrib: baseVencedora.nomeCclassTrib,
        tipoAliquota: baseVencedora.tipoAliquota,
        pRedIbs: baseVencedora.pRedIbs,
        pRedCbs: baseVencedora.pRedCbs,
        artigoLc214: baseVencedora.artigoLc214,
        observacoes: observacaoVencedora,
        responsavel: params.responsavel,
        dataReferencia: new Date(),
        statusDecisao,
        abaDestino,
        fundamento: fundamentoVencedor ?? baseVencedora.lcRedacao,
        acaoProgramador:
          abaDestino === "PARAMETRIZACAO_FINAL"
            ? "Parametrizar no ERP conforme linha final."
            : "Validar cenário antes de gravar em produção.",
      },
    });

    resultadosCriados.push(criado.id);
  }

  return {
    ok: true,
    loteId: lote.id,
    protocolo: lote.protocolo,
    totalResultados: resultadosCriados.length,
  };
}