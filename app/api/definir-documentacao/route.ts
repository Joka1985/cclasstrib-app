import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const loteId = body.loteId as string | undefined;
    const modoDocumentacao = body.modoDocumentacao as
      | "COM_XML"
      | "SEM_XML"
      | undefined;

    if (!loteId) {
      return NextResponse.json(
        { ok: false, error: "loteId é obrigatório." },
        { status: 400 }
      );
    }

    if (!modoDocumentacao || !["COM_XML", "SEM_XML"].includes(modoDocumentacao)) {
      return NextResponse.json(
        { ok: false, error: "modoDocumentacao inválido." },
        { status: 400 }
      );
    }

    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
      select: { id: true },
    });

    if (!lote) {
      return NextResponse.json(
        { ok: false, error: "Lote não encontrado." },
        { status: 404 }
      );
    }

    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: {
        modoDocumentacao,
      },
    });

    return NextResponse.json({
      ok: true,
      mensagem: "Modo de documentação definido com sucesso.",
      lote: loteAtualizado,
    });
  } catch (error) {
    console.error("Erro ao definir documentação:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao definir documentação." },
      { status: 500 }
    );
  }
}