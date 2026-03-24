import { NextRequest, NextResponse } from "next/server";
import { CNAES } from "@/lib/cnaes";

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export async function GET(req: NextRequest) {
  try {
    const termo = req.nextUrl.searchParams.get("q") ?? "";
    const termoNormalizado = normalizar(termo);

    if (!termoNormalizado) {
      return NextResponse.json({
        ok: true,
        resultados: [],
      });
    }

    const resultados = CNAES.filter((item) => {
      const codigo = normalizar(item.codigo);
      const descricao = normalizar(item.descricao);

      return (
        codigo.includes(termoNormalizado) ||
        descricao.includes(termoNormalizado)
      );
    }).slice(0, 20);

    return NextResponse.json({
      ok: true,
      resultados,
    });
  } catch (error) {
    console.error("Erro ao consultar CNAEs:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao consultar a base oficial de CNAE." },
      { status: 500 }
    );
  }
}