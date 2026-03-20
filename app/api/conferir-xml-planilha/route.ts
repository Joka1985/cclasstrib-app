import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { XMLParser } from "fast-xml-parser";

function normalizarTexto(valor?: string | null) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function limparDocumento(valor?: string | null) {
  return String(valor ?? "").replace(/\D/g, "");
}

function paraArray<T>(valor: T | T[] | undefined): T[] {
  if (!valor) return [];
  return Array.isArray(valor) ? valor : [valor];
}

type ItemXmlExtraido = {
  codigoXml: string;
  descricaoXml: string;
  ncmXml: string;
};

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
        cliente: true,
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

    const xmlRelacionados = lote.xmlDocumentos.filter(
      (xml) => xml.statusXml === "SAIDA" || xml.statusXml === "ENTRADA"
    );

    if (xmlRelacionados.length === 0) {
      return NextResponse.json({
        ok: true,
        mensagem: "Nenhum XML relacionado para conferência detalhada.",
        totalDivergencias: 0,
      });
    }

    const itensPlanilhaValidos = lote.itensPlanilha.filter(
      (item) => item.linhaValida
    );

    const divergencias: Array<{
      loteId: string;
      codigoPlanilha: string | null;
      codigoXml: string | null;
      descricaoPlanilha: string | null;
      descricaoXml: string | null;
      tipoDivergencia: string;
      observacao: string | null;
    }> = [];

    const itensXmlExtraidos: ItemXmlExtraido[] = [];

    for (const xmlDoc of xmlRelacionados) {
      if (!xmlDoc.chaveDocumento) continue;

      // Nesta fase, como ainda não armazenamos o XML bruto no banco,
      // usamos uma lógica provisória: conferência real só acontece
      // quando o XML vier do upload atual com conteúdo disponível.
      // Para não travar o fluxo, a rota vai sinalizar isso de forma clara.
      divergencias.push({
        loteId,
        codigoPlanilha: null,
        codigoXml: null,
        descricaoPlanilha: null,
        descricaoXml: null,
        tipoDivergencia: "XML_SEM_CONTEUDO_BRUTO",
        observacao:
          `O XML com chave ${xmlDoc.chaveDocumento} foi triado, mas o conteúdo bruto não foi armazenado. Para comparação item a item, o sistema precisará salvar o XML bruto ou seus itens extraídos no banco.`,
      });
    }

    // Enquanto ainda não armazenamos o conteúdo bruto do XML,
    // mantemos também o mapeamento dos itens válidos da planilha
    // como pendência de conferência real.
    for (const itemPlanilha of itensPlanilhaValidos) {
      divergencias.push({
        loteId,
        codigoPlanilha: itemPlanilha.codigoItemOuServico,
        codigoXml: null,
        descricaoPlanilha: itemPlanilha.descricaoItemOuServico,
        descricaoXml: null,
        tipoDivergencia: "ITEM_PLANILHA_SEM_XML_COMPARAVEL",
        observacao:
          "O item da planilha ainda não pôde ser comparado item a item porque os itens internos do XML não foram persistidos para consulta posterior.",
      });
    }

    if (divergencias.length > 0) {
      await prisma.divergenciaXmlPlanilha.createMany({
        data: divergencias,
      });
    }

    return NextResponse.json({
      ok: true,
      mensagem: "Conferência concluída com o nível atual de extração.",
      totalItensPlanilhaValidos: itensPlanilhaValidos.length,
      totalXmlRelacionados: xmlRelacionados.length,
      totalItensXmlExtraidos: itensXmlExtraidos.length,
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