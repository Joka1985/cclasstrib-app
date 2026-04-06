import { NextResponse } from "next/server";
import { registrarTabelaNcmComoDownloadComplementar } from "@/lib/ncm-complementar-node";

export const runtime = "nodejs";

export async function GET() {
  try {
    const resultado = await registrarTabelaNcmComoDownloadComplementar();
    return NextResponse.json(resultado);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        erro: error instanceof Error ? error.message : "Erro desconhecido",
      },
      { status: 500 },
    );
  }
}