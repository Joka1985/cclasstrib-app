import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type LinhaBaseInicial = {
  cstIbsCbs: string;
  descricaoCst: string;
  cclassTrib: string;
  nomeCclassTrib: string;
  descricaoCclassTrib?: string | null;
  lcRedacao?: string | null;
  artigoLc214?: string | null;
  tipoAliquota?: string | null;
  pRedIbs?: number | null;
  pRedCbs?: number | null;
  indGTribRegular?: boolean;
  indGCredPresOper?: boolean;
  indGMonoPadrao?: boolean;
  indGMonoReten?: boolean;
  indGMonoRet?: boolean;
  indGMonoDif?: boolean;
  indGEstornoCred?: boolean;
  dIniVig?: Date | null;
  dFimVig?: Date | null;
  dataAtualizacaoFonte?: Date | null;
  indNFe?: boolean;
  indNFCe?: boolean;
  indNFSe?: boolean;
  indCTe?: boolean;
  indNFCom?: boolean;
  linkNormativo?: string | null;
  anexo?: string | null;
};

const VERSAO_INICIAL = "SEED-INICIAL-2026-03-26";

const LINHAS_BASE_INICIAL: LinhaBaseInicial[] = [
  {
    cstIbsCbs: "000",
    descricaoCst: "Tributação integral",
    cclassTrib: "000001",
    nomeCclassTrib: "Situações tributadas integralmente pelo IBS e CBS.",
    descricaoCclassTrib: "Situações tributadas integralmente pelo IBS e CBS.",
    artigoLc214: "Art. 4º",
    tipoAliquota: "Padrão",
    pRedIbs: 0,
    pRedCbs: 0,
    indGTribRegular: false,
    indGCredPresOper: false,
    indGMonoPadrao: false,
    indGMonoReten: false,
    indGMonoRet: false,
    indGMonoDif: false,
    indGEstornoCred: false,
    dIniVig: new Date("2026-01-01T00:00:00.000Z"),
    dataAtualizacaoFonte: new Date("2026-03-26T00:00:00.000Z"),
    indNFe: true,
    indNFCe: true,
    indNFSe: true,
    indCTe: true,
    indNFCom: true,
    linkNormativo: "https://www.planalto.gov.br/",
  },
  {
    cstIbsCbs: "410",
    descricaoCst: "Não incidência / imunidade",
    cclassTrib: "410001",
    nomeCclassTrib: "Não incidência residual em operação não onerosa.",
    descricaoCclassTrib:
      "Operações não onerosas sem exceção específica mais favorável.",
    artigoLc214: "Art. 5º, §1º, I",
    tipoAliquota: "Sem alíquota",
    pRedIbs: 0,
    pRedCbs: 0,
    dIniVig: new Date("2026-01-01T00:00:00.000Z"),
    dataAtualizacaoFonte: new Date("2026-03-26T00:00:00.000Z"),
    indNFe: true,
    indNFCe: true,
    indNFSe: true,
    indCTe: false,
    indNFCom: false,
    linkNormativo: "https://www.planalto.gov.br/",
  },
  {
    cstIbsCbs: "410",
    descricaoCst: "Não incidência / imunidade",
    cclassTrib: "410002",
    nomeCclassTrib: "Transferência para filial.",
    descricaoCclassTrib:
      "Transferência entre estabelecimentos com tratamento de não incidência.",
    artigoLc214: "Art. 6º, II",
    tipoAliquota: "Sem alíquota",
    pRedIbs: 0,
    pRedCbs: 0,
    dIniVig: new Date("2026-01-01T00:00:00.000Z"),
    dataAtualizacaoFonte: new Date("2026-03-26T00:00:00.000Z"),
    indNFe: true,
    indNFCe: false,
    indNFSe: false,
    indCTe: false,
    indNFCom: false,
    linkNormativo: "https://www.planalto.gov.br/",
  },
  {
    cstIbsCbs: "410",
    descricaoCst: "Não incidência / imunidade",
    cclassTrib: "410003",
    nomeCclassTrib: "Doação para ONG / hipótese específica.",
    descricaoCclassTrib:
      "Não incidência/imunidade em cenário específico dependente da operação.",
    artigoLc214: "Art. 6º, VIII",
    tipoAliquota: "Sem alíquota",
    pRedIbs: 0,
    pRedCbs: 0,
    dIniVig: new Date("2026-01-01T00:00:00.000Z"),
    dataAtualizacaoFonte: new Date("2026-03-26T00:00:00.000Z"),
    indNFe: true,
    indNFCe: false,
    indNFSe: false,
    indCTe: false,
    indNFCom: false,
    linkNormativo: "https://www.planalto.gov.br/",
  },
  {
    cstIbsCbs: "410",
    descricaoCst: "Não incidência / imunidade",
    cclassTrib: "410004",
    nomeCclassTrib: "Exportação.",
    descricaoCclassTrib: "Imunidade nas operações de exportação.",
    artigoLc214: "Art. 8º",
    tipoAliquota: "Sem alíquota",
    pRedIbs: 0,
    pRedCbs: 0,
    dIniVig: new Date("2026-01-01T00:00:00.000Z"),
    dataAtualizacaoFonte: new Date("2026-03-26T00:00:00.000Z"),
    indNFe: true,
    indNFCe: false,
    indNFSe: true,
    indCTe: true,
    indNFCom: false,
    linkNormativo: "https://www.planalto.gov.br/",
  },
  {
    cstIbsCbs: "200",
    descricaoCst: "Alíquota reduzida",
    cclassTrib: "200013",
    nomeCclassTrib: "Absorventes higiênicos.",
    descricaoCclassTrib: "Redução de 100% conforme art. 147.",
    artigoLc214: "Art. 147",
    tipoAliquota: "Redução 100%",
    pRedIbs: 100,
    pRedCbs: 100,
    dIniVig: new Date("2026-01-01T00:00:00.000Z"),
    dataAtualizacaoFonte: new Date("2026-03-26T00:00:00.000Z"),
    indNFe: true,
    indNFCe: true,
    indNFSe: false,
    indCTe: false,
    indNFCom: false,
    linkNormativo: "https://www.planalto.gov.br/",
  },
  {
    cstIbsCbs: "200",
    descricaoCst: "Alíquota reduzida",
    cclassTrib: "200003",
    nomeCclassTrib: "Cesta básica / redução 100%.",
    descricaoCclassTrib: "Benefício específico vinculado a anexo aplicável.",
    artigoLc214: "Anexo I",
    tipoAliquota: "Redução 100%",
    pRedIbs: 100,
    pRedCbs: 100,
    dIniVig: new Date("2026-01-01T00:00:00.000Z"),
    dataAtualizacaoFonte: new Date("2026-03-26T00:00:00.000Z"),
    indNFe: true,
    indNFCe: true,
    indNFSe: false,
    indCTe: false,
    indNFCom: false,
    linkNormativo: "https://www.planalto.gov.br/",
  },
  {
    cstIbsCbs: "200",
    descricaoCst: "Alíquota reduzida",
    cclassTrib: "200028",
    nomeCclassTrib: "Serviços de educação.",
    descricaoCclassTrib: "Redução de 60% para hipótese específica.",
    artigoLc214: "Anexo II",
    tipoAliquota: "Redução 60%",
    pRedIbs: 60,
    pRedCbs: 60,
    dIniVig: new Date("2026-01-01T00:00:00.000Z"),
    dataAtualizacaoFonte: new Date("2026-03-26T00:00:00.000Z"),
    indNFe: false,
    indNFCe: false,
    indNFSe: true,
    indCTe: false,
    indNFCom: false,
    linkNormativo: "https://www.planalto.gov.br/",
  },
  {
    cstIbsCbs: "200",
    descricaoCst: "Alíquota reduzida",
    cclassTrib: "200029",
    nomeCclassTrib: "Serviços de saúde.",
    descricaoCclassTrib: "Redução de 60% para hipótese específica.",
    artigoLc214: "Anexo III",
    tipoAliquota: "Redução 60%",
    pRedIbs: 60,
    pRedCbs: 60,
    dIniVig: new Date("2026-01-01T00:00:00.000Z"),
    dataAtualizacaoFonte: new Date("2026-03-26T00:00:00.000Z"),
    indNFe: false,
    indNFCe: false,
    indNFSe: true,
    indCTe: false,
    indNFCom: false,
    linkNormativo: "https://www.planalto.gov.br/",
  },
];

function hashString(valor: string) {
  let hash = 0;
  for (let i = 0; i < valor.length; i += 1) {
    hash = (hash * 31 + valor.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function hashLinha(linha: LinhaBaseInicial) {
  return hashString(
    JSON.stringify({
      ...linha,
      dIniVig: linha.dIniVig?.toISOString() ?? null,
      dFimVig: linha.dFimVig?.toISOString() ?? null,
      dataAtualizacaoFonte: linha.dataAtualizacaoFonte?.toISOString() ?? null,
    })
  );
}

export async function garantirVersaoNormativaInicialPublicada() {
  const fonte = await prisma.fonteNormativa.findFirst({
    where: {
      tipoFonte: "CCLASSTRIB_OFICIAL",
      ativa: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!fonte) {
    throw new Error(
      "Não existe fonte normativa ativa do tipo CCLASSTRIB_OFICIAL para publicar a base inicial."
    );
  }

  const publicada = await prisma.versaoNormativa.findFirst({
    where: {
      fonteNormativaId: fonte.id,
      publicada: true,
    },
    orderBy: [{ dataPublicada: "desc" }, { createdAt: "desc" }],
  });

  if (publicada) {
    return {
      ok: true,
      mensagem: "Já existe versão normativa publicada.",
      versao: publicada.versaoIdentificada,
    };
  }

  const jsonLinhas = JSON.stringify(LINHAS_BASE_INICIAL);

  const download = await prisma.downloadNormativo.create({
    data: {
      fonteNormativaId: fonte.id,
      statusAtualizacao: "PUBLICADO",
      nomeArquivo: `base-oficial-inicial-${VERSAO_INICIAL}.json`,
      mimeType: "application/json",
      hashArquivo: hashString(jsonLinhas),
      tamanhoBytes: jsonLinhas.length,
      dataDeteccao: new Date(),
      dataBaixou: new Date(),
      dataProcessou: new Date(),
      payloadMeta: {
        origem: "seed_inicial",
        versao: VERSAO_INICIAL,
        quantidadeLinhas: LINHAS_BASE_INICIAL.length,
      },
      arquivoBrutoBase64: null,
    },
  });

  const versao = await prisma.versaoNormativa.create({
    data: {
      fonteNormativaId: fonte.id,
      downloadNormativoId: download.id,
      versaoIdentificada: VERSAO_INICIAL,
      statusAtualizacao: "PUBLICADO",
      dataPublicacao: new Date(),
      dataVigenciaInicio: new Date("2026-01-01T00:00:00.000Z"),
      hashConteudo: hashString(jsonLinhas),
      resumo:
        "Versão normativa inicial publicada automaticamente para bootstrap do motor cClassTrib.",
      payloadResumo: {
        origem: "seed_inicial",
        quantidadeLinhas: LINHAS_BASE_INICIAL.length,
      },
      publicada: true,
      dataPublicada: new Date(),
    },
  });

  await prisma.baseOficialClassificacao.createMany({
    data: LINHAS_BASE_INICIAL.map((linha) => ({
      versaoNormativaId: versao.id,
      cstIbsCbs: linha.cstIbsCbs,
      descricaoCst: linha.descricaoCst,
      cclassTrib: linha.cclassTrib,
      nomeCclassTrib: linha.nomeCclassTrib,
      descricaoCclassTrib: linha.descricaoCclassTrib ?? null,
      lcRedacao: linha.lcRedacao ?? null,
      artigoLc214: linha.artigoLc214 ?? null,
      tipoAliquota: linha.tipoAliquota ?? null,
      pRedIbs:
        linha.pRedIbs == null ? null : new Prisma.Decimal(linha.pRedIbs),
      pRedCbs:
        linha.pRedCbs == null ? null : new Prisma.Decimal(linha.pRedCbs),
      indGTribRegular: linha.indGTribRegular ?? false,
      indGCredPresOper: linha.indGCredPresOper ?? false,
      indGMonoPadrao: linha.indGMonoPadrao ?? false,
      indGMonoReten: linha.indGMonoReten ?? false,
      indGMonoRet: linha.indGMonoRet ?? false,
      indGMonoDif: linha.indGMonoDif ?? false,
      indGEstornoCred: linha.indGEstornoCred ?? false,
      dIniVig: linha.dIniVig ?? null,
      dFimVig: linha.dFimVig ?? null,
      dataAtualizacaoFonte: linha.dataAtualizacaoFonte ?? null,
      indNFe: linha.indNFe ?? false,
      indNFCe: linha.indNFCe ?? false,
      indNFSe: linha.indNFSe ?? false,
      indCTe: linha.indCTe ?? false,
      indNFCom: linha.indNFCom ?? false,
      linkNormativo: linha.linkNormativo ?? null,
      anexo: linha.anexo ?? null,
      hashLinha: hashLinha(linha),
    })),
  });

  await prisma.fonteNormativa.update({
    where: { id: fonte.id },
    data: {
      ultimaVersaoPublicada: versao.versaoIdentificada,
      ultimaVerificacaoEm: new Date(),
    },
  });

  return {
    ok: true,
    mensagem: "Versão normativa inicial publicada com sucesso.",
    versao: versao.versaoIdentificada,
    quantidadeLinhas: LINHAS_BASE_INICIAL.length,
  };
}