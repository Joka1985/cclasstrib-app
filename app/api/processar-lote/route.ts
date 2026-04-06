import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { executarProcessamentoClassificacao } from "@/lib/processar-classificacao";
import { gerarParametrizacaoDoLote } from "@/lib/parametrizacao-engine";
import { finalizarEntregaParametrizacao } from "@/lib/finalizar-entrega-parametrizacao";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let loteId: string | null = null;

  try {
    const body = await req.json();
    loteId = String(body?.loteId ?? "").trim();

    if (!loteId) {
      return NextResponse.json(
        { ok: false, mensagem: "loteId não informado." },
        { status: 400 }
      );
    }

    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
      select: {
        id: true,
        protocolo: true,
        statusLote: true,
        dataEntregaEnviada: true,
      },
    });

    if (!lote) {
      return NextResponse.json(
        { ok: false, mensagem: "Lote não encontrado." },
        { status: 404 }
      );
    }

    if (lote.dataEntregaEnviada) {
      return NextResponse.json({
        ok: true,
        mensagem: "Lote já entregue anteriormente.",
        loteId: lote.id,
        protocolo: lote.protocolo,
        statusLote: lote.statusLote,
      });
    }

    await prisma.lote.update({
      where: { id: lote.id },
      data: {
        statusLote: "EM_PROCESSAMENTO",
        dataProcessamentoIniciado: new Date(),
      },
    });

    await executarProcessamentoClassificacao({
      loteId: lote.id,
      ignorarPagamento: true,
      origem: "BOTAO_TESTE",
    });

    await gerarParametrizacaoDoLote({
      loteId: lote.id,
      responsavel: "Sistema",
    });

    const entrega = await finalizarEntregaParametrizacao({
      loteId: lote.id,
      ignorarPagamento: true,
    });

    await prisma.lote.update({
      where: { id: lote.id },
      data: {
        dataProcessamentoFim: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      mensagem: entrega.mensagem,
      loteId: entrega.lote?.id ?? lote.id,
      protocolo: entrega.lote?.protocolo ?? lote.protocolo,
      statusLote: entrega.lote?.statusLote ?? "PROCESSADO_COM_SUCESSO",
      emailEnviado: entrega.emailEnviado,
      emailErro: entrega.emailErro,
    });
  } catch (error) {
    console.error("Erro ao processar lote em segundo plano:", error);

    if (loteId) {
      try {
        await prisma.lote.update({
          where: { id: loteId },
          data: {
            statusLote: "ERRO_PROCESSAMENTO",
            dataProcessamentoFim: new Date(),
          },
        });
      } catch (updateError) {
        console.error("Erro ao atualizar lote para ERRO_PROCESSAMENTO:", updateError);
      }
    }

    return NextResponse.json(
      {
        ok: false,
        mensagem:
          error instanceof Error
            ? error.message
            : "Erro interno ao processar o lote.",
      },
      { status: 500 }
    );
  }
}