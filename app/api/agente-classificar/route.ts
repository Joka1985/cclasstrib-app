/**
 * POST /api/agente-classificar
 *
 * Classifica uma operação avulsa via Agente IA cClassTrib (7 subagentes).
 * Não requer loteId — ideal para consulta rápida na interface.
 */

import { NextRequest, NextResponse } from "next/server";
import { classificarComAgenteIA } from "@/lib/agente-cclasstrib";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { descricao, ncm, cfop, tipoOperacao, regime, cnae, contexto } = body;

    if (!descricao || !tipoOperacao) {
      return NextResponse.json(
        { ok: false, error: "Campos obrigatórios: descricao e tipoOperacao." },
        { status: 400 }
      );
    }

    const resultado = await classificarComAgenteIA({
      descricao: String(descricao),
      ncm: ncm ? String(ncm) : null,
      cfop: cfop ? String(cfop) : null,
      tipoOperacao: String(tipoOperacao),
      regime: regime ? String(regime) : undefined,
      cnae: cnae ? String(cnae) : null,
      contexto: contexto ? String(contexto) : null,
    });

    return NextResponse.json({ ok: true, resultado });
  } catch (err) {
    console.error("[/api/agente-classificar] Erro:", err);
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Erro interno ao classificar.",
      },
      { status: 500 }
    );
  }
}
