import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { qstash, WORKER_URL } from "@/lib/qstash";

const BATCH_SIZE = 90;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loteId = body.loteId as string | undefined;
    if (!loteId) return NextResponse.json({ ok: false, error: "loteId é obrigatório." }, { status: 400 });

    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
      select: {
        id: true, protocolo: true, statusLote: true,
        dataOrcamentoGerado: true, dataPagamentoConfirmado: true,
        valorTotal: true, quantidadeLinhasValidas: true,
        cliente: { select: { id: true, nomeRazaoSocial: true, email: true } },
      },
    });

    if (!lote) return NextResponse.json({ ok: false, error: "Lote não encontrado." }, { status: 404 });
    if (!lote.dataOrcamentoGerado) return NextResponse.json({ ok: false, error: "Gere o orçamento antes de confirmar o pagamento." }, { status: 400 });
    if (lote.dataPagamentoConfirmado) return NextResponse.json({ ok: true, mensagem: "Pagamento já confirmado anteriormente.", lote });

    const statusPermitidos = ["ORCAMENTO_GERADO", "AGUARDANDO_PAGAMENTO"];
    if (lote.statusLote && !statusPermitidos.includes(String(lote.statusLote))) {
      return NextResponse.json({ ok: false, error: `Status '${lote.statusLote}' não permite confirmação.` }, { status: 400 });
    }

    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: { statusLote: "PAGAMENTO_APROVADO", dataPagamentoConfirmado: new Date() },
      select: {
        id: true, protocolo: true, statusLote: true, valorTotal: true,
        dataOrcamentoGerado: true, dataPagamentoConfirmado: true, dataEntregaEnviada: true,
        cliente: { select: { id: true, nomeRazaoSocial: true, email: true } },
      },
    });

    // Calcular batches e publicar no QStash
    const totalItens = lote.quantidadeLinhasValidas ?? 0;
    const totalBatches = Math.max(1, Math.ceil(totalItens / BATCH_SIZE));

    const jobs = Array.from({ length: totalBatches }, (_, i) =>
      qstash.publishJSON({
        url: WORKER_URL,
        body: { loteId, batchIndex: i, totalBatches, responsavel: "Equipe cClassTrib" },
        delay: i * 2, // 2s de delay entre batches para não sobrecarregar o banco
      })
    );
    await Promise.all(jobs);

    return NextResponse.json({
      ok: true,
      mensagem: `Pagamento confirmado. ${totalBatches} batch(es) enfileirado(s) — processamento automático iniciado.`,
      lote: loteAtualizado,
    });
  } catch (error) {
    console.error("Erro ao confirmar pagamento:", error);
    return NextResponse.json({ ok: false, error: "Erro ao confirmar pagamento." }, { status: 500 });
  }
}
