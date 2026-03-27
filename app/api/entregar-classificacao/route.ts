import { NextRequest, NextResponse } from "next/server";
import { finalizarEntregaParametrizacao } from "@/lib/finalizar-entrega-parametrizacao";

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

    const resultado = await finalizarEntregaParametrizacao({ loteId });

    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Erro ao entregar parametrização:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao entregar parametrização.",
      },
      { status: 500 }
    );
  }
}