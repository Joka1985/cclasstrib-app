/**
 * POST /api/processar-classificacao-ia
 *
 * Versão aprimorada da rota existente /api/processar-classificacao
 * que adiciona o Agente IA como fallback para casos REVISAR e SEM_EVIDENCIA.
 *
 * Fluxo:
 * 1. executarProcessamentoClassificacao (leitura/conferência de documentos)
 * 2. gerarParametrizacaoDoLote (motor de banco com regras dinâmicas)
 * 3. Para itens não resolvidos → Agente IA cClassTrib (7 subagentes)
 * 4. finalizarEntregaParametrizacao
 */

import { NextRequest, NextResponse } from "next/server";
import { executarProcessamentoClassificacao } from "@/lib/processar-classificacao";
import { gerarParametrizacaoDoLote } from "@/lib/parametrizacao-engine";
import { finalizarEntregaParametrizacao } from "@/lib/finalizar-entrega-parametrizacao";
import { classificarComAgenteIA } from "@/lib/agente-cclasstrib";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loteId = body.loteId as string | undefined;
    const ignorarPagamento = Boolean(body.ignorarPagamento);
    const usarAgenteIA = body.usarAgenteIA !== false; // padrão: true
    const responsavel = String(body.responsavel ?? "Equipe cClassTrib").trim();

    if (!loteId) {
      return NextResponse.json(
        { ok: false, error: "loteId é obrigatório." },
        { status: 400 }
      );
    }

    // ── 1. Processamento e triagem de documentos ─────────────────────────────
    const processamento = await executarProcessamentoClassificacao({
      loteId,
      ignorarPagamento,
      origem: "API",
    });

    // ── 2. Motor de banco (regras dinâmicas + base oficial) ──────────────────
    const parametrizacao = await gerarParametrizacaoDoLote({
      loteId,
      responsavel,
    });

    // ── 3. Agente IA como fallback para REVISAR e SEM_EVIDENCIA ──────────────
    let totalResolvidos = 0;

    if (usarAgenteIA) {
      // Buscar itens na fila de revisão desse lote
      const filaRevisao = await prisma.filaRevisaoTributaria.findMany({
        where: { loteId, statusDecisao: "REVISAR" },
        include: {
          itemPlanilha: true,
        },
      });

      for (const filaItem of filaRevisao) {
        if (!filaItem.itemPlanilha) continue;

        const item = filaItem.itemPlanilha;

        const resultadoAgente = await classificarComAgenteIA({
          descricao: item.descricaoItemOuServico,
          ncm: item.ncm,
          cfop: item.cfopInformadoManual,
          tipoOperacao: filaItem.sugestaoMotor ?? "VENDA_NORMAL",
          contexto: `NCM: ${item.ncm ?? "não informado"} | NBS: ${item.nbs ?? "não informado"}`,
        });

        if (!resultadoAgente.classificado || !resultadoAgente.cst || !resultadoAgente.cclassTrib) {
          // Agente também não conseguiu — mantém na fila com nota
          await prisma.filaRevisaoTributaria.update({
            where: { id: filaItem.id },
            data: {
              motivoRevisao: [
                filaItem.motivoRevisao,
                `[AgenteIA] ${resultadoAgente.justificativa.slice(0, 300)}`,
              ]
                .filter(Boolean)
                .join(" | "),
            },
          });
          continue;
        }

        // Agente resolveu → cria ResultadoParametrizacao
        const lote = await prisma.lote.findUnique({
          where: { id: loteId },
          select: { clienteId: true },
        });

        if (!lote) continue;

        await prisma.resultadoParametrizacao.upsert({
          where: {
            // Upsert por combinação lote + item
            id: `agente-${loteId}-${item.id}`,
          },
          create: {
            id: `agente-${loteId}-${item.id}`,
            loteId,
            clienteId: lote.clienteId,
            itemPlanilhaId: item.id,
            operacaoFiscalId: filaItem.operacaoFiscalId,
            baseOficialClassificacaoId:
              resultadoAgente.baseOficialClassificacaoId,
            codProduto: item.codigoItemOuServico,
            descricao: item.descricaoItemOuServico,
            ncm: item.ncm,
            cfop: item.cfopInformadoManual,
            cst: resultadoAgente.cst,
            cclassTrib: resultadoAgente.cclassTrib,
            descCclassTrib: resultadoAgente.descCclassTrib,
            pRedIbs: resultadoAgente.redIbs,
            pRedCbs: resultadoAgente.redCbs,
            artigoLc214: resultadoAgente.artigoLc214,
            observacoes: [
              resultadoAgente.justificativa.slice(0, 500),
              resultadoAgente.pendencias.join(" | "),
            ]
              .filter(Boolean)
              .join(" | "),
            responsavel: `${responsavel} (AgenteIA)`,
            dataReferencia: new Date(),
            statusDecisao:
              resultadoAgente.confianca === "Alta"
                ? "FECHADO"
                : "FECHADO_COM_RESSALVA",
            abaDestino: "PARAMETRIZACAO_FINAL",
            fundamento: resultadoAgente.artigoLc214,
            acaoProgramador:
              resultadoAgente.confianca === "Alta"
                ? "Parametrizar no ERP conforme linha final."
                : "Parametrizar com validação técnica prévia.",
          },
          update: {
            cst: resultadoAgente.cst,
            cclassTrib: resultadoAgente.cclassTrib,
            descCclassTrib: resultadoAgente.descCclassTrib,
            pRedIbs: resultadoAgente.redIbs,
            pRedCbs: resultadoAgente.redCbs,
            artigoLc214: resultadoAgente.artigoLc214,
            statusDecisao:
              resultadoAgente.confianca === "Alta"
                ? "FECHADO"
                : "FECHADO_COM_RESSALVA",
            baseOficialClassificacaoId:
              resultadoAgente.baseOficialClassificacaoId,
            updatedAt: new Date(),
          },
        });

        // Remove da fila de revisão
        await prisma.filaRevisaoTributaria.update({
          where: { id: filaItem.id },
          data: { statusDecisao: "FECHADO", dataFechamento: new Date() },
        });

        totalResolvidos++;
      }

      // Atualizar contadores do lote
      if (totalResolvidos > 0) {
        const loteAtual = await prisma.lote.findUnique({
          where: { id: loteId },
          select: { itensImprecisos: true, itensCobraveis: true, itensComRessalva: true },
        });

        if (loteAtual) {
          await prisma.lote.update({
            where: { id: loteId },
            data: {
              itensImprecisos: Math.max(
                0,
                loteAtual.itensImprecisos - totalResolvidos
              ),
              itensCobraveis: loteAtual.itensCobraveis + totalResolvidos,
            },
          });
        }
      }
    }

    // ── 4. Finalizar entrega ──────────────────────────────────────────────────
    const entrega = await finalizarEntregaParametrizacao({
      loteId,
      ignorarPagamento,
    });

    return NextResponse.json({
      ok: true,
      mensagem: "Processamento completo com Agente IA.",
      processamento,
      parametrizacao,
      agenteIA: { resolvidos: totalResolvidos },
      entrega,
    });
  } catch (error) {
    console.error("[/api/processar-classificacao-ia] Erro:", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Erro ao processar classificação.",
      },
      { status: 500 }
    );
  }
}
