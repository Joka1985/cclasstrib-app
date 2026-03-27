import { NextRequest, NextResponse } from "next/server";
import { executarProcessamentoClassificacao } from "@/lib/processar-classificacao";
import { gerarParametrizacaoDoLote } from "@/lib/parametrizacao-engine";
import { finalizarEntregaParametrizacao } from "@/lib/finalizar-entrega-parametrizacao";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loteId = body.loteId as string | undefined;
    const ignorarPagamento = Boolean(body.ignorarPagamento);
    const responsavel = String(body.responsavel ?? "Equipe cClassTrib").trim();

    if (!loteId) {
      return NextResponse.json(
        { ok: false, error: "loteId é obrigatório." },
        { status: 400 }
      );
    }

    const processamento = await executarProcessamentoClassificacao({
      loteId,
      ignorarPagamento,
      origem: "API",
    });

    await gerarParametrizacaoDoLote({
      loteId,
      responsavel,
    });

    const entrega = await finalizarEntregaParametrizacao({
  loteId,
  ignorarPagamento,
     });

    return NextResponse.json({
      ok: true,
      mensagem: "Processamento, parametrização e entrega concluídos.",
      processamento,
      entrega,
    });
  } catch (error) {
    console.error("Erro ao processar classificação:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao processar classificação.",
      },
      { status: 500 }
    );
  }
}