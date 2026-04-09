import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { prisma } from "@/lib/prisma";
import { gerarParametrizacaoDoLote } from "@/lib/parametrizacao-engine";
import { finalizarEntregaParametrizacao } from "@/lib/finalizar-entrega-parametrizacao";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

export async function POST(req: NextRequest) {
  // Verificar assinatura do QStash
  const body = await req.text();
  const signature = req.headers.get("upstash-signature") ?? "";

  try {
    await receiver.verify({ signature, body });
  } catch {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  const payload = JSON.parse(body) as {
    loteId: string;
    batchIndex: number;
    totalBatches: number;
    responsavel: string;
  };

  const { loteId, batchIndex, totalBatches, responsavel } = payload;

  try {
    // Processar o batch específico
    await gerarParametrizacaoDoLote({
      loteId,
      responsavel,
      batchIndex,
      totalBatches,
    });

    // Se foi o último batch, finalizar e entregar
    if (batchIndex === totalBatches - 1) {
      // Aguardar todos os batches gravarem
      await new Promise((r) => setTimeout(r, 2000));

      const lote = await prisma.lote.findUnique({
        where: { id: loteId },
        select: { itensCobraveis: true, itensComRessalva: true }
      });

      if ((lote?.itensCobraveis ?? 0) > 0) {
        await finalizarEntregaParametrizacao({ loteId, ignorarPagamento: true });
      }
    }

    return NextResponse.json({ ok: true, batchIndex, totalBatches });
  } catch (error) {
    console.error(`Erro no batch ${batchIndex}:`, error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro no worker" },
      { status: 500 }
    );
  }
}
