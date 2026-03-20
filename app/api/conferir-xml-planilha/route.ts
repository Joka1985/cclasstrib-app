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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loteId = body.loteId as string | undefined;

    if (!loteId) {
      return NextResponse.json(
        { ok: false, error: "loteId é obrigatório" },
        { status: 400 }
      );
    }

    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
    });

    if (!lote) {
      return NextResponse.json(
        { ok: false, error: "Lote não encontrado" },
        { status: 404 }
      );
    }

    const itensPlanilha = await prisma.itemPlanilha.findMany({
      where: {
        loteId,
        linhaValida: true,
      },
    });

    const xmlRelacionados = await prisma.xmlDocumento.findMany({
      where: {
        loteId,
        statusXml: {
          in: ["SAIDA", "ENTRADA"],
        },
      },
      include: {
        itensXml: true,
      },
    });

    await prisma.divergenciaXmlPlanilha.deleteMany({
      where: { loteId },
    });

    if (xmlRelacionados.length === 0) {
      return NextResponse.json({
        ok: true,
        mensagem: "Nenhum XML relacionado para conferência detalhada.",
        totalDivergencias: 0,
      });
    }

    const itensXml = xmlRelacionados.flatMap((xmlDoc) => xmlDoc.itensXml);

    const divergencias: Array<{
      loteId: string;
      codigoPlanilha: string | null;
      codigoXml: string | null;
      descricaoPlanilha: string | null;
      descricaoXml: string | null;
      tipoDivergencia: string;
      observacao: string | null;
    }> = [];

    const itensXmlUsados = new Set<string>();

    for (const itemPlanilha of itensPlanilha) {
      const matchPorCodigo = itensXml.find(
        (itemXml) =>
          itemXml.codigoItem &&
          itemXml.codigoItem.trim() === itemPlanilha.codigoItemOuServico.trim()
      );

      if (matchPorCodigo) {
        itensXmlUsados.add(matchPorCodigo.id);

        const descricaoPlanilhaNormalizada = normalizarTexto(
          itemPlanilha.descricaoItemOuServico
        );
        const descricaoXmlNormalizada = normalizarTexto(
          matchPorCodigo.descricaoItem
        );

        if (descricaoPlanilhaNormalizada !== descricaoXmlNormalizada) {
          divergencias.push({
            loteId,
            codigoPlanilha: itemPlanilha.codigoItemOuServico,
            codigoXml: matchPorCodigo.codigoItem,
            descricaoPlanilha: itemPlanilha.descricaoItemOuServico,
            descricaoXml: matchPorCodigo.descricaoItem,
            tipoDivergencia: "DESCRICAO_DIVERGENTE",
            observacao: "Código encontrado, mas a descrição está diferente.",
          });
        }

        const ncmPlanilha = String(itemPlanilha.ncm ?? "").trim();
        const ncmXml = String(matchPorCodigo.ncm ?? "").trim();

        if (ncmPlanilha && ncmXml && ncmPlanilha !== ncmXml) {
          divergencias.push({
            loteId,
            codigoPlanilha: itemPlanilha.codigoItemOuServico,
            codigoXml: matchPorCodigo.codigoItem,
            descricaoPlanilha: itemPlanilha.descricaoItemOuServico,
            descricaoXml: matchPorCodigo.descricaoItem,
            tipoDivergencia: "NCM_DIVERGENTE",
            observacao: `NCM planilha: ${ncmPlanilha} | NCM XML: ${ncmXml}`,
          });
        }

        continue;
      }

      const matchPorDescricao = itensXml.find(
        (itemXml) =>
          normalizarTexto(itemXml.descricaoItem) ===
          normalizarTexto(itemPlanilha.descricaoItemOuServico)
      );

      if (matchPorDescricao) {
        itensXmlUsados.add(matchPorDescricao.id);

        divergencias.push({
          loteId,
          codigoPlanilha: itemPlanilha.codigoItemOuServico,
          codigoXml: matchPorDescricao.codigoItem,
          descricaoPlanilha: itemPlanilha.descricaoItemOuServico,
          descricaoXml: matchPorDescricao.descricaoItem,
          tipoDivergencia: "CODIGO_DIVERGENTE",
          observacao:
            "Descrição compatível encontrada no XML, mas o código é diferente.",
        });

        const ncmPlanilha = String(itemPlanilha.ncm ?? "").trim();
        const ncmXml = String(matchPorDescricao.ncm ?? "").trim();

        if (ncmPlanilha && ncmXml && ncmPlanilha !== ncmXml) {
          divergencias.push({
            loteId,
            codigoPlanilha: itemPlanilha.codigoItemOuServico,
            codigoXml: matchPorDescricao.codigoItem,
            descricaoPlanilha: itemPlanilha.descricaoItemOuServico,
            descricaoXml: matchPorDescricao.descricaoItem,
            tipoDivergencia: "NCM_DIVERGENTE",
            observacao: `NCM planilha: ${ncmPlanilha} | NCM XML: ${ncmXml}`,
          });
        }

        continue;
      }

      divergencias.push({
        loteId,
        codigoPlanilha: itemPlanilha.codigoItemOuServico,
        codigoXml: null,
        descricaoPlanilha: itemPlanilha.descricaoItemOuServico,
        descricaoXml: null,
        tipoDivergencia: "ITEM_PLANILHA_NAO_ENCONTRADO_NO_XML",
        observacao: "Nenhum item correspondente foi encontrado no XML.",
      });
    }

    for (const itemXml of itensXml) {
      if (!itensXmlUsados.has(itemXml.id)) {
        divergencias.push({
          loteId,
          codigoPlanilha: null,
          codigoXml: itemXml.codigoItem,
          descricaoPlanilha: null,
          descricaoXml: itemXml.descricaoItem,
          tipoDivergencia: "ITEM_XML_NAO_ENCONTRADO_NA_PLANILHA",
          observacao: "Item existente no XML sem correspondente na planilha.",
        });
      }
    }

    if (divergencias.length > 0) {
      await prisma.divergenciaXmlPlanilha.createMany({
        data: divergencias,
      });
    }

    return NextResponse.json({
      ok: true,
      mensagem: "Conferência detalhada concluída.",
      totalItensPlanilhaValidos: itensPlanilha.length,
      totalXmlRelacionados: xmlRelacionados.length,
      totalItensXml: itensXml.length,
      totalDivergencias: divergencias.length,
    });
  } catch (error) {
    console.error("Erro na conferência XML x planilha:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao conferir XML com planilha" },
      { status: 500 }
    );
  }
}