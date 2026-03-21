import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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
      select: {
        id: true,
        clienteId: true,
      },
    });

    if (!lote) {
      return NextResponse.json(
        { ok: false, error: "Lote não encontrado." },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.divergenciaXmlPlanilha.deleteMany({
        where: { loteId: lote.id },
      }),
      prisma.itemXml.deleteMany({
        where: {
          xmlDocumento: {
            loteId: lote.id,
          },
        },
      }),
      prisma.xmlDocumento.deleteMany({
        where: { loteId: lote.id },
      }),
      prisma.itemPlanilha.deleteMany({
        where: { loteId: lote.id },
      }),
      prisma.lote.delete({
        where: { id: lote.id },
      }),
      prisma.cliente.delete({
        where: { id: lote.clienteId },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      mensagem: "Solicitação cancelada e dados removidos com sucesso.",
    });
  } catch (error) {
    console.error("Erro ao cancelar solicitação:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao cancelar solicitação." },
      { status: 500 }
    );
  }
}