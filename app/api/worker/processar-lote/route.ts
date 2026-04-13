import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { prisma } from "@/lib/prisma";
import { processarBatchDoLote } from "@/lib/parametrizacao-engine";
import { finalizarEntregaParametrizacao } from "@/lib/finalizar-entrega-parametrizacao";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
});

const BATCH_SIZE = 90;

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("upstash-signature") ?? "";
  try {
    await receiver.verify({ signature, body });
  } catch {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 200 });
  }

  const payload = JSON.parse(body) as {
    loteId: string;
    batchIndex: number;
    totalBatches: number;
    responsavel: string;
  };
  const { loteId, batchIndex, totalBatches, responsavel } = payload;

  try {
    // Verificar se lote existe
    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
      select: { dataEntregaEnviada: true, itensCobraveis: true }
    });
    if (!lote) return NextResponse.json({ ok: false, mensagem: "Lote não encontrado." }, { status: 200 });
    if (lote.dataEntregaEnviada) return NextResponse.json({ ok: true, mensagem: "Já entregue." }, { status: 200 });

    // Processar batch
    const resultado = await processarBatchDoLote({ loteId, batchIndex, batchSize: BATCH_SIZE, responsavel });

    // Se é o último batch — recontar e entregar
    if (batchIndex === totalBatches - 1) {
      await new Promise(r => setTimeout(r, 2000));

      const fechados = await prisma.resultadoParametrizacao.count({
        where: { loteId, statusDecisao: "FECHADO", abaDestino: "PARAMETRIZACAO_FINAL" }
      });
      const ressalva = await prisma.resultadoParametrizacao.count({
        where: { loteId, statusDecisao: "FECHADO_COM_RESSALVA", abaDestino: "PARAMETRIZACAO_FINAL" }
      });
      const revisar = await prisma.filaRevisaoTributaria.count({ where: { loteId } });

      await prisma.lote.update({
        where: { id: loteId },
        data: {
          itensCobraveis: fechados + ressalva,
          itensComRessalva: ressalva,
          itensImprecisos: revisar,
          statusLote: fechados + ressalva > 0 ? "PROCESSADO_COM_SUCESSO" : "PROCESSADO_COM_REVISAO_HUMANA",
        }
      });

      if (fechados + ressalva > 0) {
        await finalizarEntregaParametrizacao({ loteId, ignorarPagamento: true });
      }
    }

    return NextResponse.json({ ok: true, batchIndex, processados: resultado.processados }, { status: 200 });
  } catch (error) {
    console.error(`Erro worker batch ${batchIndex}:`, error);
    return NextResponse.json({ ok: false, erro: error instanceof Error ? error.message : "Erro" }, { status: 200 });
  }
}
