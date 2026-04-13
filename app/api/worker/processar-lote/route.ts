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
  const body = await req.text();
  const signature = req.headers.get("upstash-signature") ?? "";

  try {
    await receiver.verify({ signature, body });
  } catch {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  const payload = JSON.parse(body) as {
    loteId: string;
    responsavel: string;
  };

  const { loteId, responsavel } = payload;

  try {
    // Verificar se já foi processado (evitar duplo processamento)
    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
      select: { statusLote: true, itensCobraveis: true }
    });

    if (!lote) {
      return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });
    }

    if (lote.statusLote !== "PAGAMENTO_APROVADO") {
      return NextResponse.json({ ok: true, mensagem: "Lote já processado, ignorando." });
    }

    // Processar o lote completo (motor já usa batch interno de 500)
    const resultado = await gerarParametrizacaoDoLote({ loteId, responsavel });

    // Finalizar e entregar se houver itens cobráveis
    let emailEnviado = false;
    if (resultado.totalFechados + resultado.totalRessalva > 0) {
      const entrega = await finalizarEntregaParametrizacao({
        loteId,
        ignorarPagamento: true,
      });
      emailEnviado = entrega.emailEnviado;
    }

    return NextResponse.json({
      ok: true,
      protocolo: resultado.protocolo,
      fechados: resultado.totalFechados,
      ressalva: resultado.totalRessalva,
      revisar: resultado.totalRevisar,
      emailEnviado,
    });
  } catch (error) {
    console.error("Erro no worker QStash:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erro no worker" },
      { status: 200 }
    );
  }
}
