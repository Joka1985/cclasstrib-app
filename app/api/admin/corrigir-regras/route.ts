import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.ADMIN_SECRET ?? "cclasstrib-admin"}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Buscar bases publicadas
  const bases = await prisma.baseOficialClassificacao.findMany({
    where: { versaoNormativa: { publicada: true, fonteNormativa: { tipoFonte: "CCLASSTRIB_OFICIAL" } } },
    select: { id: true, cclassTrib: true }
  });
  const mapaBase: Record<string, string> = {};
  bases.forEach(b => { mapaBase[b.cclassTrib] = b.id; });

  // Mapeamento de cClassTrib errados para corretos
  const mapa: Record<string, string> = {
    "210001": "200034",
    "210002": "200035",
    "210003": "200038",
  };

  // Corrigir regras sem base
  const semBase = await prisma.regraAnexoContextual.findMany({
    where: { ativa: true, baseOficialClassificacaoId: null },
    select: { id: true, cClassTrib: true, anexo: true }
  });

  const corrigidas: string[] = [];
  for (const r of semBase) {
    const cc = mapa[r.cClassTrib] ?? r.cClassTrib;
    const baseId = mapaBase[cc];
    if (baseId) {
      await prisma.regraAnexoContextual.update({
        where: { id: r.id },
        data: { cClassTrib: cc, baseOficialClassificacaoId: baseId }
      });
      corrigidas.push(`${r.anexo}:${r.cClassTrib}->${cc}`);
    }
  }

  // Corrigir regras com cClassTrib errado
  for (const [errado, correto] of Object.entries(mapa)) {
    const erradas = await prisma.regraAnexoContextual.findMany({
      where: { ativa: true, cClassTrib: errado },
      select: { id: true }
    });
    const baseId = mapaBase[correto];
    if (baseId) {
      for (const r of erradas) {
        await prisma.regraAnexoContextual.update({
          where: { id: r.id },
          data: { cClassTrib: correto, baseOficialClassificacaoId: baseId }
        });
        corrigidas.push(`${errado}->${correto}`);
      }
    }
  }

  // Verificar resultado
  const semBaseApos = await prisma.regraAnexoContextual.count({
    where: { ativa: true, baseOficialClassificacaoId: null }
  });

  return NextResponse.json({
    ok: true,
    basesDisponiveis: Object.keys(mapaBase).length,
    corrigidas,
    totalCorrigidas: corrigidas.length,
    semBaseAindaPendentes: semBaseApos,
  });
}
