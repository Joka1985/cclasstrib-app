import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loteId = body.loteId;

    if (!loteId) {
      return NextResponse.json(
        { ok: false, error: "loteId é obrigatório" },
        { status: 400 }
      );
    }

    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
      include: {
        itensPlanilha: true,
        xmlDocumentos: true,
      },
    });

    if (!lote) {
      return NextResponse.json(
        { ok: false, error: "Lote não encontrado" },
        { status: 404 }
      );
    }

    await prisma.divergenciaXmlPlanilha.deleteMany({
      where: { loteId },
    });

    const divergencias: Array<{
      loteId: string;
      codigoPlanilha: string | null;
      codigoXml: string | null;
      descricaoPlanilha: string | null;
      descricaoXml: string | null;
      tipoDivergencia: string;
      observacao: string | null;
    }> = [];

    const itensPlanilhaValidos = lote.itensPlanilha.filter(
      (item) => item.linhaValida
    );

    for (const itemPlanilha of itensPlanilhaValidos) {
      divergencias.push({
        loteId,
        codigoPlanilha: itemPlanilha.codigoItemOuServico,
        codigoXml: null,
        descricaoPlanilha: itemPlanilha.descricaoItemOuServico,
        descricaoXml: null,
        tipoDivergencia: "XML_NAO_LIDO_AINDA",
        observacao:
          "Nesta etapa inicial o XML foi triado, mas os itens internos do XML ainda não foram extraídos para comparação detalhada.",
      });
    }

    if (divergencias.length > 0) {
      await prisma.divergenciaXmlPlanilha.createMany({
        data: divergencias,
      });
    }

    return NextResponse.json({
      ok: true,
      mensagem: "Conferência inicial concluída.",
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