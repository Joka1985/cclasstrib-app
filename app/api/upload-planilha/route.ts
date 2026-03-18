import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const loteId = formData.get("loteId");
    const arquivo = formData.get("arquivo");

    if (!loteId || typeof loteId !== "string") {
      return NextResponse.json(
        { ok: false, error: "loteId é obrigatório" },
        { status: 400 }
      );
    }

    if (!arquivo || !(arquivo instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Arquivo é obrigatório" },
        { status: 400 }
      );
    }

    const loteExiste = await prisma.lote.findUnique({
      where: { id: loteId },
    });

    if (!loteExiste) {
      return NextResponse.json(
        { ok: false, error: "Lote não encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      mensagem: "Arquivo recebido com sucesso.",
      nomeArquivo: arquivo.name,
      tamanho: arquivo.size,
      tipo: arquivo.type,
      loteId,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erro ao receber planilha" },
      { status: 500 }
    );
  }
}