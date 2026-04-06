import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const linhas = await prisma.baseOficialClassificacao.findMany({
  select: {
    cstIbsCbs: true,
    cclassTrib: true,
    anexo: true,
    artigoLc214: true,
    descricaoCclassTrib: true,
    tipoAliquota: true,
    pRedIbs: true,
    pRedCbs: true,
  },
  take: 50,
});

  return NextResponse.json({
    total: linhas.length,
    linhas,
  });
}