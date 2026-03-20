import { NextRequest, NextResponse } from "next/server";
import { CNAES } from "@/lib/cnaes";

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function somenteNumeros(valor: string) {
  return valor.replace(/\D/g, "");
}

export async function GET(req: NextRequest) {
  try {
    const termo = req.nextUrl.searchParams.get("q")?.trim() ?? "";

    if (!termo) {
      return NextResponse.json({ ok: true, resultados: [] });
    }

    const termoNormalizado = normalizar(termo);
    const termoNumerico = somenteNumeros(termo);

    const resultados = CNAES.filter((item) => {
      const codigoNormalizado = normalizar(item.codigo);
      const descricaoNormalizada = normalizar(item.descricao);
      const codigoNumerico = somenteNumeros(item.codigo);

      return (
        codigoNormalizado.includes(termoNormalizado) ||
        descricaoNormalizada.includes(termoNormalizado) ||
        (termoNumerico.length > 0 && codigoNumerico.includes(termoNumerico))
      );
    }).slice(0, 10);

    return NextResponse.json({
      ok: true,
      resultados,
    });
  } catch (error) {
    console.error("Erro ao consultar CNAE:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao consultar CNAE." },
      { status: 500 }
    );
  }
}