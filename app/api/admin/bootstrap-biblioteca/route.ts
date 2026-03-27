import { NextRequest, NextResponse } from "next/server";
import { bootstrapBibliotecaCClassTrib } from "@/lib/bootstrap-biblioteca";

export async function POST(req: NextRequest) {
  try {
    const tokenRecebido = req.headers.get("x-admin-token");
    const tokenEsperado = process.env.ADMIN_BOOTSTRAP_TOKEN;

    if (!tokenEsperado) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_BOOTSTRAP_TOKEN não configurado." },
        { status: 500 }
      );
    }

    if (tokenRecebido !== tokenEsperado) {
      return NextResponse.json(
        { ok: false, error: "Não autorizado." },
        { status: 401 }
      );
    }

    const resultado = await bootstrapBibliotecaCClassTrib();

    return NextResponse.json({
  mensagem: "Biblioteca cClassTrib bootstrapada com sucesso.",
  ...resultado,
});
  } catch (error) {
    console.error("Erro ao bootstrapar biblioteca cClassTrib:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao bootstrapar biblioteca cClassTrib.",
      },
      { status: 500 }
    );
  }
}