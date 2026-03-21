import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function normalizarTexto(valor?: string | null) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizarDocumento(valor?: string | null) {
  return String(valor ?? "").replace(/\D/g, "");
}

function chaveDuplicidade(item: {
  codigo?: string | null;
  descricao?: string | null;
  ncm?: string | null;
  cfop?: string | null;
}) {
  return [
    normalizarTexto(item.codigo),
    normalizarTexto(item.descricao),
    normalizarTexto(item.ncm),
    normalizarTexto(item.cfop),
  ].join("|");
}

function chaveCodigoDescricao(codigo?: string | null, descricao?: string | null) {
  const codigoNormalizado = normalizarTexto(codigo);
  const descricaoNormalizada = normalizarTexto(descricao);

  if (codigoNormalizado) return `COD:${codigoNormalizado}`;
  if (descricaoNormalizada) return `DESC:${descricaoNormalizada}`;
  return "";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loteId = body.loteId as string | undefined;

    if (!loteId) {
      return NextResponse.json(
        { ok: false, error: "loteId é obrigatório." },
        { status: 400 }
      );
    }

    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
      include: {
        cliente: true,
        itensPlanilha: {
          orderBy: { linhaOrigem: "asc" },
        },
        divergenciasXmlPlanilha: true,
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
      },
    });

    if (!lote) {
      return NextResponse.json(
        { ok: false, error: "Lote não encontrado." },
        { status: 404 }
      );
    }

    const itensPlanilhaValidos = lote.itensPlanilha.filter((item) => item.linhaValida);
    const itensXmlRelacionados = lote.xmlDocumentos.flatMap((doc) => doc.itensXml);

    // Consolidar duplicados da planilha
    const mapaItensUnicos = new Map<
      string,
      {
        codigo: string;
        descricao: string;
        ncm: string | null;
        cfopManual: string | null;
        quantidade: number;
      }
    >();

    for (const item of itensPlanilhaValidos) {
      const chave = chaveDuplicidade({
        codigo: item.codigoItemOuServico,
        descricao: item.descricaoItemOuServico,
        ncm: item.ncm,
        cfop: item.cfopInformadoManual,
      });

      if (!mapaItensUnicos.has(chave)) {
        mapaItensUnicos.set(chave, {
          codigo: item.codigoItemOuServico,
          descricao: item.descricaoItemOuServico,
          ncm: item.ncm,
          cfopManual: item.cfopInformadoManual,
          quantidade: 0,
        });
      }

      mapaItensUnicos.get(chave)!.quantidade += 1;
    }

    const itensUnicosPlanilha = Array.from(mapaItensUnicos.values());
    const itensDuplicados = itensUnicosPlanilha.filter((item) => item.quantidade > 1);

    // Mapa XML por código/descrição
    const mapaXml = new Map<
      string,
      {
        codigo: string | null;
        descricao: string;
        ncm: string | null;
        cfop: string | null;
      }[]
    >();

    for (const itemXml of itensXmlRelacionados) {
      const chave = chaveCodigoDescricao(itemXml.codigoItem, itemXml.descricaoItem);
      if (!chave) continue;

      if (!mapaXml.has(chave)) {
        mapaXml.set(chave, []);
      }

      mapaXml.get(chave)!.push({
        codigo: itemXml.codigoItem,
        descricao: itemXml.descricaoItem,
        ncm: itemXml.ncm,
        cfop: itemXml.cfop,
      });
    }

    let totalRelacionadosAoXml = 0;
    let totalRelacionadosComDivergencia = 0;
    let totalSemRelacaoComCfopManual = 0;
    let totalSemRelacaoSemCfopManual = 0;
    let totalAptosParaAnalise = 0;
    let totalImprecisos = 0;
    let totalDivergenciasNcm = 0;
    let totalDivergenciasDescricao = 0;

    const chavesXmlEncontradasNaPlanilha = new Set<string>();

    for (const item of itensUnicosPlanilha) {
      const chavePrincipal = chaveCodigoDescricao(item.codigo, item.descricao);
      const chaveDescricao = item.descricao
        ? `DESC:${normalizarTexto(item.descricao)}`
        : "";

      const candidatos =
        (chavePrincipal && mapaXml.get(chavePrincipal)) ||
        (chaveDescricao && mapaXml.get(chaveDescricao)) ||
        [];

      const possuiRelacaoXml = candidatos.length > 0;
      const itemXmlRef = possuiRelacaoXml ? candidatos[0] : null;

      if (itemXmlRef) {
        const chaveXml = chaveCodigoDescricao(itemXmlRef.codigo, itemXmlRef.descricao);
        if (chaveXml) {
          chavesXmlEncontradasNaPlanilha.add(chaveXml);
        }
      }

      const descricaoDivergente =
        !!itemXmlRef &&
        normalizarTexto(item.descricao) !== normalizarTexto(itemXmlRef.descricao);

      const ncmDivergente =
        !!itemXmlRef &&
        !!item.ncm &&
        !!itemXmlRef.ncm &&
        normalizarTexto(item.ncm) !== normalizarTexto(itemXmlRef.ncm);

      const temDivergencia = descricaoDivergente || ncmDivergente;

      if (descricaoDivergente) totalDivergenciasDescricao += 1;
      if (ncmDivergente) totalDivergenciasNcm += 1;

      const cfopEfetivo = itemXmlRef?.cfop || item.cfopManual || null;

      const possuiMinimos = Boolean(
        item.codigo &&
          item.descricao &&
          item.ncm &&
          cfopEfetivo
      );

      if (possuiRelacaoXml) {
        totalRelacionadosAoXml += 1;
        if (temDivergencia) {
          totalRelacionadosComDivergencia += 1;
        }
      } else {
        if (item.cfopManual) {
          totalSemRelacaoComCfopManual += 1;
        } else {
          totalSemRelacaoSemCfopManual += 1;
        }
      }

      if (possuiMinimos) {
        totalAptosParaAnalise += 1;
      } else {
        totalImprecisos += 1;
      }
    }

    // Itens que estão só no XML
    let totalSomenteNoXml = 0;

    for (const itemXml of itensXmlRelacionados) {
      const chaveXml = chaveCodigoDescricao(itemXml.codigoItem, itemXml.descricaoItem);
      const chaveDescricaoXml = itemXml.descricaoItem
        ? `DESC:${normalizarTexto(itemXml.descricaoItem)}`
        : "";

      const apareceuNaPlanilha = itensUnicosPlanilha.some((itemPlanilha) => {
        const chavePlanilha = chaveCodigoDescricao(itemPlanilha.codigo, itemPlanilha.descricao);
        const chaveDescricaoPlanilha = itemPlanilha.descricao
          ? `DESC:${normalizarTexto(itemPlanilha.descricao)}`
          : "";

        return (
          (!!chaveXml && chavePlanilha === chaveXml) ||
          (!!chaveDescricaoXml && chaveDescricaoPlanilha === chaveDescricaoXml)
        );
      });

      if (!apareceuNaPlanilha) {
        totalSomenteNoXml += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      lote: {
        id: lote.id,
        protocolo: lote.protocolo,
        cliente: lote.cliente.nomeRazaoSocial,
        documento: normalizarDocumento(lote.cliente.cpfCnpj),
      },
      resumo: {
        totalItensPlanilhaValidos: itensPlanilhaValidos.length,
        totalItensUnicosConsiderados: itensUnicosPlanilha.length,
        totalRelacionadosAoXml,
        totalRelacionadosComDivergencia,
        totalSemRelacaoComCfopManual,
        totalSemRelacaoSemCfopManual,
        totalAptosParaAnalise,
        totalImprecisos,
        totalDuplicadosConsolidados: itensDuplicados.length,
        totalSomenteNoXml,
        totalDivergenciasNcm,
        totalDivergenciasDescricao,
      },
      aviso:
        "O contato será realizado para efeito de orçamento apenas dos itens que contenham informações mínimas para análise: código do item, descrição do item, NCM e CFOP. Na ausência dessas informações, a classificação poderá ficar imprecisa.",
    });
  } catch (error) {
    console.error("Erro ao montar conferência final:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar conferência final." },
      { status: 500 }
    );
  }
}