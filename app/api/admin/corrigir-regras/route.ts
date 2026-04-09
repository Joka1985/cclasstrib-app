import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { gerarParametrizacaoDoLote } from "@/lib/parametrizacao-engine";
import { finalizarEntregaParametrizacao } from "@/lib/finalizar-entrega-parametrizacao";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.ADMIN_SECRET ?? "cclasstrib-admin"}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const loteId = body.loteId as string | undefined;
  const cpfCnpj = body.cpfCnpj as string | undefined;

  // ── Corrigir regras ──────────────────────────────────────────────────────
  const bases = await prisma.baseOficialClassificacao.findMany({
    where: { versaoNormativa: { publicada: true, fonteNormativa: { tipoFonte: "CCLASSTRIB_OFICIAL" } } },
    select: { id: true, cclassTrib: true }
  });
  const mapaBase: Record<string, string> = {};
  bases.forEach(b => { mapaBase[b.cclassTrib] = b.id; });

  const mapa: Record<string, string> = { "210001": "200034", "210002": "200035", "210003": "200038" };
  const semBase = await prisma.regraAnexoContextual.findMany({
    where: { ativa: true, baseOficialClassificacaoId: null },
    select: { id: true, cClassTrib: true }
  });
  for (const r of semBase) {
    const cc = mapa[r.cClassTrib] ?? r.cClassTrib;
    const baseId = mapaBase[cc];
    if (baseId) await prisma.regraAnexoContextual.update({ where: { id: r.id }, data: { cClassTrib: cc, baseOficialClassificacaoId: baseId } });
  }

  // ── Reprocessar lote específico ou todos os lotes com 0 cobráveis ────────
  const where: Record<string, unknown> = { itensCobraveis: 0, quantidadeLinhasValidas: { gt: 0 } };
  if (loteId) {
    // Processar lote específico
    const lote = await prisma.lote.findUnique({ where: { id: loteId }, select: { id: true, protocolo: true } });
    if (!lote) return NextResponse.json({ error: "Lote não encontrado." }, { status: 404 });

    await prisma.resultadoParametrizacao.deleteMany({ where: { loteId } });
    await prisma.filaRevisaoTributaria.deleteMany({ where: { loteId } });
    await prisma.lote.update({ where: { id: loteId }, data: { itensCobraveis: 0, itensComRessalva: 0, itensImprecisos: 0, statusLote: "PAGAMENTO_APROVADO" } });

    const param = await gerarParametrizacaoDoLote({ loteId, responsavel: "Equipe cClassTrib" });

    let emailEnviado = false;
    if (param.totalFechados + param.totalRessalva > 0) {
      const entrega = await finalizarEntregaParametrizacao({ loteId, ignorarPagamento: true });
      emailEnviado = entrega.emailEnviado;
    }

    return NextResponse.json({
      ok: true,
      protocolo: lote.protocolo,
      fechados: param.totalFechados,
      ressalva: param.totalRessalva,
      revisar: param.totalRevisar,
      emailEnviado,
    });
  }

  return NextResponse.json({ ok: true, mensagem: "Use loteId para reprocessar um lote específico.", basesDisponiveis: Object.keys(mapaBase).length });
}
