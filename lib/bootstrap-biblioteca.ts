import { prisma } from "@/lib/prisma";
import { garantirVersaoNormativaInicialPublicada } from "@/lib/base-oficial-inicial";
import { registrarTabelaNcmComoDownloadComplementar } from "@/lib/ncm-complementar-node";

type FonteSeed = {
  codigo: string;
  nome: string;
  tipoFonte:
    | "CCLASSTRIB_OFICIAL"
    | "CST_OFICIAL"
    | "NCM_BENEFICIO"
    | "NBS_OFICIAL"
    | "CREDITO_PRESUMIDO"
    | "DFE_NT"
    | "NFSE_NT"
    | "OUTRA";
  formato: "XLSX" | "CSV" | "PDF" | "JSON" | "XML" | "HTML" | "TXT";
  urlOficial: string;
  frequenciaHoras: number;
  parser?: string | null;
  descricao?: string | null;
};

type OperacaoSeed = {
  codigo: string;
  nomeOperacao: string;
  familiaOperacao: string;
  onerosidade: "ONEROSA" | "NAO_ONEROSA" | "INDETERMINADA";
  descricaoFuncional: string;
  exigeXml: boolean;
  exigeEventoPosterior: boolean;
  exigeDestinatario: boolean;
  observacaoTecnica?: string | null;
};

type RegraSeed = {
  codigo: string;
  prioridade: number;
  nomeRegra: string;
  operacaoCodigo?: string | null;
  resultadoRegra: "EXCECAO_DA_EXCECAO" | "EXCECAO" | "REGRA_GERAL";
  ramoOnerosidade: "ONEROSA" | "NAO_ONEROSA" | "INDETERMINADA";
  exigeNcm?: boolean;
  ncmInicio?: string | null;
  ncmFim?: string | null;
  cfopLista?: string | null;
  exigeDestinatarioTipo?: boolean;
  destinatarioTipo?:
    | "CONTRIBUINTE"
    | "NAO_CONTRIBUINTE"
    | "CONSUMIDOR_FINAL"
    | "EXTERIOR"
    | "ORGAO_PUBLICO"
    | "FILIAL"
    | "ONG"
    | "OUTRO"
    | null;
  exigeEventoPosterior?: boolean;
  exigeConstarDocumento?: boolean;
  exigeContraprestacao?: boolean | null;
  fundamentoLegal?: string | null;
  artigoLc214?: string | null;
  baseCst?: string | null;
  baseCclassTrib?: string | null;
  observacoes?: string | null;
};

type RegraAnexoSeed = {
  anexo: string;
  descricaoAnexo: string;
  operacaoCodigo?: string | null;
  exigeNcm?: boolean;
  ncmInicio?: string | null;
  ncmFim?: string | null;
  palavrasChaveObrigatorias?: string | null;
  palavrasChaveExcludentes?: string | null;
  atividadePermitida?: string | null;
  operacaoPermitida?: string | null;
  exigeDestinacao?: boolean;
  destinacao?: string | null;
  cst: string;
  cClassTrib: string;
  tipoAliquota: "ZERO" | "REDUZIDA" | "NORMAL";
  pRedIbs?: number | null;
  pRedCbs?: number | null;
  fundamentoLegal: string;
  artigoLc214?: string | null;
  prioridade: number;
  observacoes?: string | null;
};

const FONTES_NORMATIVAS: FonteSeed[] = [
  {
    codigo: "CCLASSTRIB_PORTAL_NFE",
    nome: "Tabela oficial cClassTrib / CST IBS-CBS",
    tipoFonte: "CCLASSTRIB_OFICIAL",
    formato: "XLSX",
    urlOficial:
      "https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=0xlG1bdBass=",
    frequenciaHoras: 24,
    parser: "parseTabelaOficialCClassTrib",
    descricao: "Tabela oficial publicada no Portal Nacional da NF-e.",
  },
  {
    codigo: "CST_PORTAL_NFE",
    nome: "Tabela oficial CST IBS-CBS",
    tipoFonte: "CST_OFICIAL",
    formato: "XLSX",
    urlOficial:
      "https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=0xlG1bdBass=",
    frequenciaHoras: 24,
    parser: "parseTabelaOficialCST",
    descricao: "Tabela oficial de CST vinculada às validações do DF-e.",
  },
  {
    codigo: "ANEXO_NBS_NFSE",
    nome: "Anexo B - NBS / Lista Nacional de Serviços",
    tipoFonte: "NBS_OFICIAL",
    formato: "XLSX",
    urlOficial: "https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica",
    frequenciaHoras: 72,
    parser: "parseTabelaNBS",
    descricao: "Base de NBS e lista nacional de serviços.",
  },
  {
    codigo: "CREDITO_PRESUMIDO_IBS_CBS",
    nome: "Tabela de Crédito Presumido IBS/CBS",
    tipoFonte: "CREDITO_PRESUMIDO",
    formato: "XLSX",
    urlOficial:
      "https://www.nfe.fazenda.gov.br/portal/listaConteudo.aspx?tipoConteudo=0xlG1bdBass=",
    frequenciaHoras: 24,
    parser: "parseCreditoPresumido",
    descricao: "Tabela auxiliar de cCredPres para validações e parametrização.",
  },
  {
    codigo: "NT_RTC_NFE_IBS_CBS_IS",
    nome: "NT 2025.002 RTC NF-e IBS/CBS/IS",
    tipoFonte: "DFE_NT",
    formato: "PDF",
    urlOficial:
      "https://www.nfe.fazenda.gov.br/portal/exibirArquivo.aspx?conteudo=RTC",
    frequenciaHoras: 24,
    parser: "parseNotaTecnicaDFE",
    descricao: "Nota técnica com regras de validação e grupos do DF-e.",
  },
  {
    codigo: "NT_NFSE_2025",
    nome: "Nota Técnica NFS-e 2025",
    tipoFonte: "NFSE_NT",
    formato: "PDF",
    urlOficial: "https://www.gov.br/nfse/pt-br/biblioteca/documentacao-tecnica",
    frequenciaHoras: 24,
    parser: "parseNotaTecnicaNFSe",
    descricao: "Nota técnica da NFS-e com reflexos de IBS/CBS.",
  },
  {
    codigo: "ANEXOS_LC214_2025",
    nome: "Anexos da Lei Complementar 214/2025",
    tipoFonte: "OUTRA",
    formato: "HTML",
    urlOficial:
      "https://www.leicomplementar214.com.br/Anexos_leicomplementar.html",
    frequenciaHoras: 72,
    parser: "parseAnexosLc214Html",
    descricao:
      "Anexos da Lei Complementar nº 214, de 2025, com tabelas e listas de apoio para IBS, CBS e IS.",
  },
  {
    codigo: "LC214_PLANALTO_2025",
    nome: "Lei Complementar nº 214/2025 - Texto legal",
    tipoFonte: "OUTRA",
    formato: "HTML",
    urlOficial: "https://www.planalto.gov.br/ccivil_03/leis/lcp/Lcp214.htm",
    frequenciaHoras: 72,
    parser: "parseLc214Html",
    descricao:
      "Texto integral da Lei Complementar nº 214, de 2025, publicado no Planalto.",
  },
  {
    codigo: "PORTAL_CLASSIFICACAO_TRIBUTARIA_DFE",
    nome: "Portal de Classificação Tributária DF-e",
    tipoFonte: "OUTRA",
    formato: "HTML",
    urlOficial: "https://dfe-portal.svrs.rs.gov.br/DFE/ClassificacaoTributaria",
    frequenciaHoras: 24,
    parser: "parsePortalClassificacaoTributariaDfe",
    descricao:
      "Portal DF-e de Classificação Tributária para apoio às tabelas e consultas operacionais de CST/cClassTrib.",
  },
  {
    codigo: "CONCLA_CNAE_IBGE",
    nome: "CONCLA / CNAE - IBGE",
    tipoFonte: "OUTRA",
    formato: "HTML",
    urlOficial: "https://cnae.ibge.gov.br/apresentacao-concla.html",
    frequenciaHoras: 168,
    parser: "parseConclaCnaeHtml",
    descricao:
      "Página da CONCLA/IBGE com referências da CNAE para apoio cadastral.",
  },
  {
    codigo: "TABELA_NCM_VIGENTE_20260327",
    nome: "Tabela NCM Vigente 2026-03-27",
    tipoFonte: "NCM_BENEFICIO",
    formato: "JSON",
    urlOficial: "arquivo_local_projeto",
    frequenciaHoras: 168,
    parser: "parseTabelaNcmVigenteJson",
    descricao:
      "Tabela complementar de NCM vigente carregada de arquivo local do projeto para apoio a cruzamentos de anexos e benefícios.",
  },
];

const OPERACOES_FISCAIS: OperacaoSeed[] = [
  {
    codigo: "VENDA_NORMAL",
    nomeOperacao: "Venda normal",
    familiaOperacao: "COMERCIAL",
    onerosidade: "ONEROSA",
    descricaoFuncional: "Fornecimento oneroso padrão de produto ou serviço.",
    exigeXml: true,
    exigeEventoPosterior: false,
    exigeDestinatario: false,
    observacaoTecnica: "Regra residual quando não houver exceção.",
  },
  {
    codigo: "VENDA_ST_SUBSTITUIDO",
    nomeOperacao: "Venda com ST na condição de contribuinte substituído",
    familiaOperacao: "COMERCIAL",
    onerosidade: "ONEROSA",
    descricaoFuncional:
      "Venda de mercadoria sujeita à substituição tributária na condição de substituído.",
    exigeXml: true,
    exigeEventoPosterior: false,
    exigeDestinatario: false,
    observacaoTecnica:
      "Operação onerosa conhecida, distinta da venda normal residual.",
  },
  {
    codigo: "EXPORTACAO",
    nomeOperacao: "Exportação",
    familiaOperacao: "COMERCIAL",
    onerosidade: "ONEROSA",
    descricaoFuncional: "Operação onerosa de exportação.",
    exigeXml: true,
    exigeEventoPosterior: false,
    exigeDestinatario: true,
    observacaoTecnica:
      "Operação geralmente vinculada ao ramo de imunidade ou não incidência.",
  },
  {
    codigo: "BONIFICACAO",
    nomeOperacao: "Bonificação",
    familiaOperacao: "COMERCIAL",
    onerosidade: "NAO_ONEROSA",
    descricaoFuncional: "Fornecimento em bonificação.",
    exigeXml: true,
    exigeEventoPosterior: true,
    exigeDestinatario: false,
    observacaoTecnica: "Caso clássico de exceção e exceção da exceção.",
  },
  {
    codigo: "DOACAO",
    nomeOperacao: "Doação",
    familiaOperacao: "SOCIAL",
    onerosidade: "NAO_ONEROSA",
    descricaoFuncional: "Fornecimento não oneroso a terceiro.",
    exigeXml: true,
    exigeEventoPosterior: false,
    exigeDestinatario: true,
    observacaoTecnica: "Pode depender do destinatário, como ONG ou ente público.",
  },
  {
    codigo: "TRANSFERENCIA_FILIAL",
    nomeOperacao: "Transferência para filial",
    familiaOperacao: "LOGISTICA",
    onerosidade: "NAO_ONEROSA",
    descricaoFuncional: "Movimentação entre estabelecimentos do mesmo grupo.",
    exigeXml: true,
    exigeEventoPosterior: false,
    exigeDestinatario: true,
    observacaoTecnica: "Usada para cenários do ramo de não incidência.",
  },
  {
    codigo: "REMESSA_CONSERTO",
    nomeOperacao: "Remessa para conserto",
    familiaOperacao: "LOGISTICA",
    onerosidade: "NAO_ONEROSA",
    descricaoFuncional: "Remessa temporária para conserto ou reparo.",
    exigeXml: true,
    exigeEventoPosterior: false,
    exigeDestinatario: false,
    observacaoTecnica: "Caso recorrente de não incidência residual.",
  },
  {
    codigo: "DEVOLUCAO",
    nomeOperacao: "Devolução",
    familiaOperacao: "AJUSTE",
    onerosidade: "INDETERMINADA",
    descricaoFuncional:
      "Operação de devolução que pode exigir análise do documento de origem.",
    exigeXml: true,
    exigeEventoPosterior: false,
    exigeDestinatario: true,
    observacaoTecnica:
      "Depende fortemente do documento fiscal referenciado.",
  },
  {
    codigo: "OPERACAO_A_REVISAR",
    nomeOperacao: "Operação a revisar",
    familiaOperacao: "REVISAO",
    onerosidade: "INDETERMINADA",
    descricaoFuncional: "Fallback para casos sem fechamento automático.",
    exigeXml: true,
    exigeEventoPosterior: false,
    exigeDestinatario: false,
    observacaoTecnica: "Direciona o item para revisão ou ambiguidade.",
  },
];

const REGRAS_EXCECAO_BASE: RegraSeed[] = [
  {
    codigo: "R-NAOON-BONIF-EXCEXC-001",
    prioridade: 10,
    nomeRegra: "Bonificação documentada sem evento posterior",
    operacaoCodigo: "BONIFICACAO",
    resultadoRegra: "EXCECAO_DA_EXCECAO",
    ramoOnerosidade: "NAO_ONEROSA",
    cfopLista: "5910,6910",
    exigeConstarDocumento: true,
    exigeEventoPosterior: false,
    fundamentoLegal:
      "Bonificação com tratamento específico conforme cenário documental validado.",
    artigoLc214: "Art. 5º, §1º, I",
    baseCst: "410",
    baseCclassTrib: "410001",
    observacoes:
      "Aplicar quando a bonificação constar adequadamente no documento e não depender de evento posterior.",
  },
  {
    codigo: "R-NAOON-DOACAO-ONG-001",
    prioridade: 20,
    nomeRegra: "Doação para ONG",
    operacaoCodigo: "DOACAO",
    resultadoRegra: "EXCECAO",
    ramoOnerosidade: "NAO_ONEROSA",
    cfopLista: "5910,6910",
    exigeDestinatarioTipo: true,
    destinatarioTipo: "ONG",
    fundamentoLegal:
      "Doação com hipótese específica de não incidência ou imunidade conforme cenário aplicável.",
    artigoLc214: "Art. 6º, VIII",
    baseCst: "410",
    baseCclassTrib: "410003",
    observacoes: "Exigir evidência do destinatário enquadrado.",
  },
  {
    codigo: "R-NAOON-TRANSFERENCIA-FILIAL-001",
    prioridade: 30,
    nomeRegra: "Transferência para filial",
    operacaoCodigo: "TRANSFERENCIA_FILIAL",
    resultadoRegra: "EXCECAO",
    ramoOnerosidade: "NAO_ONEROSA",
    cfopLista: "5152,6152,5151,6151",
    exigeDestinatarioTipo: true,
    destinatarioTipo: "FILIAL",
    fundamentoLegal:
      "Transferência entre estabelecimentos com tratamento específico.",
    artigoLc214: "Art. 6º, II",
    baseCst: "410",
    baseCclassTrib: "410002",
    observacoes:
      "Usar quando a evidência indicar transferência intra-grupo.",
  },
  {
    codigo: "R-ON-EXPORTACAO-001",
    prioridade: 40,
    nomeRegra: "Exportação",
    operacaoCodigo: "EXPORTACAO",
    resultadoRegra: "EXCECAO",
    ramoOnerosidade: "ONEROSA",
    cfopLista: "7101,7102",
    exigeDestinatarioTipo: true,
    destinatarioTipo: "EXTERIOR",
    fundamentoLegal:
      "Exportação com tratamento de imunidade ou não incidência.",
    artigoLc214: "Art. 8º",
    baseCst: "410",
    baseCclassTrib: "410004",
    observacoes: "Exigir consistência da operação de exportação.",
  },
  {
    codigo: "R-NAOON-RESIDUAL-001",
    prioridade: 900,
    nomeRegra: "Não onerosa residual",
    operacaoCodigo: null,
    resultadoRegra: "REGRA_GERAL",
    ramoOnerosidade: "NAO_ONEROSA",
    fundamentoLegal:
      "Regra residual para operações não onerosas sem exceção específica vencedora.",
    artigoLc214: "Art. 5º",
    baseCst: "410",
    baseCclassTrib: "410001",
    observacoes: "Usar apenas quando nenhuma exceção específica vencer.",
  },
  {
    codigo: "R-ON-VENDA-ST-SUBSTITUIDO-001",
    prioridade: 950,
    nomeRegra: "Venda onerosa com ST - contribuinte substituído",
    operacaoCodigo: "VENDA_ST_SUBSTITUIDO",
    resultadoRegra: "REGRA_GERAL",
    ramoOnerosidade: "ONEROSA",
    cfopLista: "5405,6405",
    fundamentoLegal:
      "Venda onerosa conhecida com contexto operacional de substituição tributária na condição de contribuinte substituído.",
    artigoLc214: "Art. 4º",
    baseCst: "000",
    baseCclassTrib: "000001",
    observacoes:
      "Regra transitória até detalhamento tributário específico por cenário ST.",
  },
  {
    codigo: "R-ON-VENDA-RESIDUAL-001",
    prioridade: 1000,
    nomeRegra: "Venda onerosa residual",
    operacaoCodigo: "VENDA_NORMAL",
    resultadoRegra: "REGRA_GERAL",
    ramoOnerosidade: "ONEROSA",
    fundamentoLegal:
      "Regra residual de tributação integral quando não houver exceção específica vencedora.",
    artigoLc214: "Art. 4º",
    baseCst: "000",
    baseCclassTrib: "000001",
    observacoes: "Usar apenas quando nenhuma regra mais específica vencer.",
  },
];

const REGRAS_ANEXO_BASE: RegraAnexoSeed[] = [
  {
    anexo: "I",
    descricaoAnexo: "Cesta básica nacional com alíquota zero",
    operacaoCodigo: "VENDA_NORMAL",
    exigeNcm: true,
    ncmInicio: "04012010",
    ncmFim: "04012010",
    palavrasChaveObrigatorias: "LEITE",
    atividadePermitida: "HIPERMERCADOS|SUPERMERCADOS|ATACADO",
    operacaoPermitida: "VENDA_NORMAL",
    cst: "020",
    cClassTrib: "200003",
    tipoAliquota: "ZERO",
    pRedIbs: 100,
    pRedCbs: 100,
    fundamentoLegal:
      "Fornecimento de produtos destinados à alimentação humana relacionados no Anexo I.",
    artigoLc214: "Art. 127",
    prioridade: 1,
    observacoes: "Aplicar somente quando o NCM e a descrição forem compatíveis.",
  },
  {
    anexo: "VII",
    descricaoAnexo: "Alimentos destinados ao consumo humano com redução de 60%",
    operacaoCodigo: "VENDA_NORMAL",
    exigeNcm: true,
    ncmInicio: "11010010",
    ncmFim: "11010020",
    palavrasChaveObrigatorias: "FARINHA,TRIGO",
    atividadePermitida: "HIPERMERCADOS|SUPERMERCADOS|ATACADO",
    operacaoPermitida: "VENDA_NORMAL",
    cst: "200",
    cClassTrib: "200034",
    tipoAliquota: "REDUZIDA",
    pRedIbs: 60,
    pRedCbs: 60,
    fundamentoLegal:
      "Fornecimento dos alimentos destinados ao consumo humano relacionados no Anexo VII.",
    artigoLc214: "Art. 135",
    prioridade: 5,
    observacoes: "Usar para farinha de trigo e misturas correlatas.",
  },
  {
    anexo: "VII",
    descricaoAnexo: "Alimentos destinados ao consumo humano com redução de 60%",
    operacaoCodigo: "VENDA_NORMAL",
    exigeNcm: true,
    ncmInicio: "07031019",
    ncmFim: "10089999",
    palavrasChaveObrigatorias: "BATATA,CEBOLA,BANANA,ARROZ,FEIJAO",
    atividadePermitida: "HIPERMERCADOS|SUPERMERCADOS|ATACADO",
    operacaoPermitida: "VENDA_NORMAL",
    cst: "200",
    cClassTrib: "200034",
    tipoAliquota: "REDUZIDA",
    pRedIbs: 60,
    pRedCbs: 60,
    fundamentoLegal:
      "Fornecimento dos alimentos destinados ao consumo humano relacionados no Anexo VII.",
    artigoLc214: "Art. 135",
    prioridade: 6,
    observacoes:
      "Regra ampla para alimentos in natura e básicos quando a descrição confirmar consumo humano.",
  },
  {
    anexo: "IX",
    descricaoAnexo: "Produtos agropecuários e aquícolas com benefício específico",
    operacaoCodigo: "VENDA_NORMAL",
    exigeNcm: true,
    ncmInicio: "11010010",
    ncmFim: "11010020",
    palavrasChaveObrigatorias: "TRIGO,FARINHA",
    atividadePermitida: "ATACADO|INDUSTRIA|COOPERATIVA",
    operacaoPermitida: "VENDA_NORMAL",
    cst: "200",
    cClassTrib: "200090",
    tipoAliquota: "REDUZIDA",
    pRedIbs: 60,
    pRedCbs: 60,
    fundamentoLegal:
      "Tratamento do Anexo IX aplicável ao produto conforme contexto operacional específico.",
    artigoLc214: "Art. 130",
    prioridade: 20,
    observacoes:
      "Só usar quando o contexto não for de fornecimento alimentar varejista ao consumo humano.",
  },
  {
    anexo: "XV",
    descricaoAnexo: "Demais hipóteses setoriais específicas",
    operacaoCodigo: "VENDA_NORMAL",
    exigeNcm: false,
    palavrasChaveObrigatorias: "SERVICO,INSUMO",
    atividadePermitida: "INDUSTRIA",
    operacaoPermitida: "VENDA_NORMAL",
    cst: "300",
    cClassTrib: "300001",
    tipoAliquota: "NORMAL",
    pRedIbs: null,
    pRedCbs: null,
    fundamentoLegal:
      "Hipótese setorial residual para contextos específicos sem enquadramento anterior.",
    artigoLc214: "Art. 130",
    prioridade: 50,
    observacoes: "Manter baixa prioridade e revisar quando houver base oficial melhor.",
  },
];

async function upsertFontesNormativas() {
  for (const fonte of FONTES_NORMATIVAS) {
    await prisma.fonteNormativa.upsert({
      where: { codigo: fonte.codigo },
      create: fonte,
      update: {
        nome: fonte.nome,
        tipoFonte: fonte.tipoFonte,
        formato: fonte.formato,
        urlOficial: fonte.urlOficial,
        frequenciaHoras: fonte.frequenciaHoras,
        parser: fonte.parser ?? null,
        descricao: fonte.descricao ?? null,
        ativa: true,
      },
    });
  }
}

async function upsertDestinatariosAlerta() {
  const emailsSuporte = [
    process.env.SUPORTE_EMAIL,
    process.env.EMAIL_SUPORTE,
    process.env.EMAIL_FROM,
  ]
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);

  const unicos = Array.from(new Set(emailsSuporte));

  for (const email of unicos) {
    await prisma.destinatarioAlerta.upsert({
      where: { email },
      create: {
        email,
        nome: "Suporte cClassTrib",
        ativo: true,
      },
      update: {
        ativo: true,
      },
    });
  }
}

async function upsertOperacoesFiscais() {
  for (const operacao of OPERACOES_FISCAIS) {
    await prisma.operacaoFiscal.upsert({
      where: { codigo: operacao.codigo },
      create: operacao,
      update: {
        nomeOperacao: operacao.nomeOperacao,
        familiaOperacao: operacao.familiaOperacao,
        onerosidade: operacao.onerosidade,
        descricaoFuncional: operacao.descricaoFuncional,
        exigeXml: operacao.exigeXml,
        exigeEventoPosterior: operacao.exigeEventoPosterior,
        exigeDestinatario: operacao.exigeDestinatario,
        observacaoTecnica: operacao.observacaoTecnica ?? null,
        ativa: true,
      },
    });
  }
}

async function buscarBaseOficialPublicada(
  cst: string | null,
  cclassTrib: string | null,
) {
  if (!cst || !cclassTrib) return null;

  const versao = await prisma.versaoNormativa.findFirst({
    where: {
      publicada: true,
      fonteNormativa: {
        tipoFonte: "CCLASSTRIB_OFICIAL",
      },
    },
    orderBy: [{ dataPublicada: "desc" }, { createdAt: "desc" }],
    select: { id: true },
  });

  if (!versao) return null;

  return prisma.baseOficialClassificacao.findFirst({
    where: {
      versaoNormativaId: versao.id,
      cstIbsCbs: cst,
      cclassTrib,
    },
    select: { id: true },
  });
}

async function upsertRegrasExcecao() {
  for (const regra of REGRAS_EXCECAO_BASE) {
    const operacao = regra.operacaoCodigo
      ? await prisma.operacaoFiscal.findUnique({
          where: { codigo: regra.operacaoCodigo },
          select: { id: true },
        })
      : null;

    const baseOficial = await buscarBaseOficialPublicada(
      regra.baseCst ?? null,
      regra.baseCclassTrib ?? null,
    );

    await prisma.regraExcecaoTributaria.upsert({
      where: { codigo: regra.codigo },
      create: {
        codigo: regra.codigo,
        prioridade: regra.prioridade,
        nomeRegra: regra.nomeRegra,
        operacaoFiscalId: operacao?.id ?? null,
        resultadoRegra: regra.resultadoRegra,
        ramoOnerosidade: regra.ramoOnerosidade,
        exigeNcm: regra.exigeNcm ?? false,
        ncmInicio: regra.ncmInicio ?? null,
        ncmFim: regra.ncmFim ?? null,
        cfopLista: regra.cfopLista ?? null,
        exigeDestinatarioTipo: regra.exigeDestinatarioTipo ?? false,
        destinatarioTipo: regra.destinatarioTipo ?? null,
        exigeEventoPosterior: regra.exigeEventoPosterior ?? false,
        exigeConstarDocumento: regra.exigeConstarDocumento ?? false,
        exigeContraprestacao: regra.exigeContraprestacao ?? null,
        fundamentoLegal: regra.fundamentoLegal ?? null,
        artigoLc214: regra.artigoLc214 ?? null,
        baseOficialClassificacaoId: baseOficial?.id ?? null,
        observacoes: regra.observacoes ?? null,
        ativa: true,
      },
      update: {
        prioridade: regra.prioridade,
        nomeRegra: regra.nomeRegra,
        operacaoFiscalId: operacao?.id ?? null,
        resultadoRegra: regra.resultadoRegra,
        ramoOnerosidade: regra.ramoOnerosidade,
        exigeNcm: regra.exigeNcm ?? false,
        ncmInicio: regra.ncmInicio ?? null,
        ncmFim: regra.ncmFim ?? null,
        cfopLista: regra.cfopLista ?? null,
        exigeDestinatarioTipo: regra.exigeDestinatarioTipo ?? false,
        destinatarioTipo: regra.destinatarioTipo ?? null,
        exigeEventoPosterior: regra.exigeEventoPosterior ?? false,
        exigeConstarDocumento: regra.exigeConstarDocumento ?? false,
        exigeContraprestacao: regra.exigeContraprestacao ?? null,
        fundamentoLegal: regra.fundamentoLegal ?? null,
        artigoLc214: regra.artigoLc214 ?? null,
        baseOficialClassificacaoId: baseOficial?.id ?? null,
        observacoes: regra.observacoes ?? null,
        ativa: true,
      },
    });
  }
}

async function upsertRegrasAnexoContextual() {
  for (const regra of REGRAS_ANEXO_BASE) {
    const operacao = regra.operacaoCodigo
      ? await prisma.operacaoFiscal.findUnique({
          where: { codigo: regra.operacaoCodigo },
          select: { id: true },
        })
      : null;

    const baseOficial = await buscarBaseOficialPublicada(
      regra.cst,
      regra.cClassTrib,
    );

    const existente = await prisma.regraAnexoContextual.findFirst({
      where: {
        anexo: regra.anexo,
        descricaoAnexo: regra.descricaoAnexo,
        operacaoFiscalId: operacao?.id ?? null,
        prioridade: regra.prioridade,
      },
      select: { id: true },
    });

    if (existente) {
      await prisma.regraAnexoContextual.update({
        where: { id: existente.id },
        data: {
          anexo: regra.anexo,
          descricaoAnexo: regra.descricaoAnexo,
          operacaoFiscalId: operacao?.id ?? null,
          exigeNcm: regra.exigeNcm ?? false,
          ncmInicio: regra.ncmInicio ?? null,
          ncmFim: regra.ncmFim ?? null,
          palavrasChaveObrigatorias: regra.palavrasChaveObrigatorias ?? null,
          palavrasChaveExcludentes: regra.palavrasChaveExcludentes ?? null,
          atividadePermitida: regra.atividadePermitida ?? null,
          operacaoPermitida: regra.operacaoPermitida ?? null,
          exigeDestinacao: regra.exigeDestinacao ?? false,
          destinacao: regra.destinacao ?? null,
          cst: regra.cst,
          cClassTrib: regra.cClassTrib,
          tipoAliquota: regra.tipoAliquota,
          pRedIbs: regra.pRedIbs ?? null,
          pRedCbs: regra.pRedCbs ?? null,
          fundamentoLegal: regra.fundamentoLegal,
          artigoLc214: regra.artigoLc214 ?? null,
          prioridade: regra.prioridade,
          baseOficialClassificacaoId: baseOficial?.id ?? null,
          observacoes: regra.observacoes ?? null,
          ativa: true,
        },
      });
    } else {
      await prisma.regraAnexoContextual.create({
        data: {
          anexo: regra.anexo,
          descricaoAnexo: regra.descricaoAnexo,
          operacaoFiscalId: operacao?.id ?? null,
          exigeNcm: regra.exigeNcm ?? false,
          ncmInicio: regra.ncmInicio ?? null,
          ncmFim: regra.ncmFim ?? null,
          palavrasChaveObrigatorias: regra.palavrasChaveObrigatorias ?? null,
          palavrasChaveExcludentes: regra.palavrasChaveExcludentes ?? null,
          atividadePermitida: regra.atividadePermitida ?? null,
          operacaoPermitida: regra.operacaoPermitida ?? null,
          exigeDestinacao: regra.exigeDestinacao ?? false,
          destinacao: regra.destinacao ?? null,
          cst: regra.cst,
          cClassTrib: regra.cClassTrib,
          tipoAliquota: regra.tipoAliquota,
          pRedIbs: regra.pRedIbs ?? null,
          pRedCbs: regra.pRedCbs ?? null,
          fundamentoLegal: regra.fundamentoLegal,
          artigoLc214: regra.artigoLc214 ?? null,
          prioridade: regra.prioridade,
          baseOficialClassificacaoId: baseOficial?.id ?? null,
          observacoes: regra.observacoes ?? null,
          ativa: true,
        },
      });
    }
  }
}

export async function bootstrapBibliotecaCClassTrib() {
  await upsertFontesNormativas();
  await upsertDestinatariosAlerta();
  await upsertOperacoesFiscais();
  await garantirVersaoNormativaInicialPublicada();
  await registrarTabelaNcmComoDownloadComplementar();
  await upsertRegrasExcecao();
  await upsertRegrasAnexoContextual();

  const [
    fontesNormativas,
    destinatariosAlerta,
    operacoesFiscais,
    regrasExcecaoTributaria,
    regrasAnexoContextual,
    versoesNormativasPublicadas,
    baseOficialClassificacao,
    ncmAnexosVigentes,
  ] = await Promise.all([
    Promise.resolve(0), // fonteNormativa ignorada
    prisma.destinatarioAlerta.count(),
    prisma.operacaoFiscal.count(),
    prisma.regraExcecaoTributaria.count(),
    prisma.regraAnexoContextual.count(),
    prisma.versaoNormativa.count({
      where: { publicada: true },
    }),
    prisma.baseOficialClassificacao.count(),
    prisma.ncmAnexoVigente.count(),
  ]);

  return {
    ok: true,
    resumo: {
      fontesNormativas,
      destinatariosAlerta,
      operacoesFiscais,
      regrasExcecaoTributaria,
      regrasAnexoContextual,
      versoesNormativasPublicadas,
      baseOficialClassificacao,
      ncmAnexosVigentes,
    },
  };
}

export async function precisaBootstrapBiblioteca() {
  const [
    fontesNormativas,
    operacoesFiscais,
    regrasExcecaoTributaria,
    regrasAnexoContextual,
    versoesNormativasPublicadas,
    baseOficialClassificacao,
  ] = await Promise.all([
    Promise.resolve(0), // fonteNormativa ignorada
    prisma.operacaoFiscal.count(),
    prisma.regraExcecaoTributaria.count(),
    prisma.regraAnexoContextual.count(),
    prisma.versaoNormativa.count({
      where: { publicada: true },
    }),
    prisma.baseOficialClassificacao.count(),
  ]);

  return (
    fontesNormativas === 0 ||
    operacoesFiscais === 0 ||
    regrasExcecaoTributaria === 0 ||
    regrasAnexoContextual === 0 ||
    versoesNormativasPublicadas === 0 ||
    baseOficialClassificacao === 0
  );
}