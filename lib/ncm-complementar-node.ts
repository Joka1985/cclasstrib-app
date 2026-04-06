import "server-only";

import crypto from "crypto";
import { prisma } from "@/lib/prisma";

type LinhaNcmBruta = Record<string, unknown>;

type LinhaNcmNormalizada = {
  ordem: number | null;
  capitulo: string | null;
  codigoOriginal: string | null;
  codigoNcm: string;
  anexoLc214: string | null;
  anexoI: string | null;
  anexoIV: string | null;
  anexoV: string | null;
  anexoVI: string | null;
  anexoVII: string | null;
  anexoVIII: string | null;
  anexoIX: string | null;
  anexoXI: string | null;
  anexoXII: string | null;
  anexoXIII: string | null;
  anexoXIV: string | null;
  anexoXV: string | null;
  descricao: string | null;
  dataInicio: Date | null;
  dataFim: Date | null;
  atoLegalInicio: string | null;
  numeroAto: string | null;
  anoAto: string | null;
  observacoes: string | null;
  hashLinha: string;
};

const CODIGO_FONTE = "TABELA_NCM_VIGENTE_20260327";

const CANDIDATOS_ARQUIVO = [
  "Tabela_NCM_Vigente.xlsx",
  "Tabela NCM Vigente.xlsx",
  "tabela_ncm_vigente.xlsx",
  "Tabela_NCM_Vigente.csv",
  "Tabela_NCM_Vigente.json",
  "data/Tabela_NCM_Vigente.xlsx",
  "data/Tabela_NCM_Vigente.csv",
  "data/Tabela_NCM_Vigente.json",
  "dados/Tabela_NCM_Vigente.xlsx",
  "dados/Tabela_NCM_Vigente.csv",
  "dados/Tabela_NCM_Vigente.json",
  "storage/Tabela_NCM_Vigente.xlsx",
  "storage/Tabela_NCM_Vigente.csv",
  "storage/Tabela_NCM_Vigente.json",
  "/mnt/data/Tabela_NCM_Vigente.xlsx",
];

function somenteNumeros(valor?: unknown) {
  return String(valor ?? "").replace(/\D/g, "");
}

function texto(valor?: unknown) {
  const v = String(valor ?? "").trim();
  return v.length ? v : null;
}

function textoUpper(valor?: unknown) {
  const v = texto(valor);
  return v ? v.toUpperCase() : null;
}

function numero(valor?: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizarCodigoNcm(valor?: unknown) {
  const digits = somenteNumeros(valor);
  return digits.length ? digits : null;
}

function normalizarCabecalho(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function obterValor(
  linha: LinhaNcmBruta,
  chaves: string[],
): unknown {
  const mapa = new Map<string, unknown>();

  for (const [chave, valor] of Object.entries(linha)) {
    mapa.set(normalizarCabecalho(chave), valor);
  }

  for (const chave of chaves) {
    const valor = mapa.get(normalizarCabecalho(chave));
    if (valor !== undefined && valor !== null && String(valor).trim() !== "") {
      return valor;
    }
  }

  return null;
}

function parseData(valor?: unknown): Date | null {
  if (!valor) return null;

  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return valor;
  }

  const bruto = String(valor).trim();
  if (!bruto) return null;

  const iso = new Date(bruto);
  if (!Number.isNaN(iso.getTime())) return iso;

  const m = bruto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const [, dd, mm, yyyy] = m;
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }

  return null;
}

function montarAnexoLc214(params: {
  anexoLc214: string | null;
  anexoI: string | null;
  anexoIV: string | null;
  anexoV: string | null;
  anexoVI: string | null;
  anexoVII: string | null;
  anexoVIII: string | null;
  anexoIX: string | null;
  anexoXI: string | null;
  anexoXII: string | null;
  anexoXIII: string | null;
  anexoXIV: string | null;
  anexoXV: string | null;
}) {
  if (params.anexoLc214) return params.anexoLc214;

  const anexos: string[] = [];

  if (params.anexoI) anexos.push("I");
  if (params.anexoIV) anexos.push("IV");
  if (params.anexoV) anexos.push("V");
  if (params.anexoVI) anexos.push("VI");
  if (params.anexoVII) anexos.push("VII");
  if (params.anexoVIII) anexos.push("VIII");
  if (params.anexoIX) anexos.push("IX");
  if (params.anexoXI) anexos.push("XI");
  if (params.anexoXII) anexos.push("XII");
  if (params.anexoXIII) anexos.push("XIII");
  if (params.anexoXIV) anexos.push("XIV");
  if (params.anexoXV) anexos.push("XV");

  return anexos.length ? anexos.join(" e ") : null;
}

function hashObjeto(obj: unknown) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(obj))
    .digest("hex");
}

function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function carregarFsPath() {
  const [{ promises: fs }, path] = await Promise.all([
    import("fs"),
    import("path"),
  ]);

  return { fs, path: path.default };
}

async function localizarArquivoTabela() {
  const { fs, path } = await carregarFsPath();

  for (const candidato of CANDIDATOS_ARQUIVO) {
    const absoluto = path.isAbsolute(candidato)
      ? candidato
      : path.join(process.cwd(), candidato);

    try {
      await fs.access(absoluto);
      return absoluto;
    } catch {
      // continua
    }
  }

  return null;
}

async function lerPlanilhaXlsx(caminhoArquivo: string): Promise<LinhaNcmBruta[]> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.readFile(caminhoArquivo, {
    cellDates: true,
    raw: false,
  });

  const nomeAba = workbook.SheetNames[0];
  if (!nomeAba) return [];

  const worksheet = workbook.Sheets[nomeAba];
  if (!worksheet) return [];

  return XLSX.utils.sheet_to_json<LinhaNcmBruta>(worksheet, {
    defval: null,
    raw: false,
  });
}

async function lerArquivoJson(caminhoArquivo: string): Promise<LinhaNcmBruta[]> {
  const { fs } = await carregarFsPath();
  const conteudo = await fs.readFile(caminhoArquivo, "utf-8");
  const json = JSON.parse(conteudo);

  if (Array.isArray(json)) return json as LinhaNcmBruta[];
  if (Array.isArray(json?.linhas)) return json.linhas as LinhaNcmBruta[];

  return [];
}

async function lerArquivoCsv(caminhoArquivo: string): Promise<LinhaNcmBruta[]> {
  const { fs } = await carregarFsPath();
  const conteudo = await fs.readFile(caminhoArquivo, "utf-8");

  const linhas = conteudo
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter(Boolean);

  if (!linhas.length) return [];

  const separar = (linha: string) =>
    linha
      .split(";")
      .map((v) => v.trim().replace(/^"|"$/g, ""));

  const cabecalho = separar(linhas[0]);
  const dados = linhas.slice(1);

  return dados.map((linha) => {
    const colunas = separar(linha);
    const obj: LinhaNcmBruta = {};

    cabecalho.forEach((chave, idx) => {
      obj[chave] = colunas[idx] ?? null;
    });

    return obj;
  });
}

async function lerTabelaNcmBruta(caminhoArquivo: string): Promise<LinhaNcmBruta[]> {
  const ext = caminhoArquivo.toLowerCase();

  if (ext.endsWith(".xlsx") || ext.endsWith(".xls")) {
    return lerPlanilhaXlsx(caminhoArquivo);
  }

  if (ext.endsWith(".json")) {
    return lerArquivoJson(caminhoArquivo);
  }

  if (ext.endsWith(".csv")) {
    return lerArquivoCsv(caminhoArquivo);
  }

  throw new Error(`Formato de arquivo não suportado para tabela NCM: ${caminhoArquivo}`);
}

function normalizarLinhaNcm(linha: LinhaNcmBruta): LinhaNcmNormalizada | null {
  const codigoOriginal = texto(
    obterValor(linha, ["Código", "Codigo", "CODIGO", "NCM", "Código NCM"]),
  );

  const codigoNcm = normalizarCodigoNcm(codigoOriginal);
  if (!codigoNcm) return null;

  const anexoI = texto(obterValor(linha, ["I"]));
  const anexoIV = texto(obterValor(linha, ["IV"]));
  const anexoV = texto(obterValor(linha, ["V"]));
  const anexoVI = texto(obterValor(linha, ["VI"]));
  const anexoVII = texto(obterValor(linha, ["VII"]));
  const anexoVIII = texto(obterValor(linha, ["VIII"]));
  const anexoIX = texto(obterValor(linha, ["IX"]));
  const anexoXI = texto(obterValor(linha, ["XI"]));
  const anexoXII = texto(obterValor(linha, ["XII"]));
  const anexoXIII = texto(obterValor(linha, ["XIII"]));
  const anexoXIV = texto(obterValor(linha, ["XIV"]));
  const anexoXV = texto(obterValor(linha, ["XV"]));

  const anexoLc214 = textoUpper(
    obterValor(linha, ["Anexo_LC214", "Anexo LC214", "Anexo LC 214"]),
  );

  const normalizada: LinhaNcmNormalizada = {
    ordem: numero(obterValor(linha, ["Ordem", "ORDEM"])),
    capitulo: texto(obterValor(linha, ["Capitulo", "Capítulo", "CAPITULO"])),
    codigoOriginal,
    codigoNcm,
    anexoLc214: montarAnexoLc214({
      anexoLc214,
      anexoI,
      anexoIV,
      anexoV,
      anexoVI,
      anexoVII,
      anexoVIII,
      anexoIX,
      anexoXI,
      anexoXII,
      anexoXIII,
      anexoXIV,
      anexoXV,
    }),
    anexoI,
    anexoIV,
    anexoV,
    anexoVI,
    anexoVII,
    anexoVIII,
    anexoIX,
    anexoXI,
    anexoXII,
    anexoXIII,
    anexoXIV,
    anexoXV,
    descricao: texto(obterValor(linha, ["Descrição", "Descricao", "DESCRICAO"])),
    dataInicio: parseData(
      obterValor(linha, ["Data Início", "Data Inicio", "DATA INICIO"]),
    ),
    dataFim: parseData(
      obterValor(linha, ["Data Fim", "DATA FIM"]),
    ),
    atoLegalInicio: texto(
      obterValor(linha, ["Ato Legal Início", "Ato Legal Inicio", "ATO LEGAL INICIO"]),
    ),
    numeroAto: texto(obterValor(linha, ["Número", "Numero", "NUMERO"])),
    anoAto: texto(obterValor(linha, ["Ano", "ANO"])),
    observacoes: null,
    hashLinha: "",
  };

  normalizada.hashLinha = hashObjeto(normalizada);

  return normalizada;
}

async function obterFonteNcm() {
  const fonte = await prisma.fonteNormativa.findUnique({
    where: { codigo: CODIGO_FONTE },
    select: { id: true, codigo: true, nome: true },
  });

  if (!fonte) {
    throw new Error(
      `Fonte normativa ${CODIGO_FONTE} não encontrada. Execute o bootstrap antes.`,
    );
  }

  return fonte;
}

export async function registrarTabelaNcmComoDownloadComplementar() {
  if (process.env.NEXT_RUNTIME === "edge") {
    return {
      ok: false,
      ignorado: true,
      motivo: "Carga da tabela NCM ignorada em runtime Edge.",
      arquivoLocalizado: null,
      totalBruto: 0,
      totalNormalizado: 0,
      totalInserido: 0,
    };
  }

  const fonte = await obterFonteNcm();
  const caminhoArquivo = await localizarArquivoTabela();

  if (!caminhoArquivo) {
    return {
      ok: false,
      ignorado: true,
      motivo:
        "Arquivo da tabela NCM vigente não encontrado nos caminhos candidatos do projeto.",
      arquivoLocalizado: null,
      totalBruto: 0,
      totalNormalizado: 0,
      totalInserido: 0,
    };
  }

  const { fs, path } = await carregarFsPath();
  const buffer = await fs.readFile(caminhoArquivo);
  const hashArquivo = crypto.createHash("sha256").update(buffer).digest("hex");
  const nomeArquivo = path.basename(caminhoArquivo);

  const download = await prisma.downloadNormativo.create({
    data: {
      fonteNormativaId: fonte.id,
      statusAtualizacao: "PARSEADO",
      urlBaixada: caminhoArquivo,
      nomeArquivo,
      mimeType: nomeArquivo.toLowerCase().endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : nomeArquivo.toLowerCase().endsWith(".csv")
          ? "text/csv"
          : nomeArquivo.toLowerCase().endsWith(".json")
            ? "application/json"
            : "application/octet-stream",
      hashArquivo,
      tamanhoBytes: buffer.length,
      dataBaixou: new Date(),
      dataProcessou: new Date(),
      payloadMeta: {
        origem: "arquivo_local_projeto",
        codigoFonte: CODIGO_FONTE,
      },
    },
  });

  try {
    const linhasBrutas = await lerTabelaNcmBruta(caminhoArquivo);
    const normalizadas = linhasBrutas
      .map(normalizarLinhaNcm)
      .filter((v): v is LinhaNcmNormalizada => Boolean(v));

    await prisma.ncmAnexoVigente.deleteMany({
      where: { fonteNormativaId: fonte.id },
    });

    const lotes = chunk(normalizadas, 1000);
    let totalInserido = 0;

    for (const lote of lotes) {
      const resultado = await prisma.ncmAnexoVigente.createMany({
        data: lote.map((linha) => ({
          fonteNormativaId: fonte.id,
          ordem: linha.ordem,
          capitulo: linha.capitulo,
          codigoOriginal: linha.codigoOriginal,
          codigoNcm: linha.codigoNcm,
          descricao: linha.descricao,
          anexoLc214: linha.anexoLc214,
          anexoI: linha.anexoI,
          anexoIV: linha.anexoIV,
          anexoV: linha.anexoV,
          anexoVI: linha.anexoVI,
          anexoVII: linha.anexoVII,
          anexoVIII: linha.anexoVIII,
          anexoIX: linha.anexoIX,
          anexoXI: linha.anexoXI,
          anexoXII: linha.anexoXII,
          anexoXIII: linha.anexoXIII,
          anexoXIV: linha.anexoXIV,
          anexoXV: linha.anexoXV,
          dataInicio: linha.dataInicio,
          dataFim: linha.dataFim,
          atoLegalInicio: linha.atoLegalInicio,
          numeroAto: linha.numeroAto,
          anoAto: linha.anoAto,
          observacoes: linha.observacoes,
          hashLinha: linha.hashLinha,
        })),
      });

      totalInserido += resultado.count;
    }

    await prisma.downloadNormativo.update({
      where: { id: download.id },
      data: {
        statusAtualizacao: "PUBLICADO",
        payloadMeta: {
          origem: "arquivo_local_projeto",
          codigoFonte: CODIGO_FONTE,
          totalBruto: linhasBrutas.length,
          totalNormalizado: normalizadas.length,
          totalInserido,
        },
      },
    });

    await prisma.fonteNormativa.update({
      where: { id: fonte.id },
      data: {
        ultimaVerificacaoEm: new Date(),
        ultimaVersaoPublicada: hashArquivo,
      },
    });

    return {
      ok: true,
      ignorado: false,
      arquivoLocalizado: caminhoArquivo,
      downloadNormativoId: download.id,
      totalBruto: linhasBrutas.length,
      totalNormalizado: normalizadas.length,
      totalInserido,
    };
  } catch (error) {
    const mensagem =
      error instanceof Error ? error.message : "Erro desconhecido ao carregar tabela NCM.";

    await prisma.downloadNormativo.update({
      where: { id: download.id },
      data: {
        statusAtualizacao: "ERRO",
        mensagemErro: mensagem,
      },
    });

    throw error;
  }
}