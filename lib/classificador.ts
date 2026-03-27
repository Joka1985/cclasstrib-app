import { ItemApuradoProcessamento } from "@/lib/apuracao";

export type StatusClassificacaoResultado =
  | "CLASSIFICADO"
  | "RESSALVA"
  | "IMPRECISO";

export type ResultadoClassificacao = {
  statusClassificacao: StatusClassificacaoResultado;
  cclassTribCodigo: string | null;
  cclassTribDescricao: string | null;
  fundamento: string | null;
  observacoes: string[];
  confianca: number;
};

type RegraClassificacao = {
  codigo: string;
  descricao: string;
  ncmPrefixos?: string[];
  palavrasChave?: string[];
  cfopPrefixos?: string[];
  fundamento: string;
  confiancaBase: number;
};

const REGRAS_CLASSIFICACAO: RegraClassificacao[] = [
  {
    codigo: "CCT-MERC-ALIM",
    descricao: "Mercadoria alimentícia industrializada",
    ncmPrefixos: ["0201", "0202", "0402", "1005", "1101", "1905", "2008", "2106"],
    palavrasChave: ["ALIMENTO", "BISCOITO", "MASSA", "FARINHA", "MOLHO", "MILHO"],
    cfopPrefixos: ["1", "2", "5", "6"],
    fundamento: "Enquadramento preliminar por NCM e aderência textual da descrição.",
    confiancaBase: 58,
  },
  {
    codigo: "CCT-BEB-NA",
    descricao: "Bebida não alcoólica",
    ncmPrefixos: ["2201", "2202"],
    palavrasChave: ["AGUA", "REFRIGERANTE", "SUCO", "BEBIDA"],
    cfopPrefixos: ["1", "2", "5", "6"],
    fundamento: "Enquadramento preliminar por NCM do capítulo 22 e descrição compatível.",
    confiancaBase: 60,
  },
  {
    codigo: "CCT-HIG-LIMP",
    descricao: "Produto de higiene ou limpeza",
    ncmPrefixos: ["3303", "3305", "3401", "3402", "3808"],
    palavrasChave: ["SABAO", "DETERGENTE", "SHAMPOO", "LIMPADOR", "DESINFETANTE"],
    cfopPrefixos: ["1", "2", "5", "6"],
    fundamento: "Enquadramento preliminar por NCM e identificação semântica da descrição.",
    confiancaBase: 57,
  },
  {
    codigo: "CCT-MAT-EMB",
    descricao: "Material de embalagem ou acondicionamento",
    ncmPrefixos: ["3923", "4819"],
    palavrasChave: ["EMBALAGEM", "CAIXA", "SACO", "FILME", "PACOTE"],
    cfopPrefixos: ["1", "2", "5", "6"],
    fundamento: "Enquadramento preliminar por NCM de embalagem e descrição aderente.",
    confiancaBase: 56,
  },
  {
    codigo: "CCT-SERV-GEN",
    descricao: "Serviço genérico sujeito à revisão",
    palavrasChave: ["SERVICO", "MANUTENCAO", "INSTALACAO", "SUPORTE", "LOCACAO"],
    cfopPrefixos: ["1", "2", "5", "6"],
    fundamento: "Descrição sugere prestação de serviço e exige validação específica.",
    confiancaBase: 42,
  },
];

function normalizarTexto(valor?: string | null) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function calcularAderenciaPorPalavras(
  descricao: string,
  palavrasChave?: string[]
): number {
  if (!palavrasChave?.length) return 0;

  let hits = 0;

  for (const palavra of palavrasChave) {
    if (descricao.includes(normalizarTexto(palavra))) {
      hits += 1;
    }
  }

  if (hits === 0) return 0;
  return Math.min(10 + hits * 8, 30);
}

function calcularAderenciaPorNcm(
  ncm: string | null | undefined,
  prefixos?: string[]
): number {
  if (!ncm || !prefixos?.length) return 0;

  for (const prefixo of prefixos) {
    if (ncm.startsWith(prefixo)) {
      return 35;
    }
  }

  return 0;
}

function calcularAderenciaPorCfop(
  cfop: string | null | undefined,
  prefixos?: string[]
): number {
  if (!cfop || !prefixos?.length) return 0;

  for (const prefixo of prefixos) {
    if (cfop.startsWith(prefixo)) {
      return 10;
    }
  }

  return 0;
}

function aplicarPenalidades(
  item: ItemApuradoProcessamento,
  confiancaInicial: number
) {
  let confianca = confiancaInicial;

  if (item.descricaoDivergente) confianca -= 12;
  if (item.ncmDivergente) confianca -= 18;
  if (!item.possuiRelacaoXml) confianca -= 8;
  if (!item.aptoAnalise) confianca -= 35;
  if (!item.cfopFinal) confianca -= 15;
  if (!item.ncmFinal || item.ncmFinal.length !== 8) confianca -= 20;

  return Math.max(0, Math.min(99, confianca));
}

export function classificarItemCClassTrib(
  item: ItemApuradoProcessamento
): ResultadoClassificacao {
  if (!item.aptoAnalise) {
    return {
      statusClassificacao: "IMPRECISO",
      cclassTribCodigo: null,
      cclassTribDescricao: null,
      fundamento: "Item sem informações mínimas para análise técnica automatizada.",
      observacoes: [
        ...item.observacoesApuracao,
        "Classificação não concluída por ausência de dados mínimos.",
      ],
      confianca: 15,
    };
  }

  const descricao = normalizarTexto(item.descricaoOriginal);
  let melhorRegra: RegraClassificacao | null = null;
  let melhorScore = 0;

  for (const regra of REGRAS_CLASSIFICACAO) {
    let score = regra.confiancaBase;
    score += calcularAderenciaPorNcm(item.ncmFinal, regra.ncmPrefixos);
    score += calcularAderenciaPorPalavras(descricao, regra.palavrasChave);
    score += calcularAderenciaPorCfop(item.cfopFinal, regra.cfopPrefixos);
    score = aplicarPenalidades(item, score);

    if (score > melhorScore) {
      melhorScore = score;
      melhorRegra = regra;
    }
  }

  if (!melhorRegra || melhorScore < 45) {
    return {
      statusClassificacao: "IMPRECISO",
      cclassTribCodigo: null,
      cclassTribDescricao: null,
      fundamento:
        "Não houve aderência suficiente às regras internas preliminares do cClassTrib.",
      observacoes: [
        ...item.observacoesApuracao,
        "Necessária revisão humana para definição do enquadramento.",
      ],
      confianca: melhorScore,
    };
  }

  const observacoes = [...item.observacoesApuracao];

  if (item.descricaoDivergente || item.ncmDivergente) {
    observacoes.push(
      "Classificação gerada com ressalva por divergência entre planilha e XML."
    );

    return {
      statusClassificacao: "RESSALVA",
      cclassTribCodigo: melhorRegra.codigo,
      cclassTribDescricao: melhorRegra.descricao,
      fundamento: melhorRegra.fundamento,
      observacoes,
      confianca: melhorScore,
    };
  }

  if (melhorRegra.codigo === "CCT-SERV-GEN") {
    observacoes.push(
      "Item com indício de serviço; recomenda-se revisão técnica complementar."
    );

    return {
      statusClassificacao: "RESSALVA",
      cclassTribCodigo: melhorRegra.codigo,
      cclassTribDescricao: melhorRegra.descricao,
      fundamento: melhorRegra.fundamento,
      observacoes,
      confianca: melhorScore,
    };
  }

  return {
    statusClassificacao: "CLASSIFICADO",
    cclassTribCodigo: melhorRegra.codigo,
    cclassTribDescricao: melhorRegra.descricao,
    fundamento: melhorRegra.fundamento,
    observacoes,
    confianca: melhorScore,
  };
}