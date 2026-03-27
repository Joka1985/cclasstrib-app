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
        protocolo: true,
        statusLote: true,
        dataOrcamentoGerado: true,
        dataPagamentoConfirmado: true,
        valorTotal: true,
        cliente: {
          select: {
            id: true,
            nomeRazaoSocial: true,
            email: true,
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

    if (!lote.dataOrcamentoGerado) {
      return NextResponse.json(
        {
          ok: false,
          error: "Não é possível confirmar pagamento antes de gerar o orçamento.",
        },
        { status: 400 }
      );
    }

    if (lote.dataPagamentoConfirmado) {
      return NextResponse.json({
        ok: true,
        mensagem: "Pagamento já havia sido confirmado anteriormente.",
        lote,
      });
    }

    const statusPermitidos = ["ORCAMENTO_GERADO", "AGUARDANDO_PAGAMENTO"];

    if (lote.statusLote && !statusPermitidos.includes(String(lote.statusLote))) {
      return NextResponse.json(
        {
          ok: false,
          error: `O lote está no status '${lote.statusLote}' e não permite confirmação de pagamento.`,
        },
        { status: 400 }
      );
    }

    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: {
        statusLote: "PAGAMENTO_APROVADO",
        dataPagamentoConfirmado: new Date(),
      },
      select: {
        id: true,
        protocolo: true,
        statusLote: true,
        valorTotal: true,
        dataOrcamentoGerado: true,
        dataPagamentoConfirmado: true,
        dataEntregaEnviada: true,
        cliente: {
          select: {
            id: true,
            nomeRazaoSocial: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      mensagem: "Pagamento confirmado com sucesso.",
      lote: loteAtualizado,
    });
  } catch (error) {
    console.error("Erro ao confirmar pagamento:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao confirmar pagamento." },
      { status: 500 }
    );
  }
}