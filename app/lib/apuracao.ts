export type ItemPlanilhaCarregado = {
  id: string;
  linhaOrigem: number;
  codigoItemOuServico: string;
  descricaoItemOuServico: string;
  ncm: string | null;
  nbs: string | null;
  cfopInformadoManual: string | null;
  linhaValida: boolean;
};

export type ItemXmlCarregado = {
  id: string;
  codigoItem: string | null;
  descricaoItem: string;
  ncm: string | null;
  cfop: string | null;
};

export type ItemApuradoProcessamento = {
  itemPlanilhaId: string;
  itemXmlId: string | null;
  linhaOrigem: number;
  chaveConsolidacao: string;
  codigoItem: string;
  descricaoOriginal: string;
  descricaoNormalizada: string;
  ncmPlanilha: string | null;
  ncmXml: string | null;
  ncmFinal: string | null;
  nbs: string | null;
  cfopManual: string | null;
  cfopXml: string | null;
  cfopFinal: string | null;
  criterioRelacionamento: "CODIGO" | "DESCRICAO_NCM" | "DESCRICAO" | null;
  possuiRelacaoXml: boolean;
  descricaoDivergente: boolean;
  ncmDivergente: boolean;
  quantidadeConsolidada: number;
  aptoAnalise: boolean;
  observacoesApuracao: string[];
};

type MatchXml = {
  itemXml: ItemXmlCarregado;
  indice: number;
  criterio: "CODIGO" | "DESCRICAO_NCM" | "DESCRICAO";
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

function normalizarCodigo(valor?: string | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";

  const somenteAlfanumerico = texto.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (!somenteAlfanumerico) return "";

  if (/^\d+$/.test(somenteAlfanumerico)) {
    return String(Number(somenteAlfanumerico));
  }

  return somenteAlfanumerico;
}

function normalizarNcm(valor?: string | null) {
  const ncm = somenteNumeros(valor);
  return ncm || null;
}

function normalizarCfop(valor?: string | null) {
  const cfop = somenteNumeros(valor);
  return cfop || null;
}

function chaveDuplicidade(item: {
  codigo?: string | null;
  descricao?: string | null;
  ncm?: string | null;
  cfop?: string | null;
}) {
  return [
    normalizarCodigo(item.codigo),
    normalizarTexto(item.descricao),
    normalizarNcm(item.ncm),
    normalizarCfop(item.cfop),
  ].join("|");
}

function encontrarItemXmlRelacionado(
  itemPlanilha: {
    codigo: string | null;
    descricao: string | null;
    ncm: string | null;
  },
  itensXml: ItemXmlCarregado[],
  usados: Set<number>
): MatchXml | null {
  const codigoPlanilha = normalizarCodigo(itemPlanilha.codigo);
  const descricaoPlanilha = normalizarTexto(itemPlanilha.descricao);
  const ncmPlanilha = normalizarNcm(itemPlanilha.ncm);

  if (codigoPlanilha) {
    for (let i = 0; i < itensXml.length; i++) {
      if (usados.has(i)) continue;

      const itemXml = itensXml[i];
      const codigoXml = normalizarCodigo(itemXml.codigoItem);

      if (codigoXml && codigoXml === codigoPlanilha) {
        return { itemXml, indice: i, criterio: "CODIGO" };
      }
    }
  }

  for (let i = 0; i < itensXml.length; i++) {
    if (usados.has(i)) continue;

    const itemXml = itensXml[i];
    const descricaoXml = normalizarTexto(itemXml.descricaoItem);
    const ncmXml = normalizarNcm(itemXml.ncm);

    const descricaoBate =
      Boolean(descricaoPlanilha) &&
      Boolean(descricaoXml) &&
      descricaoPlanilha === descricaoXml;

    const ncmBate =
      Boolean(ncmPlanilha) &&
      Boolean(ncmXml) &&
      ncmPlanilha === ncmXml;

    if (descricaoBate && ncmBate) {
      return { itemXml, indice: i, criterio: "DESCRICAO_NCM" };
    }
  }

  for (let i = 0; i < itensXml.length; i++) {
    if (usados.has(i)) continue;

    const itemXml = itensXml[i];
    const descricaoXml = normalizarTexto(itemXml.descricaoItem);

    if (descricaoPlanilha && descricaoXml && descricaoPlanilha === descricaoXml) {
      return { itemXml, indice: i, criterio: "DESCRICAO" };
    }
  }

  return null;
}

export function apurarItensParaClassificacao(params: {
  itensPlanilha: ItemPlanilhaCarregado[];
  itensXml: ItemXmlCarregado[];
}) {
  const itensPlanilhaValidos = params.itensPlanilha.filter((item) => item.linhaValida);
  const xmlUsados = new Set<number>();
  const mapaConsolidado = new Map<string, ItemApuradoProcessamento>();

  for (const item of itensPlanilhaValidos) {
    const match = encontrarItemXmlRelacionado(
      {
        codigo: item.codigoItemOuServico,
        descricao: item.descricaoItemOuServico,
        ncm: item.ncm,
      },
      params.itensXml,
      xmlUsados
    );

    const ncmPlanilha = normalizarNcm(item.ncm);
    const ncmXml = match ? normalizarNcm(match.itemXml.ncm) : null;
    const cfopManual = normalizarCfop(item.cfopInformadoManual);
    const cfopXml = match ? normalizarCfop(match.itemXml.cfop) : null;

    const codigoItem = String(item.codigoItemOuServico ?? "").trim();
    const descricaoOriginal = String(item.descricaoItemOuServico ?? "").trim();
    const descricaoNormalizada = normalizarTexto(item.descricaoItemOuServico);
    const ncmFinal = ncmXml || ncmPlanilha;
    const cfopFinal = cfopXml || cfopManual;

    let descricaoDivergente = false;
    let ncmDivergente = false;

    if (match) {
      xmlUsados.add(match.indice);

      descricaoDivergente =
        normalizarTexto(item.descricaoItemOuServico) !==
        normalizarTexto(match.itemXml.descricaoItem);

      ncmDivergente =
        Boolean(ncmPlanilha) &&
        Boolean(ncmXml) &&
        ncmPlanilha !== ncmXml;
    }

    const observacoesApuracao: string[] = [];

    if (!codigoItem) observacoesApuracao.push("Código do item ausente.");
    if (!descricaoOriginal) observacoesApuracao.push("Descrição do item ausente.");
    if (!ncmFinal || ncmFinal.length !== 8) {
      observacoesApuracao.push("NCM ausente ou inválido para análise.");
    }
    if (!cfopFinal || cfopFinal.length !== 4) {
      observacoesApuracao.push("CFOP ausente ou inválido para análise.");
    }
    if (descricaoDivergente) {
      observacoesApuracao.push("Descrição divergente entre planilha e XML.");
    }
    if (ncmDivergente) {
      observacoesApuracao.push("NCM divergente entre planilha e XML.");
    }
    if (!match && !cfopManual) {
      observacoesApuracao.push("Sem XML relacionado e sem CFOP manual.");
    }

    const aptoAnalise = Boolean(
      codigoItem &&
        descricaoOriginal &&
        ncmFinal &&
        ncmFinal.length === 8 &&
        cfopFinal &&
        cfopFinal.length === 4
    );

    const chave = chaveDuplicidade({
      codigo: codigoItem,
      descricao: descricaoOriginal,
      ncm: ncmFinal || ncmPlanilha,
      cfop: cfopFinal,
    });

    if (!mapaConsolidado.has(chave)) {
      mapaConsolidado.set(chave, {
        itemPlanilhaId: item.id,
        itemXmlId: match?.itemXml.id ?? null,
        linhaOrigem: item.linhaOrigem,
        chaveConsolidacao: chave,
        codigoItem,
        descricaoOriginal,
        descricaoNormalizada,
        ncmPlanilha,
        ncmXml,
        ncmFinal,
        nbs: item.nbs,
        cfopManual,
        cfopXml,
        cfopFinal,
        criterioRelacionamento: match?.criterio ?? null,
        possuiRelacaoXml: Boolean(match),
        descricaoDivergente,
        ncmDivergente,
        quantidadeConsolidada: 1,
        aptoAnalise,
        observacoesApuracao,
      });

      continue;
    }

    const existente = mapaConsolidado.get(chave)!;
    existente.quantidadeConsolidada += 1;

    for (const observacao of observacoesApuracao) {
      if (!existente.observacoesApuracao.includes(observacao)) {
        existente.observacoesApuracao.push(observacao);
      }
    }

    if (!existente.itemXmlId && match?.itemXml.id) {
      existente.itemXmlId = match.itemXml.id;
    }

    if (!existente.criterioRelacionamento && match?.criterio) {
      existente.criterioRelacionamento = match.criterio;
    }

    existente.possuiRelacaoXml = existente.possuiRelacaoXml || Boolean(match);
    existente.descricaoDivergente =
      existente.descricaoDivergente || descricaoDivergente;
    existente.ncmDivergente = existente.ncmDivergente || ncmDivergente;
    existente.aptoAnalise = existente.aptoAnalise && aptoAnalise;
  }

  const itensApurados = Array.from(mapaConsolidado.values());

  const resumo = {
    totalItensValidosPlanilha: itensPlanilhaValidos.length,
    totalItensConsolidados: itensApurados.length,
    totalComRelacaoXml: itensApurados.filter((item) => item.possuiRelacaoXml).length,
    totalSemRelacaoXml: itensApurados.filter((item) => !item.possuiRelacaoXml).length,
    totalAptosAnalise: itensApurados.filter((item) => item.aptoAnalise).length,
    totalImprecisos: itensApurados.filter((item) => !item.aptoAnalise).length,
    totalDivergenciaNcm: itensApurados.filter((item) => item.ncmDivergente).length,
    totalDivergenciaDescricao: itensApurados.filter((item) => item.descricaoDivergente).length,
  };

  return {
    itensApurados,
    resumo,
  };
}