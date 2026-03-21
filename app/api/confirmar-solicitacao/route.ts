import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { enviarEmailSolicitacao } from "@/lib/email";

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
      },
    });

    if (!lote) {
      return NextResponse.json(
        { ok: false, error: "Lote não encontrado." },
        { status: 404 }
      );
    }

    await enviarEmailSolicitacao({
      para: lote.cliente.email,
      nomeCliente: lote.cliente.nomeRazaoSocial,
      protocolo: lote.protocolo ?? "",
    });

    return NextResponse.json({
      ok: true,
      mensagem: "Solicitação confirmada e e-mail enviado com sucesso.",
    });
  } catch (error: unknown) {
    console.error("Erro ao confirmar solicitação:", error);

    const mensagem =
      error instanceof Error ? error.message : "Erro ao confirmar solicitação.";

    return NextResponse.json(
      { ok: false, error: mensagem },
      { status: 500 }
    );
  }
}