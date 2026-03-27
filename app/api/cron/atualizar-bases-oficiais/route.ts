import { NextRequest, NextResponse } from "next/server";
import { atualizarTodasFontesNormativasAtivas } from "@/lib/normative-updater";
import { executarBootstrapAutomatico } from "@/lib/system-bootstrap";

export async function POST(req: NextRequest) {
  try {
    await executarBootstrapAutomatico();

    const tokenRecebido = req.headers.get("x-cron-token");
    const tokenEsperado = process.env.CRON_TOKEN;

    if (!tokenEsperado) {
      return NextResponse.json(
        { ok: false, error: "CRON_TOKEN não configurado." },
        { status: 500 }
      );
    }

    if (tokenRecebido !== tokenEsperado) {
      return NextResponse.json(
        { ok: false, error: "Não autorizado." },
        { status: 401 }
      );
    }

    const resultados = await atualizarTodasFontesNormativasAtivas();

    return NextResponse.json({
      ok: true,
      mensagem: "Atualização normativa executada.",
      resultados,
    });
  } catch (error) {
    console.error("Erro no cron de atualização normativa:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao executar atualização normativa.",
      },
      { status: 500 }
    );
  }
}