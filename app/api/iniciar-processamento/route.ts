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
        dataEntregaEnviada: true,
        dataProcessamentoIniciado: true,
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
          error: "Não é possível iniciar o processamento antes de gerar o orçamento.",
        },
        { status: 400 }
      );
    }

    if (lote.dataEntregaEnviada) {
      return NextResponse.json(
        {
          ok: false,
          error: "O lote já foi entregue e não pode voltar para processamento.",
        },
        { status: 400 }
      );
    }

    if (lote.statusLote === "EM_PROCESSAMENTO") {
      return NextResponse.json({
        ok: true,
        mensagem: "O processamento já havia sido iniciado anteriormente.",
        lote,
      });
    }

    const statusPermitidos = [
      "ORCAMENTO_GERADO",
      "AGUARDANDO_PAGAMENTO",
      "AGUARDANDO_VALIDACAO",
      "PAGAMENTO_APROVADO",
      "PROCESSADO_COM_DIVERGENCIAS",
      "PROCESSADO_COM_REVISAO_HUMANA",
      "ERRO_PROCESSAMENTO",
    ];

    if (lote.statusLote && !statusPermitidos.includes(String(lote.statusLote))) {
      return NextResponse.json(
        {
          ok: false,
          error: `O lote está no status '${lote.statusLote}' e não permite iniciar o processamento.`,
        },
        { status: 400 }
      );
    }

    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: {
        statusLote: "EM_PROCESSAMENTO",
        dataProcessamentoIniciado: lote.dataProcessamentoIniciado ?? new Date(),
        dataProcessamentoFim: null,
      },
      select: {
        id: true,
        protocolo: true,
        statusLote: true,
        dataOrcamentoGerado: true,
        dataPagamentoConfirmado: true,
        dataEntregaEnviada: true,
        dataProcessamentoIniciado: true,
        dataProcessamentoFim: true,
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
      mensagem: "Processamento iniciado com sucesso.",
      lote: loteAtualizado,
    });
  } catch (error) {
    console.error("Erro ao iniciar processamento:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao iniciar processamento." },
      { status: 500 }
    );
  }
}