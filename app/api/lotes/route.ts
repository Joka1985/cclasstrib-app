import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.clienteId) {
      return NextResponse.json(
        { ok: false, error: "clienteId é obrigatório" },
        { status: 400 }
      );
    }

    const clienteExiste = await prisma.cliente.findUnique({
      where: { id: body.clienteId },
    });

    if (!clienteExiste) {
      return NextResponse.json(
        { ok: false, error: "Cliente não encontrado" },
        { status: 404 }
      );
    }

    const lote = await prisma.lote.create({
      data: {
        clienteId: body.clienteId,
        statusLote: "DOCUMENTACAO_PENDENTE",
        quantidadeLinhasPlanilha: 0,
        quantidadeLinhasValidas: 0,
        quantidadeLinhasInvalidas: 0,
        valorUnitario: 0,
        valorTotal: 0,
      },
    });

    return NextResponse.json({ ok: true, lote }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Erro ao criar lote" },
      { status: 500 }
    );
  }
}