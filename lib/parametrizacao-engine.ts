import { prisma } from "@/lib/prisma";

type OperacaoCodigo = string;

type DestinatarioTipo =
  | "CONTRIBUINTE"
  | "NAO_CONTRIBUINTE"
  | "CONSUMIDOR_FINAL"
  | "EXTERIOR"
  | "ORGAO_PUBLICO"
  | "FILIAL"
  | "ONG"
  | "OUTRO";

type Onerosidade = "ONEROSA" | "NAO_ONEROSA" | "INDETERMINADA";

type StatusDecisao = "FECHADO" | "FECHADO_COM_RESSALVA" | "REVISAR" | "SEM_EVIDENCIA";

type TipoAmbiguidade =
  | "DADO_OBRIGATORIO_AUSENTE"
  | "SEM_REGRA_VENCEDORA"
  | "EXIGE_ANALISE_HUMANA";

type ClassificacaoDecidida = {
  cst: string;
  cclassTrib: string;
  fundamento: string | null;
  observacoes: string;
};

type MetadadosClassificacao = {
  descCclassTrib: string;
  tipoAliquota: string | null;
  pRedIbs: number | null;
  pRedCbs: number | null;
  artigoLc214: string | null;
  anexo: string | null;
};

type ClassificacaoFechada = ClassificacaoDecidida & MetadadosClassificacao;

type ClassificacaoOperacao = {
  operacaoFiscalId: string | null;
  codigoOperacao: OperacaoCodigo;
  onerosidade: Onerosidade;
  destinatarioTipo: DestinatarioTipo;
  evidencias: string[];
};

type ResultadoMotor = {
  classificado: boolean;
  classificacao: ClassificacaoFechada | null;
  statusDecisao: StatusDecisao;
  fundamento: string | null;
  observacoes: string;
  acaoProgramador: string;
  motivoRevisao: string | null;
  tipoAmbiguidade: TipoAmbiguidade | null;
  sugestaoMotor: string | null;
  baseOficialClassificacaoId: string | null;
};

type ItemXmlRelacionavel = {
  id: string;
  codigoItem: string | null;
  descricaoItem: string;
  ncm: string | null;
  cfop: string | null;
  xmlDocumento: {
    id: string;
    tipoDocumento: "NFE" | "NFCE" | "NFSE" | "OUTRO";
    destinatarioCpfCnpj: string | null;
    destinatarioNome: string | null;
    emitenteCpfCnpj: string;
    emitenteNome: string | null;
    statusXml: "SAIDA" | "ENTRADA" | "NAO_RELACIONADO" | "INVALIDO";
  };
};

type EvidenciaRelacionavel = {
  id: string;
  loteId: string;
  itemPlanilhaId: string | null;
  itemXmlId: string | null;
  operacaoFiscalId: string | null;
  cfop: string | null;
  destinatarioTipo: DestinatarioTipo | null;
  haContraprestacao: boolean | null;
  dependeEventoPosterior: boolean | null;
  constaNoDocumento: boolean | null;
  origemEvidencia: string | null;
  grauConfianca: number;
  validado: boolean;
  observacoes: string | null;
};

type RegraCompatibilizada = {
  id: string;
  codigo: string;
  prioridade: number;
  nomeRegra: string;
  operacaoFiscalId: string | null;
  resultadoRegra: "EXCECAO_DA_EXCECAO" | "EXCECAO" | "REGRA_GERAL";
  ramoOnerosidade: Onerosidade;
  exigeNcm: boolean;
  ncmInicio: string | null;
  ncmFim: string | null;
  cfopLista: string | null;
  exigeDestinatarioTipo: boolean;
  destinatarioTipo: DestinatarioTipo | null;
  exigeEventoPosterior: boolean;
  exigeConstarDocumento: boolean;
  exigeContraprestacao: boolean | null;
  fundamentoLegal: string | null;
  artigoLc214: string | null;
  observacoes: string | null;
  baseOficialClassificacaoId: string | null;
};

type ContextoClassificacao = {
  loteId: string;
  itemPlanilhaId: string;
  itemXmlId: string | null;
  ncm: string | null;
  cfop: string | null;
  descricao: string;
  classificacaoOperacao: ClassificacaoOperacao;
  evidencias: EvidenciaRelacionavel[];
  possuiRelacaoXml: boolean;
  descricaoDivergente: boolean;
  ncmDivergente: boolean;
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

function normalizarNcm(valor?: string | null) {
  const ncm = somenteNumeros(valor);
  return ncm.length >= 2 ? ncm : null;
}

function normalizarCfop(valor?: string | null) {
  const cfop = somenteNumeros(valor);
  return cfop.length === 4 ? cfop : null;
}

function construirObservacoes(partes: Array<string | null | undefined>) {
  return partes.filter(Boolean).join(" ");
}

function montarChaveUnicaResultado(params: {
  itemPlanilhaId: string;
  ncm: string | null;
  cfop: string | null;
  cst: string | null;
  cclassTrib: string | null;
}) {
  return [
    params.itemPlanilhaId,
    normalizarNcm(params.ncm) ?? "",
    normalizarCfop(params.cfop) ?? "",
    params.cst ?? "",
    params.cclassTrib ?? "",
  ].join("|");
}

function obterItensXmlRelacionados(params: {
  codigoItemOuServico?: string | null;
  descricaoItemOuServico?: string | null;
  itensXml: ItemXmlRelacionavel[];
}) {
  const codigoNormalizado = normalizarTexto(params.codigoItemOuServico);
  const descricaoNormalizada = normalizarTexto(params.descricaoItemOuServico);

  const relacionados = params.itensXml.filter((itemXml) => {
    const codigoBate =
      !!codigoNormalizado &&
      normalizarTexto(itemXml.codigoItem) === codigoNormalizado;

    const descricaoBate =
      !!descricaoNormalizada &&
      normalizarTexto(itemXml.descricaoItem) === descricaoNormalizada;

    return codigoBate || descricaoBate;
  });

  const unicos = new Map<string, ItemXmlRelacionavel>();

  for (const item of relacionados) {
    const chave = [
      item.id,
      normalizarCfop(item.cfop) ?? "",
      normalizarNcm(item.ncm) ?? "",
    ].join("|");

    if (!unicos.has(chave)) {
      unicos.set(chave, item);
    }
  }

  return Array.from(unicos.values());
}

function coletarCfopsEfetivos(params: {
  cfopProcessado?: string | null;
  cfopManual?: string | null;
  itensXmlRelacionados: ItemXmlRelacionavel[];
}) {
  const lista = new Set<string>();

  const cfopProcessado = normalizarCfop(params.cfopProcessado);
  const cfopManual = normalizarCfop(params.cfopManual);

  if (cfopProcessado) lista.add(cfopProcessado);
  if (cfopManual) lista.add(cfopManual);

  if (!cfopManual) {
    for (const itemXml of params.itensXmlRelacionados) {
      const cfopXml = normalizarCfop(itemXml.cfop);
      if (cfopXml) lista.add(cfopXml);
    }
  }

  return Array.from(lista.values());
}

function resolverNcmEfetivo(params: {
  ncmProcessado?: string | null;
  ncmPlanilha?: string | null;
  itensXmlRelacionados: ItemXmlRelacionavel[];
}) {
  const ncmProcessado = normalizarNcm(params.ncmProcessado);
  if (ncmProcessado) return ncmProcessado;

  const ncmPlanilha = normalizarNcm(params.ncmPlanilha);
  if (ncmPlanilha) return ncmPlanilha;

  for (const itemXml of params.itensXmlRelacionados) {
    const ncmXml = normalizarNcm(itemXml.ncm);
    if (ncmXml) return ncmXml;
  }

  return null;
}

function inferirDestinatarioTipo(params: {
  clienteCpfCnpj?: string | null;
  destinatarioCpfCnpj?: string | null;
  destinatarioNome?: string | null;
}): DestinatarioTipo {
  const cliente = somenteNumeros(params.clienteCpfCnpj);
  const destinatario = somenteNumeros(params.destinatarioCpfCnpj);
  const nome = normalizarTexto(params.destinatarioNome);

  if (!destinatario && nome.includes("EXTERIOR")) return "EXTERIOR";
  if (cliente && destinatario && cliente === destinatario) return "FILIAL";
  if (nome.includes("ONG")) return "ONG";

  if (
    nome.includes("PREFEITURA") ||
    nome.includes("MUNICIPIO") ||
    nome.includes("ESTADO") ||
    nome.includes("SECRETARIA") ||
    nome.includes("CAMARA MUNICIPAL")
  ) {
    return "ORGAO_PUBLICO";
  }

  return "CONTRIBUINTE";
}

function inferirCodigoOperacaoPorHeuristica(params: {
  cfop: string | null;
  descricao: string | null;
  destinatarioTipo: DestinatarioTipo;
}) {
  const cfop = normalizarCfop(params.cfop);
  const descricao = normalizarTexto(params.descricao);

  if (params.destinatarioTipo === "EXTERIOR" || cfop?.startsWith("7")) {
    return ["EXPORTACAO", "VENDA_NORMAL"];
  }

  if (cfop === "5910" || cfop === "6910" || descricao.includes("BONIFICA")) {
    return ["BONIFICACAO", "BRINDE", "DOACAO"];
  }

  if (cfop === "5918" || cfop === "6918" || descricao.includes("DOACAO")) {
    return ["DOACAO", "BONIFICACAO"];
  }

  if (cfop === "5908" || cfop === "6908" || descricao.includes("COMODATO")) {
    return ["COMODATO"];
  }

  if (["5151", "5152", "6151", "6152"].includes(cfop ?? "") || descricao.includes("TRANSFER")) {
    return ["TRANSFERENCIA_FILIAL", "TRANSFERENCIA"];
  }

  if (["5915", "6915", "5916", "6916"].includes(cfop ?? "") || descricao.includes("CONSERTO") || descricao.includes("REPARO")) {
    return ["REMESSA_CONSERTO"];
  }

  if (descricao.includes("DEVOLU")) {
    return ["DEVOLUCAO"];
  }

  return ["VENDA_NORMAL", "VENDA_ST_SUBSTITUIDO", "OPERACAO_A_REVISAR"];
}

async function carregarMapaOperacoesFiscais() {
  const operacoes = await prisma.operacaoFiscal.findMany({
    where: { ativa: true },
    select: {
      id: true,
      codigo: true,
      nomeOperacao: true,
      onerosidade: true,
      exigeEventoPosterior: true,
      exigeDestinatario: true,
      ativa: true,
    },
  });

  return operacoes;
}

async function resolverOperacaoViaBanco(params: {
  cfop: string | null;
  descricao: string | null;
  clienteCpfCnpj: string | null;
  destinatarioCpfCnpj: string | null;
  destinatarioNome: string | null;
  operacoesFiscais: Awaited<ReturnType<typeof carregarMapaOperacoesFiscais>>;
  evidencias: EvidenciaRelacionavel[];
}): Promise<ClassificacaoOperacao> {
  const evidencias: string[] = [];
  const destinatarioTipoInferido = inferirDestinatarioTipo({
    clienteCpfCnpj: params.clienteCpfCnpj,
    destinatarioCpfCnpj: params.destinatarioCpfCnpj,
    destinatarioNome: params.destinatarioNome,
  });

  const evidenciaValidada = params.evidencias
    .filter((e) => !!e.operacaoFiscalId && e.validado)
    .sort((a, b) => b.grauConfianca - a.grauConfianca)[0];

  if (evidenciaValidada?.operacaoFiscalId) {
    const operacao = params.operacoesFiscais.find((o) => o.id === evidenciaValidada.operacaoFiscalId);
    if (operacao) {
      evidencias.push("Operação resolvida por evidência validada.");
      return {
        operacaoFiscalId: operacao.id,
        codigoOperacao: operacao.codigo,
        onerosidade: operacao.onerosidade,
        destinatarioTipo: evidenciaValidada.destinatarioTipo ?? destinatarioTipoInferido,
        evidencias,
      };
    }
  }

  const candidatos = inferirCodigoOperacaoPorHeuristica({
    cfop: params.cfop,
    descricao: params.descricao,
    destinatarioTipo: destinatarioTipoInferido,
  });

  const operacao = params.operacoesFiscais.find((o) => candidatos.includes(o.codigo));

  if (operacao) {
    evidencias.push(`Operação inferida por heurística controlada e confirmada no cadastro: ${operacao.codigo}.`);
    return {
      operacaoFiscalId: operacao.id,
      codigoOperacao: operacao.codigo,
      onerosidade: operacao.onerosidade,
      destinatarioTipo: destinatarioTipoInferido,
      evidencias,
    };
  }

  evidencias.push("Nenhuma operação fiscal ativa encontrada no cadastro para os indícios coletados.");
  return {
    operacaoFiscalId: null,
    codigoOperacao: "OPERACAO_A_REVISAR",
    onerosidade: "INDETERMINADA",
    destinatarioTipo: destinatarioTipoInferido,
    evidencias,
  };
}

async function buscarBaseOficialPublicadaPorId(baseId: string | null) {
  if (!baseId) return null;

  const base = await prisma.baseOficialClassificacao.findUnique({
    where: { id: baseId },
    include: {
      versaoNormativa: {
        select: {
          publicada: true,
          fonteNormativa: {
            select: {
              tipoFonte: true,
            },
          },
        },
      },
    },
  });

  if (!base) return null;
  if (!base.versaoNormativa.publicada) return null;
  if (base.versaoNormativa.fonteNormativa.tipoFonte !== "CCLASSTRIB_OFICIAL") return null;

  return base;
}

async function montarClassificacaoFechada(decisao: ClassificacaoDecidida, baseId: string | null) {
  const baseOficial = await buscarBaseOficialPublicadaPorId(baseId);

  if (!baseOficial?.descricaoCclassTrib && !baseOficial?.nomeCclassTrib) {
    return {
      classificacao: null,
      baseOficialClassificacaoId: baseOficial?.id ?? null,
    };
  }

  return {
    baseOficialClassificacaoId: baseOficial.id,
    classificacao: {
      ...decisao,
      descCclassTrib: baseOficial.descricaoCclassTrib ?? baseOficial.nomeCclassTrib,
      tipoAliquota: baseOficial.tipoAliquota ?? null,
      pRedIbs:
        baseOficial.pRedIbs !== null && baseOficial.pRedIbs !== undefined
          ? Number(baseOficial.pRedIbs)
          : null,
      pRedCbs:
        baseOficial.pRedCbs !== null && baseOficial.pRedCbs !== undefined
          ? Number(baseOficial.pRedCbs)
          : null,
      artigoLc214: baseOficial.artigoLc214 ?? null,
      anexo: baseOficial.anexo ?? null,
    },
  };
}

function regraEstaVigente(regra: {
  inicioVigencia: Date | null;
  fimVigencia: Date | null;
}, dataReferencia: Date) {
  const ref = dataReferencia.getTime();
  const ini = regra.inicioVigencia?.getTime() ?? Number.NEGATIVE_INFINITY;
  const fim = regra.fimVigencia?.getTime() ?? Number.POSITIVE_INFINITY;
  return ref >= ini && ref <= fim;
}

function regraCompativelComContexto(regra: RegraCompatibilizada, contexto: ContextoClassificacao) {
  if (regra.operacaoFiscalId && regra.operacaoFiscalId !== contexto.classificacaoOperacao.operacaoFiscalId) {
    return false;
  }

  if (regra.ramoOnerosidade !== contexto.classificacaoOperacao.onerosidade) {
    return false;
  }

  if (regra.exigeNcm) {
    const ncm = normalizarNcm(contexto.ncm);
    if (!ncm) return false;
    const ncmInicio = normalizarNcm(regra.ncmInicio);
    const ncmFim = normalizarNcm(regra.ncmFim);
    if (ncmInicio && ncm < ncmInicio) return false;
    if (ncmFim && ncm > ncmFim) return false;
  }

  if (regra.cfopLista) {
    const cfop = normalizarCfop(contexto.cfop);
    const lista = regra.cfopLista
      .split(",")
      .map((item) => normalizarCfop(item))
      .filter((item): item is string => Boolean(item));
    if (!cfop || !lista.includes(cfop)) return false;
  }

  if (regra.exigeDestinatarioTipo && regra.destinatarioTipo !== contexto.classificacaoOperacao.destinatarioTipo) {
    return false;
  }

  const dependeEventoPosterior = contexto.evidencias.some((e) => e.dependeEventoPosterior === true);
  if (regra.exigeEventoPosterior && !dependeEventoPosterior) {
    return false;
  }

  const constaNoDocumento =
    contexto.evidencias.some((e) => e.constaNoDocumento === true) || contexto.possuiRelacaoXml;
  if (regra.exigeConstarDocumento && !constaNoDocumento) {
    return false;
  }

  const haContraprestacaoPorEvidencia = contexto.evidencias.find((e) => e.haContraprestacao !== null)?.haContraprestacao;
  const haContraprestacao =
    haContraprestacaoPorEvidencia ?? (contexto.classificacaoOperacao.onerosidade === "ONEROSA");
  if (regra.exigeContraprestacao !== null && regra.exigeContraprestacao !== haContraprestacao) {
    return false;
  }

  return true;
}

async function buscarRegrasCompativeis(contexto: ContextoClassificacao, dataReferencia: Date) {
  const regras = await prisma.regraExcecaoTributaria.findMany({
    where: {
      ativa: true,
      OR: [
        { operacaoFiscalId: contexto.classificacaoOperacao.operacaoFiscalId ?? undefined },
        { operacaoFiscalId: null },
      ],
      ramoOnerosidade: contexto.classificacaoOperacao.onerosidade,
    },
    orderBy: [{ prioridade: "asc" }, { codigo: "asc" }],
    select: {
      id: true,
      codigo: true,
      prioridade: true,
      nomeRegra: true,
      operacaoFiscalId: true,
      resultadoRegra: true,
      ramoOnerosidade: true,
      exigeNcm: true,
      ncmInicio: true,
      ncmFim: true,
      cfopLista: true,
      exigeDestinatarioTipo: true,
      destinatarioTipo: true,
      exigeEventoPosterior: true,
      exigeConstarDocumento: true,
      exigeContraprestacao: true,
      fundamentoLegal: true,
      artigoLc214: true,
      observacoes: true,
      baseOficialClassificacaoId: true,
      inicioVigencia: true,
      fimVigencia: true,
    },
  });

  return regras
    .filter((regra) => regraEstaVigente(regra, dataReferencia))
    .filter((regra) => regraCompativelComContexto(regra, contexto));
}

async function buscarCenariosAmbiguidade(contexto: ContextoClassificacao) {
  return prisma.cenarioAmbiguidade.findMany({
    where: {
      ativo: true,
      AND: [
        {
          OR: [
            { operacaoFiscalId: contexto.classificacaoOperacao.operacaoFiscalId ?? undefined },
            { operacaoFiscalId: null },
          ],
        },
        {
          OR: [
            { ncm: normalizarNcm(contexto.ncm) ?? undefined },
            { ncm: null },
          ],
        },
        {
          OR: [
            { cfop: normalizarCfop(contexto.cfop) ?? undefined },
            { cfop: null },
          ],
        },
      ],
    },
    select: {
      id: true,
      codigoCenario: true,
      descricaoProdutoCenario: true,
      fundamentacao: true,
      resultadoEsperado: true,
      baseOficialClassificacaoId: true,
    },
  });
}

async function resolverClassificacaoViaBanco(contexto: ContextoClassificacao): Promise<ResultadoMotor> {
  const ncm = normalizarNcm(contexto.ncm);
  const cfop = normalizarCfop(contexto.cfop);

  if (!ncm) {
    return {
      classificado: false,
      classificacao: null,
      statusDecisao: "REVISAR",
      fundamento: null,
      observacoes: "NCM ausente ou inválido. Caso direcionado para revisão.",
      acaoProgramador: "Não parametrizar sem validação técnica.",
      motivoRevisao: "NCM ausente ou inválido para fechamento automático.",
      tipoAmbiguidade: "DADO_OBRIGATORIO_AUSENTE",
      sugestaoMotor: contexto.classificacaoOperacao.codigoOperacao,
      baseOficialClassificacaoId: null,
    };
  }

  if (!cfop) {
    return {
      classificado: false,
      classificacao: null,
      statusDecisao: "REVISAR",
      fundamento: null,
      observacoes: "CFOP ausente ou inválido. Caso direcionado para revisão.",
      acaoProgramador: "Não parametrizar sem validação técnica.",
      motivoRevisao: "CFOP ausente ou inválido para fechamento automático.",
      tipoAmbiguidade: "DADO_OBRIGATORIO_AUSENTE",
      sugestaoMotor: contexto.classificacaoOperacao.codigoOperacao,
      baseOficialClassificacaoId: null,
    };
  }

  if (!contexto.classificacaoOperacao.operacaoFiscalId) {
    return {
      classificado: false,
      classificacao: null,
      statusDecisao: "REVISAR",
      fundamento: null,
      observacoes: construirObservacoes([
        "Operação fiscal não resolvida com segurança a partir das evidências disponíveis.",
        ...contexto.classificacaoOperacao.evidencias,
      ]),
      acaoProgramador: "Não parametrizar sem validação técnica.",
      motivoRevisao: "Operação fiscal não identificada no cadastro ativo.",
      tipoAmbiguidade: "SEM_REGRA_VENCEDORA",
      sugestaoMotor: contexto.classificacaoOperacao.codigoOperacao,
      baseOficialClassificacaoId: null,
    };
  }

  const cenariosAmbiguos = await buscarCenariosAmbiguidade(contexto);
  const descricaoNormalizada = normalizarTexto(contexto.descricao);
  const cenarioRelevante = cenariosAmbiguos.find((cenario) => {
    const descricaoCenario = normalizarTexto(cenario.descricaoProdutoCenario);
    return !descricaoCenario || descricaoNormalizada.includes(descricaoCenario);
  });

  if (cenarioRelevante) {
    return {
      classificado: false,
      classificacao: null,
      statusDecisao: "REVISAR",
      fundamento: cenarioRelevante.fundamentacao ?? null,
      observacoes: construirObservacoes([
        `Cenário de ambiguidade identificado: ${cenarioRelevante.codigoCenario}.`,
        cenarioRelevante.fundamentacao,
      ]),
      acaoProgramador: "Submeter à revisão técnica antes de parametrizar.",
      motivoRevisao: `Cenário de ambiguidade ativo (${cenarioRelevante.codigoCenario}).`,
      tipoAmbiguidade: "EXIGE_ANALISE_HUMANA",
      sugestaoMotor: contexto.classificacaoOperacao.codigoOperacao,
      baseOficialClassificacaoId: cenarioRelevante.baseOficialClassificacaoId ?? null,
    };
  }

  const regrasCompativeis = await buscarRegrasCompativeis(contexto, new Date());

  if (!regrasCompativeis.length) {
    return {
      classificado: false,
      classificacao: null,
      statusDecisao: "SEM_EVIDENCIA",
      fundamento: null,
      observacoes: construirObservacoes([
        "Nenhuma regra tributária ativa e vigente foi compatível com o contexto apurado.",
        ...contexto.classificacaoOperacao.evidencias,
      ]),
      acaoProgramador: "Não parametrizar sem validação técnica.",
      motivoRevisao: "Sem regra vencedora na base dinâmica.",
      tipoAmbiguidade: "SEM_REGRA_VENCEDORA",
      sugestaoMotor: contexto.classificacaoOperacao.codigoOperacao,
      baseOficialClassificacaoId: null,
    };
  }

  const prioridadeVencedora = regrasCompativeis[0].prioridade;
  const regrasEmpatadas = regrasCompativeis.filter((regra) => regra.prioridade === prioridadeVencedora);

  if (regrasEmpatadas.length > 1) {
    return {
      classificado: false,
      classificacao: null,
      statusDecisao: "REVISAR",
      fundamento: regrasEmpatadas.map((regra) => regra.fundamentoLegal).filter(Boolean).join(" | ") || null,
      observacoes: `Mais de uma regra tributária vencedora foi encontrada com a mesma prioridade: ${regrasEmpatadas.map((regra) => regra.codigo).join(", ")}.`,
      acaoProgramador: "Submeter à revisão técnica antes de parametrizar.",
      motivoRevisao: "Conflito entre regras com mesma prioridade.",
      tipoAmbiguidade: "EXIGE_ANALISE_HUMANA",
      sugestaoMotor: contexto.classificacaoOperacao.codigoOperacao,
      baseOficialClassificacaoId: regrasEmpatadas[0].baseOficialClassificacaoId,
    };
  }

  const regraVencedora = regrasCompativeis[0];

  if (!regraVencedora.baseOficialClassificacaoId) {
    return {
      classificado: false,
      classificacao: null,
      statusDecisao: "SEM_EVIDENCIA",
      fundamento: regraVencedora.fundamentoLegal ?? null,
      observacoes: construirObservacoes([
        `Regra vencedora encontrada (${regraVencedora.codigo}), porém sem vínculo com base oficial de classificação.`,
        regraVencedora.observacoes,
      ]),
      acaoProgramador: "Completar a vinculação normativa antes de parametrizar automaticamente.",
      motivoRevisao: "Regra vencedora sem base oficial vinculada.",
      tipoAmbiguidade: "SEM_REGRA_VENCEDORA",
      sugestaoMotor: contexto.classificacaoOperacao.codigoOperacao,
      baseOficialClassificacaoId: null,
    };
  }

  const baseOficial = await buscarBaseOficialPublicadaPorId(regraVencedora.baseOficialClassificacaoId);

  if (!baseOficial) {
    return {
      classificado: false,
      classificacao: null,
      statusDecisao: "SEM_EVIDENCIA",
      fundamento: regraVencedora.fundamentoLegal ?? null,
      observacoes: "A regra vencedora aponta para uma base oficial inexistente, não publicada ou fora da fonte oficial ativa.",
      acaoProgramador: "Validar publicação normativa antes de parametrizar.",
      motivoRevisao: "Base oficial vinculada não encontrada ou não publicada.",
      tipoAmbiguidade: "SEM_REGRA_VENCEDORA",
      sugestaoMotor: contexto.classificacaoOperacao.codigoOperacao,
      baseOficialClassificacaoId: regraVencedora.baseOficialClassificacaoId,
    };
  }

  const decisao: ClassificacaoDecidida = {
    cst: baseOficial.cstIbsCbs,
    cclassTrib: baseOficial.cclassTrib,
    fundamento:
      regraVencedora.fundamentoLegal ??
      regraVencedora.artigoLc214 ??
      baseOficial.artigoLc214 ??
      null,
    observacoes: construirObservacoes([
      `Regra vencedora aplicada: ${regraVencedora.codigo} - ${regraVencedora.nomeRegra}.`,
      regraVencedora.observacoes,
      baseOficial.anexo ? `Anexo aplicável: ${baseOficial.anexo}.` : null,
    ]),
  };

  const { classificacao, baseOficialClassificacaoId } = await montarClassificacaoFechada(
    decisao,
    regraVencedora.baseOficialClassificacaoId,
  );

  if (!classificacao) {
    return {
      classificado: false,
      classificacao: null,
      statusDecisao: "SEM_EVIDENCIA",
      fundamento: decisao.fundamento,
      observacoes: "Código tributário decidido, mas sem metadados oficiais válidos para entrega final.",
      acaoProgramador: "Não parametrizar sem validação técnica.",
      motivoRevisao: "Metadados oficiais não localizados para a classificação decidida.",
      tipoAmbiguidade: "SEM_REGRA_VENCEDORA",
      sugestaoMotor: `${decisao.cst}/${decisao.cclassTrib}`,
      baseOficialClassificacaoId: baseOficialClassificacaoId ?? regraVencedora.baseOficialClassificacaoId,
    };
  }

  const fechadoComRessalva =
    !contexto.possuiRelacaoXml ||
    contexto.descricaoDivergente ||
    contexto.ncmDivergente ||
    contexto.evidencias.some((e) => !e.validado);

  return {
    classificado: true,
    classificacao,
    statusDecisao: fechadoComRessalva ? "FECHADO_COM_RESSALVA" : "FECHADO",
    fundamento: classificacao.fundamento,
    observacoes: construirObservacoes([
      classificacao.observacoes,
      ...contexto.classificacaoOperacao.evidencias,
      !contexto.possuiRelacaoXml ? "Sem relação identificada com item de XML." : null,
      contexto.descricaoDivergente ? "Descrição divergente entre planilha e XML." : null,
      contexto.ncmDivergente ? "NCM divergente entre planilha e XML." : null,
    ]),
    acaoProgramador: fechadoComRessalva
      ? "Parametrizar com validação técnica prévia."
      : "Parametrizar no ERP conforme linha final.",
    motivoRevisao: fechadoComRessalva
      ? "Caso fechado com ressalva por divergência ou falta de evidência completa."
      : null,
    tipoAmbiguidade: fechadoComRessalva ? "EXIGE_ANALISE_HUMANA" : null,
    sugestaoMotor: contexto.classificacaoOperacao.codigoOperacao,
    baseOficialClassificacaoId: baseOficialClassificacaoId ?? regraVencedora.baseOficialClassificacaoId,
  };
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
      resultadosProcessamento: {
        orderBy: { linhaOrigem: "asc" },
      },
      evidenciasOperacao: true,
    },
  });

  if (!lote) {
    throw new Error("Lote não encontrado.");
  }

  await prisma.resultadoParametrizacao.deleteMany({
    where: { loteId: lote.id },
  });

  await prisma.filaRevisaoTributaria.deleteMany({
    where: { loteId: lote.id },
  });

  const operacoesFiscais = await carregarMapaOperacoesFiscais();

  const itensXmlRelacionaveis: ItemXmlRelacionavel[] = lote.xmlDocumentos.flatMap((doc) =>
    doc.itensXml.map((itemXml) => ({
      id: itemXml.id,
      codigoItem: itemXml.codigoItem,
      descricaoItem: itemXml.descricaoItem,
      ncm: itemXml.ncm,
      cfop: itemXml.cfop,
      xmlDocumento: {
        id: doc.id,
        tipoDocumento: doc.tipoDocumento,
        destinatarioCpfCnpj: doc.destinatarioCpfCnpj,
        destinatarioNome: doc.destinatarioNome,
        emitenteCpfCnpj: doc.emitenteCpfCnpj,
        emitenteNome: doc.emitenteNome,
        statusXml: doc.statusXml,
      },
    })),
  );

  let totalResultados = 0;
  let totalFechados = 0;
  let totalRessalva = 0;
  let totalRevisar = 0;

  const chavesJaGeradas = new Set<string>();

  for (const item of lote.itensPlanilha) {
    const resultadoProcessado =
      lote.resultadosProcessamento.find((r) => r.itemPlanilhaId === item.id) ?? null;

    const itensXmlDoProduto = obterItensXmlRelacionados({
      codigoItemOuServico: item.codigoItemOuServico,
      descricaoItemOuServico: item.descricaoItemOuServico,
      itensXml: itensXmlRelacionaveis,
    });

    const primeiroItemXml = itensXmlDoProduto[0] ?? null;

    const evidenciasDoItem = lote.evidenciasOperacao.filter(
      (e) => e.itemPlanilhaId === item.id || (primeiroItemXml?.id && e.itemXmlId === primeiroItemXml.id),
    );

    const ncmEfetivo = resolverNcmEfetivo({
      ncmProcessado: resultadoProcessado?.ncmFinal,
      ncmPlanilha: item.ncm,
      itensXmlRelacionados: itensXmlDoProduto,
    });

    const cfopsEfetivos = coletarCfopsEfetivos({
      cfopProcessado: resultadoProcessado?.cfopFinal,
      cfopManual: item.cfopInformadoManual,
      itensXmlRelacionados: itensXmlDoProduto,
    });

    if (!cfopsEfetivos.length) {
      cfopsEfetivos.push("");
    }

    for (const cfopIterado of cfopsEfetivos) {
      const cfopEfetivo = normalizarCfop(cfopIterado);

      const classificacaoOperacao = await resolverOperacaoViaBanco({
        cfop: cfopEfetivo,
        descricao: item.descricaoItemOuServico,
        clienteCpfCnpj: lote.cliente.cpfCnpj,
        destinatarioCpfCnpj: primeiroItemXml?.xmlDocumento.destinatarioCpfCnpj ?? null,
        destinatarioNome: primeiroItemXml?.xmlDocumento.destinatarioNome ?? null,
        operacoesFiscais,
        evidencias: evidenciasDoItem,
      });

      const motor = await resolverClassificacaoViaBanco({
        loteId: lote.id,
        itemPlanilhaId: item.id,
        itemXmlId: primeiroItemXml?.id ?? null,
        ncm: ncmEfetivo,
        cfop: cfopEfetivo,
        descricao: item.descricaoItemOuServico,
        classificacaoOperacao,
        evidencias: evidenciasDoItem,
        possuiRelacaoXml: itensXmlDoProduto.length > 0,
        descricaoDivergente: Boolean(resultadoProcessado?.descricaoDivergente),
        ncmDivergente: Boolean(resultadoProcessado?.ncmDivergente),
      });

      const chaveResultado = montarChaveUnicaResultado({
        itemPlanilhaId: item.id,
        ncm: ncmEfetivo,
        cfop: cfopEfetivo,
        cst: motor.classificacao?.cst ?? null,
        cclassTrib: motor.classificacao?.cclassTrib ?? null,
      });

      if (chavesJaGeradas.has(chaveResultado)) {
        continue;
      }

      chavesJaGeradas.add(chaveResultado);

      if (!motor.classificado || !motor.classificacao) {
        await prisma.filaRevisaoTributaria.create({
          data: {
            loteId: lote.id,
            itemPlanilhaId: item.id,
            operacaoFiscalId: classificacaoOperacao.operacaoFiscalId,
            motivoRevisao: motor.motivoRevisao ?? "Caso sem fechamento automático.",
            tipoAmbiguidade: motor.tipoAmbiguidade ?? "SEM_REGRA_VENCEDORA",
            dadosFaltantes:
              !ncmEfetivo && !cfopEfetivo
                ? "NCM efetivo; CFOP efetivo"
                : !ncmEfetivo
                  ? "NCM efetivo"
                  : !cfopEfetivo
                    ? "CFOP efetivo"
                    : null,
            sugestaoMotor: motor.sugestaoMotor ?? classificacaoOperacao.codigoOperacao,
            responsavel: params.responsavel,
          },
        });

        totalResultados += 1;
        totalRevisar += 1;
        continue;
      }

      await prisma.resultadoParametrizacao.create({
        data: {
          loteId: lote.id,
          clienteId: lote.cliente.id,
          itemPlanilhaId: item.id,
          itemXmlId: primeiroItemXml?.id ?? null,
          operacaoFiscalId: classificacaoOperacao.operacaoFiscalId,
          baseOficialClassificacaoId: motor.baseOficialClassificacaoId,
          codProduto: item.codigoItemOuServico,
          descricao: item.descricaoItemOuServico,
          ncm: ncmEfetivo,
          cfop: cfopEfetivo,
          cst: motor.classificacao.cst,
          cclassTrib: motor.classificacao.cclassTrib,
          descCclassTrib: motor.classificacao.descCclassTrib,
          tipoAliquota: motor.classificacao.tipoAliquota,
          pRedIbs: motor.classificacao.pRedIbs,
          pRedCbs: motor.classificacao.pRedCbs,
          artigoLc214: motor.classificacao.artigoLc214,
          observacoes: motor.observacoes,
          responsavel: params.responsavel,
          dataReferencia: new Date(),
          statusDecisao: motor.statusDecisao,
          abaDestino: "PARAMETRIZACAO_FINAL",
          fundamento: motor.fundamento,
          acaoProgramador: motor.acaoProgramador,
        },
      });

      totalResultados += 1;

      if (motor.statusDecisao === "FECHADO") {
        totalFechados += 1;
      } else if (motor.statusDecisao === "FECHADO_COM_RESSALVA") {
        totalRessalva += 1;
      }
    }
  }

  await prisma.lote.update({
    where: { id: lote.id },
    data: {
      itensCobraveis: totalFechados + totalRessalva,
      itensComRessalva: totalRessalva,
      itensImprecisos: totalRevisar,
      statusLote:
        totalRevisar > 0
          ? "PROCESSADO_COM_REVISAO_HUMANA"
          : totalRessalva > 0
            ? "PROCESSADO_COM_DIVERGENCIAS"
            : "PROCESSADO_COM_SUCESSO",
    },
  });

  return {
    ok: true,
    loteId: lote.id,
    protocolo: lote.protocolo,
    totalResultados,
    totalFechados,
    totalRessalva,
    totalRevisar,
  };
}
