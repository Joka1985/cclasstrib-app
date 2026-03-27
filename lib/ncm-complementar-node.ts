import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";

type TabelaNcmJson = {
  Data_Ultima_Atualizacao_NCM?: string;
  Ato?: string;
  Nomenclaturas?: Array<{
    Codigo?: string;
    Descricao?: string;
    Data_Inicio?: string;
    Data_Fim?: string;
    Tipo_Ato_Ini?: string;
    Numero_Ato_Ini?: string;
    Ano_Ato_Ini?: string;
  }>;
};

export type RegistroNcmComplementar = {
  codigoOriginal: string;
  codigoNormalizado: string;
  descricao: string;
  dataInicio: string | null;
  dataFim: string | null;
  nivelCodigo: number;
  ato: string | null;
};

const NOME_ARQUIVO_TABELA_NCM = "Tabela_NCM_Vigente_20260327.json";

const CAMINHOS_CANDIDATOS_TABELA_NCM = [
  path.join(process.cwd(), "data", NOME_ARQUIVO_TABELA_NCM),
  path.join(process.cwd(), "normativos", NOME_ARQUIVO_TABELA_NCM),
  path.join(process.cwd(), NOME_ARQUIVO_TABELA_NCM),
];

let cacheTabelaNcm: RegistroNcmComplementar[] | null = null;

function hashString(valor: string) {
  let hash = 0;
  for (let i = 0; i < valor.length; i += 1) {
    hash = (hash * 31 + valor.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function normalizarCodigoNcm(valor?: string | null) {
  return String(valor ?? "").replace(/\D/g, "");
}

function nivelCodigoNcm(valor: string) {
  return valor.length;
}

async function encontrarArquivoTabelaNcm() {
  for (const caminho of CAMINHOS_CANDIDATOS_TABELA_NCM) {
    try {
      await fs.access(caminho);
      return caminho;
    } catch {
      continue;
    }
  }
  return null;
}

export async function carregarTabelaNcmComplementar() {
  if (cacheTabelaNcm) {
    return cacheTabelaNcm;
  }

  const caminho = await encontrarArquivoTabelaNcm();

  if (!caminho) {
    cacheTabelaNcm = [];
    return cacheTabelaNcm;
  }

  const conteudo = await fs.readFile(caminho, "utf-8");
  const json = JSON.parse(conteudo) as TabelaNcmJson;
  const nomenclaturas = Array.isArray(json.Nomenclaturas)
    ? json.Nomenclaturas
    : [];

  cacheTabelaNcm = nomenclaturas
    .map((item) => {
      const codigoOriginal = String(item.Codigo ?? "").trim();
      const codigoNormalizado = normalizarCodigoNcm(codigoOriginal);

      if (!codigoOriginal || !codigoNormalizado) return null;

      return {
        codigoOriginal,
        codigoNormalizado,
        descricao: String(item.Descricao ?? "").trim(),
        dataInicio: item.Data_Inicio ? String(item.Data_Inicio) : null,
        dataFim: item.Data_Fim ? String(item.Data_Fim) : null,
        nivelCodigo: nivelCodigoNcm(codigoNormalizado),
        ato:
          item.Tipo_Ato_Ini && item.Numero_Ato_Ini && item.Ano_Ato_Ini
            ? `${item.Tipo_Ato_Ini} ${item.Numero_Ato_Ini}/${item.Ano_Ato_Ini}`
            : null,
      } satisfies RegistroNcmComplementar;
    })
    .filter((item): item is RegistroNcmComplementar => item !== null)
    .sort((a, b) => b.nivelCodigo - a.nivelCodigo);

  return cacheTabelaNcm;
}

export async function obterRegistroNcmComplementar(ncm?: string | null) {
  const ncmNormalizado = normalizarCodigoNcm(ncm);

  if (!ncmNormalizado) return null;

  const tabela = await carregarTabelaNcmComplementar();

  return (
    tabela.find((item) => ncmNormalizado.startsWith(item.codigoNormalizado)) ??
    null
  );
}

export async function registrarTabelaNcmComoDownloadComplementar() {
  const caminho = await encontrarArquivoTabelaNcm();

  if (!caminho) {
    return {
      ok: false,
      mensagem:
        "Tabela_NCM_Vigente_20260327.json não encontrada no projeto. Registro complementar ignorado.",
      quantidadeRegistros: 0,
    };
  }

  const conteudo = await fs.readFile(caminho, "utf-8");
  const json = JSON.parse(conteudo) as TabelaNcmJson;
  const nomenclaturas = Array.isArray(json.Nomenclaturas)
    ? json.Nomenclaturas
    : [];

  const fonte = await prisma.fonteNormativa.findFirst({
    where: {
      OR: [
        { tipoFonte: "NCM_BENEFICIO" },
        { codigo: "TABELA_NCM_VIGENTE_RFB" },
        { codigo: "TABELA_NCM_VIGENTE_20260327" },
      ],
    },
    orderBy: { createdAt: "asc" },
  });

  if (!fonte) {
    return {
      ok: false,
      mensagem:
        "Nenhuma fonte normativa do tipo NCM_BENEFICIO encontrada para registrar a tabela complementar.",
      quantidadeRegistros: nomenclaturas.length,
    };
  }

  const hashArquivo = hashString(conteudo);

  const downloadExistente = await prisma.downloadNormativo.findFirst({
    where: {
      fonteNormativaId: fonte.id,
      hashArquivo,
    },
    orderBy: { createdAt: "desc" },
  });

  if (downloadExistente) {
    return {
      ok: true,
      mensagem: "Tabela NCM complementar já registrada.",
      quantidadeRegistros: nomenclaturas.length,
    };
  }

  await prisma.downloadNormativo.create({
    data: {
      fonteNormativaId: fonte.id,
      statusAtualizacao: "PUBLICADO",
      nomeArquivo: NOME_ARQUIVO_TABELA_NCM,
      mimeType: "application/json",
      hashArquivo,
      tamanhoBytes: conteudo.length,
      dataDeteccao: new Date(),
      dataBaixou: new Date(),
      dataProcessou: new Date(),
      payloadMeta: {
        origem: "arquivo_local_projeto",
        dataUltimaAtualizacaoNcm:
          json.Data_Ultima_Atualizacao_NCM ?? null,
        ato: json.Ato ?? null,
        quantidadeRegistros: nomenclaturas.length,
      },
      arquivoBrutoBase64: null,
    },
  });

  await prisma.fonteNormativa.update({
    where: { id: fonte.id },
    data: {
      ultimaVerificacaoEm: new Date(),
    },
  });

  return {
    ok: true,
    mensagem: "Tabela NCM complementar registrada com sucesso.",
    quantidadeRegistros: nomenclaturas.length,
  };
}