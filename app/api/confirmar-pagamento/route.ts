import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { qstash, WORKER_URL } from "@/lib/qstash";

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
        quantidadeLinhasValidas: true,
        cliente: { select: { id: true, nomeRazaoSocial: true, email: true } },
      },
    });

    if (!lote) {
      return NextResponse.json({ ok: false, error: "Lote não encontrado." }, { status: 404 });
    }

    if (!lote.dataOrcamentoGerado) {
      return NextResponse.json(
        { ok: false, error: "Não é possível confirmar pagamento antes de gerar o orçamento." },
        { status: 400 }
      );
    }

    if (lote.dataPagamentoConfirmado) {
      return NextResponse.json({ ok: true, mensagem: "Pagamento já confirmado anteriormente.", lote });
    }

    const statusPermitidos = ["ORCAMENTO_GERADO", "AGUARDANDO_PAGAMENTO"];
    if (lote.statusLote && !statusPermitidos.includes(String(lote.statusLote))) {
      return NextResponse.json(
        { ok: false, error: `Status '${lote.statusLote}' não permite confirmação de pagamento.` },
        { status: 400 }
      );
    }

    // Confirmar pagamento
    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: { statusLote: "PAGAMENTO_APROVADO", dataPagamentoConfirmado: new Date() },
      select: {
        id: true, protocolo: true, statusLote: true, valorTotal: true,
        dataOrcamentoGerado: true, dataPagamentoConfirmado: true, dataEntregaEnviada: true,
        cliente: { select: { id: true, nomeRazaoSocial: true, email: true } },
      },
    });

    // Enfileirar processamento no QStash
    await qstash.publishJSON({
      url: WORKER_URL,
      body: { loteId, responsavel: "Equipe cClassTrib" },
    });

    return NextResponse.json({
      ok: true,
      mensagem: "Pagamento confirmado. Processamento iniciado automaticamente via QStash.",
      lote: loteAtualizado,
    });
  } catch (error) {
    console.error("Erro ao confirmar pagamento:", error);
    return NextResponse.json({ ok: false, error: "Erro ao confirmar pagamento." }, { status: 500 });
  }
}
