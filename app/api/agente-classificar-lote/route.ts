/**
 * POST /api/agente-classificar-lote
 *
 * Classifica múltiplos itens via Agente IA cClassTrib.
 * Máximo 50 itens por requisição.
 */

import { NextRequest, NextResponse } from "next/server";
import { classificarLoteComAgenteIA, ItemLoteAgente } from "@/lib/agente-cclasstrib";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { itens } = body as { itens: ItemLoteAgente[] };

    if (!itens || !Array.isArray(itens) || itens.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Envie um array "itens" com ao menos 1 item.' },
        { status: 400 }
      );
    }

    if (itens.length > 50) {
      return NextResponse.json(
        { ok: false, error: "Máximo de 50 itens por requisição." },
        { status: 400 }
      );
    }

    const resultados = await classificarLoteComAgenteIA(itens);

    return NextResponse.json({ ok: true, resultados });
  } catch (err) {
    console.error("[/api/agente-classificar-lote] Erro:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Erro interno ao classificar lote.",
      },
      { status: 500 }
    );
  }
}
