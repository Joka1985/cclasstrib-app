import crypto from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { enviarEmailAlertaSuporte } from "@/lib/email-alertas";

type LinhaBaseOficial = {
  cstIbsCbs: string;
  descricaoCst?: string | null;
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

function sha256(valor: string) {
  return crypto.createHash("sha256").update(valor).digest("hex");
}

function normalizarTexto(valor?: string | null) {
  return String(valor ?? "").trim();
}

function chaveLinhaBase(linha: LinhaBaseOficial) {
  return `${linha.cstIbsCbs}|${linha.cclassTrib}`;
}

function hashLinhaBase(linha: LinhaBaseOficial) {
  return sha256(
    JSON.stringify({
      ...linha,
      dIniVig: linha.dIniVig?.toISOString() ?? null,
      dFimVig: linha.dFimVig?.toISOString() ?? null,
      dataAtualizacaoFonte: linha.dataAtualizacaoFonte?.toISOString() ?? null,
    })
  );
}

async function buscarDestinatariosSuporte() {
  const destinatarios = await prisma.destinatarioAlerta.findMany({
    where: { ativo: true },
    orderBy: { email: "asc" },
  });

  return destinatarios;
}

async function registrarAlertasEDispararEmail(params: {
  fonteNormativaId: string;
  versaoAnterior?: string | null;
  versaoNova: string;
  severidade: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  assunto: string;
  resumo: string;
  payload?: Prisma.JsonObject;
  diffNormativoId?: string | null;
  fonteNome: string;
  detalhesHtml?: string;
}) {
  const destinatarios = await buscarDestinatariosSuporte();
  const emails = destinatarios.map((d) => d.email);

  if (!emails.length) {
    return;
  }

  try {
    await enviarEmailAlertaSuporte({
      para: emails,
      assunto: params.assunto,
      severidade: params.severidade,
      fonteNome: params.fonteNome,
      versaoAnterior: params.versaoAnterior,
      versaoNova: params.versaoNova,
      resumo: params.resumo,
      detalhesHtml: params.detalhesHtml,
    });

    await prisma.$transaction(
      destinatarios.map((destinatario) =>
        prisma.alertaSuporte.create({
          data: {
            fonteNormativaId: params.fonteNormativaId,
            diffNormativoId: params.diffNormativoId ?? null,
            destinatarioAlertaId: destinatario.id,
            severidade: params.severidade,
            assunto: params.assunto,
            resumo: params.resumo,
            payload: params.payload,
            emailEnviado: true,
            dataEnvio: new Date(),
          },
        })
      )
    );
  } catch (error) {
    const mensagem =
      error instanceof Error ? error.message : "Erro ao enviar e-mail de alerta.";

    await prisma.$transaction(
      destinatarios.map((destinatario) =>
        prisma.alertaSuporte.create({
          data: {
            fonteNormativaId: params.fonteNormativaId,
            diffNormativoId: params.diffNormativoId ?? null,
            destinatarioAlertaId: destinatario.id,
            severidade: params.severidade,
            assunto: params.assunto,
            resumo: params.resumo,
            payload: params.payload,
            emailEnviado: false,
            mensagemErro: mensagem,
          },
        })
      )
    );

    throw error;
  }
}

/**
 * Esta função é o ponto de entrada do job automático.
 * Nesta primeira etapa, ela está preparada para:
 * - localizar a fonte ativa
 * - comparar a "versão externa" detectada
 * - registrar download lógico
 * - gerar versão normativa
 * - comparar diff com a versão publicada anterior
 * - publicar a nova versão
 * - notificar o suporte
 *
 * A leitura real do arquivo oficial pode ser acoplada depois,
 * substituindo a função `obterSnapshotFonte`.
 */
export async function atualizarFonteNormativaPorCodigo(codigoFonte: string) {
  const fonte = await prisma.fonteNormativa.findUnique({
    where: { codigo: codigoFonte },
    include: {
      versoes: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  if (!fonte || !fonte.ativa) {
    throw new Error(`Fonte normativa '${codigoFonte}' não encontrada ou inativa.`);
  }

  const snapshot = await obterSnapshotFonte(fonte.urlOficial);

  await prisma.fonteNormativa.update({
    where: { id: fonte.id },
    data: {
      ultimaVerificacaoEm: new Date(),
    },
  });

  const download = await prisma.downloadNormativo.create({
    data: {
      fonteNormativaId: fonte.id,
      statusAtualizacao: "BAIXADO",
      urlBaixada: fonte.urlOficial,
      nomeArquivo: snapshot.nomeArquivo,
      mimeType: snapshot.mimeType,
      hashArquivo: snapshot.hashArquivo,
      tamanhoBytes: snapshot.tamanhoBytes,
      dataBaixou: new Date(),
      payloadMeta: {
        versaoExterna: snapshot.versaoExterna,
        resumoExterno: snapshot.resumo,
      },
      arquivoBrutoBase64: snapshot.arquivoBrutoBase64,
    },
  });

  const versaoExistente = await prisma.versaoNormativa.findFirst({
    where: {
      fonteNormativaId: fonte.id,
      versaoIdentificada: snapshot.versaoExterna,
    },
  });

  if (versaoExistente) {
    await prisma.downloadNormativo.update({
      where: { id: download.id },
      data: {
        statusAtualizacao: "VALIDADO",
        dataProcessou: new Date(),
      },
    });

    return {
      ok: true,
      mensagem: "Nenhuma nova versão identificada.",
      fonte: fonte.codigo,
      versao: versaoExistente.versaoIdentificada,
    };
  }

  const linhasNormalizadas = normalizarConteudoFonte(snapshot);

  const versaoNova = await prisma.versaoNormativa.create({
    data: {
      fonteNormativaId: fonte.id,
      downloadNormativoId: download.id,
      versaoIdentificada: snapshot.versaoExterna,
      statusAtualizacao: "PARSEADO",
      dataPublicacao: snapshot.dataPublicacao,
      dataVigenciaInicio: snapshot.dataVigenciaInicio,
      dataVigenciaFim: snapshot.dataVigenciaFim,
      hashConteudo: sha256(JSON.stringify(linhasNormalizadas)),
      resumo: snapshot.resumo,
      payloadResumo: {
        quantidadeLinhas: linhasNormalizadas.length,
      },
    },
  });

  const versaoPublicadaAnterior = await prisma.versaoNormativa.findFirst({
    where: {
      fonteNormativaId: fonte.id,
      publicada: true,
      id: { not: versaoNova.id },
    },
    orderBy: [{ dataPublicada: "desc" }, { createdAt: "desc" }],
    include: {
      basesOficiais: true,
    },
  });

  await prisma.baseOficialClassificacao.createMany({
    data: linhasNormalizadas.map((linha) => ({
      versaoNormativaId: versaoNova.id,
      cstIbsCbs: linha.cstIbsCbs,
      descricaoCst: linha.descricaoCst ?? null,
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
      hashLinha: hashLinhaBase(linha),
    })),
  });

  const basesNova = await prisma.baseOficialClassificacao.findMany({
    where: { versaoNormativaId: versaoNova.id },
    orderBy: [{ cstIbsCbs: "asc" }, { cclassTrib: "asc" }],
  });

  const mapaAnterior = new Map<string, (typeof basesNova)[number]>();
  for (const linha of versaoPublicadaAnterior?.basesOficiais ?? []) {
    mapaAnterior.set(`${linha.cstIbsCbs}|${linha.cclassTrib}`, linha);
  }

  const mapaNova = new Map<string, (typeof basesNova)[number]>();
  for (const linha of basesNova) {
    mapaNova.set(`${linha.cstIbsCbs}|${linha.cclassTrib}`, linha);
  }

  const diffsParaCriar: Prisma.DiffNormativoCreateManyInput[] = [];

  for (const [chave, linhaNova] of mapaNova.entries()) {
    const anterior = mapaAnterior.get(chave);

    if (!anterior) {
      diffsParaCriar.push({
        fonteNormativaId: fonte.id,
        versaoAnteriorId: versaoPublicadaAnterior?.id ?? null,
        versaoNovaId: versaoNova.id,
        tipoMudanca: "INCLUSAO",
        chaveRegistro: chave,
        campoAlterado: null,
        valorAnterior: null,
        valorNovo: linhaNova.hashLinha ?? null,
        impacto: "Nova classificação disponível para o motor.",
        resumo: `Inclusão do registro ${chave}.`,
        severidade: "ALTA",
      });
      continue;
    }

    if (anterior.hashLinha !== linhaNova.hashLinha) {
      const camposComparados: Array<keyof typeof linhaNova> = [
        "descricaoCst",
        "nomeCclassTrib",
        "descricaoCclassTrib",
        "artigoLc214",
        "tipoAliquota",
        "pRedIbs",
        "pRedCbs",
        "indGTribRegular",
        "indGCredPresOper",
        "indGMonoPadrao",
        "indGMonoReten",
        "indGMonoRet",
        "indGMonoDif",
        "indGEstornoCred",
        "dIniVig",
        "dFimVig",
        "indNFe",
        "indNFCe",
        "indNFSe",
        "indCTe",
        "indNFCom",
        "linkNormativo",
      ];

      for (const campo of camposComparados) {
        const valorAnterior = String((anterior as any)[campo] ?? "");
        const valorNovo = String((linhaNova as any)[campo] ?? "");

        if (valorAnterior !== valorNovo) {
          diffsParaCriar.push({
            fonteNormativaId: fonte.id,
            versaoAnteriorId: versaoPublicadaAnterior?.id ?? null,
            versaoNovaId: versaoNova.id,
            tipoMudanca: "ALTERACAO",
            chaveRegistro: chave,
            campoAlterado: String(campo),
            valorAnterior,
            valorNovo,
            impacto:
              campo === "artigoLc214" ||
              campo === "tipoAliquota" ||
              campo === "pRedIbs" ||
              campo === "pRedCbs"
                ? "Impacto direto na parametrização final."
                : "Revisão recomendada do motor e das validações.",
            resumo: `Alteração no campo ${String(campo)} para o registro ${chave}.`,
            severidade:
              campo === "artigoLc214" ||
              campo === "tipoAliquota" ||
              campo === "pRedIbs" ||
              campo === "pRedCbs"
                ? "CRITICA"
                : "ALTA",
          });
        }
      }
    }
  }

  for (const [chave, linhaAnterior] of mapaAnterior.entries()) {
    if (!mapaNova.has(chave)) {
      diffsParaCriar.push({
        fonteNormativaId: fonte.id,
        versaoAnteriorId: versaoPublicadaAnterior?.id ?? null,
        versaoNovaId: versaoNova.id,
        tipoMudanca: "REVOGACAO",
        chaveRegistro: chave,
        campoAlterado: null,
        valorAnterior: linhaAnterior.hashLinha ?? null,
        valorNovo: null,
        impacto: "Regra anterior não está mais disponível.",
        resumo: `Revogação do registro ${chave}.`,
        severidade: "CRITICA",
      });
    }
  }

  if (diffsParaCriar.length) {
    await prisma.diffNormativo.createMany({
      data: diffsParaCriar,
    });
  }

  await prisma.$transaction([
    prisma.versaoNormativa.updateMany({
      where: {
        fonteNormativaId: fonte.id,
        publicada: true,
      },
      data: {
        publicada: false,
      },
    }),
    prisma.versaoNormativa.update({
      where: { id: versaoNova.id },
      data: {
        publicada: true,
        dataPublicada: new Date(),
        statusAtualizacao: "PUBLICADO",
      },
    }),
    prisma.downloadNormativo.update({
      where: { id: download.id },
      data: {
        statusAtualizacao: "PUBLICADO",
        dataProcessou: new Date(),
      },
    }),
    prisma.fonteNormativa.update({
      where: { id: fonte.id },
      data: {
        ultimaVersaoPublicada: versaoNova.versaoIdentificada,
      },
    }),
  ]);

  const severidadeGlobal: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA" =
    diffsParaCriar.some((d) => d.severidade === "CRITICA")
      ? "CRITICA"
      : diffsParaCriar.some((d) => d.severidade === "ALTA")
      ? "ALTA"
      : diffsParaCriar.some((d) => d.severidade === "MEDIA")
      ? "MEDIA"
      : "BAIXA";

  await registrarAlertasEDispararEmail({
    fonteNormativaId: fonte.id,
    versaoAnterior: versaoPublicadaAnterior?.versaoIdentificada ?? null,
    versaoNova: versaoNova.versaoIdentificada,
    severidade: severidadeGlobal,
    assunto: `[cClassTrib] Atualização normativa publicada - ${fonte.nome}`,
    resumo: `Nova versão normativa publicada com ${diffsParaCriar.length} diferença(s) detectada(s).`,
    payload: {
      quantidadeDiffs: diffsParaCriar.length,
      versaoAnterior: versaoPublicadaAnterior?.versaoIdentificada ?? null,
      versaoNova: versaoNova.versaoIdentificada,
    },
    fonteNome: fonte.nome,
    detalhesHtml: `
      <p><strong>Quantidade de diferenças:</strong> ${diffsParaCriar.length}</p>
      <p><strong>Fonte oficial:</strong> ${fonte.urlOficial}</p>
    `,
  });

  return {
    ok: true,
    fonte: fonte.codigo,
    versaoPublicada: versaoNova.versaoIdentificada,
    quantidadeDiffs: diffsParaCriar.length,
  };
}

export async function atualizarTodasFontesNormativasAtivas() {
  const fontes = await prisma.fonteNormativa.findMany({
    where: { ativa: true },
    orderBy: { codigo: "asc" },
  });

  const resultados: Array<Record<string, unknown>> = [];

  for (const fonte of fontes) {
    try {
      const resultado = await atualizarFonteNormativaPorCodigo(fonte.codigo);
      resultados.push(resultado);
    } catch (error) {
      const mensagem =
        error instanceof Error ? error.message : "Erro ao atualizar fonte normativa.";

      await registrarAlertasEDispararEmail({
        fonteNormativaId: fonte.id,
        versaoAnterior: fonte.ultimaVersaoPublicada ?? null,
        versaoNova: "ERRO_ATUALIZACAO",
        severidade: "CRITICA",
        assunto: `[cClassTrib] Falha na atualização normativa - ${fonte.nome}`,
        resumo: mensagem,
        payload: {
          codigoFonte: fonte.codigo,
          erro: mensagem,
        },
        fonteNome: fonte.nome,
      });

      await prisma.downloadNormativo.create({
        data: {
          fonteNormativaId: fonte.id,
          statusAtualizacao: "ERRO",
          dataProcessou: new Date(),
          mensagemErro: mensagem,
        },
      });

      resultados.push({
        ok: false,
        fonte: fonte.codigo,
        erro: mensagem,
      });
    }
  }

  return resultados;
}

/**
 * Stub controlado.
 * Nesta fase, ele usa a própria URL cadastrada como fonte da versão.
 * Quando você conectar o fetch real, substitui só esta função.
 */
async function obterSnapshotFonte(urlOficial: string) {
  const versaoExterna = new Date().toISOString().slice(0, 10);

  return {
    versaoExterna,
    nomeArquivo: `snapshot-${versaoExterna}.json`,
    mimeType: "application/json",
    hashArquivo: sha256(urlOficial + versaoExterna),
    tamanhoBytes: 0,
    resumo: "Snapshot automático para atualização normativa.",
    arquivoBrutoBase64: Buffer.from(
      JSON.stringify({
        urlOficial,
        versaoExterna,
      }),
      "utf-8"
    ).toString("base64"),
    dataPublicacao: new Date(),
    dataVigenciaInicio: new Date(),
    dataVigenciaFim: null as Date | null,
  };
}

/**
 * Stub controlado.
 * Nesta fase, retorna um conjunto mínimo normalizado.
 * Quando você acoplar o parser real da base oficial, ele entra aqui.
 */
function normalizarConteudoFonte(snapshot: {
  versaoExterna: string;
}): LinhaBaseOficial[] {
  return [
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
      dFimVig: null,
      dataAtualizacaoFonte: new Date(snapshot.versaoExterna + "T00:00:00.000Z"),
      indNFe: true,
      indNFCe: true,
      indNFSe: true,
      indCTe: true,
      indNFCom: true,
      linkNormativo: "https://www.planalto.gov.br/",
      anexo: null,
    },
  ];
}