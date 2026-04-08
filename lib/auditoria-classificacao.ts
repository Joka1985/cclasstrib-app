/**
 * auditoria-classificacao.ts
 *
 * Aplica regras de auditoria em cada linha e calcula
 * o índice de precisão do lote para classificar a entrega
 * como SEM RESSALVA ou COM RESSALVA.
 */

export type StatusAuditoria = "✅ CORRETO" | "❌ ERRO" | "⚠️ REVISÃO";

export type ResultadoAuditoria = {
  statusAuditoria: StatusAuditoria;
  apontamento: string;
};

export type IndiceAuditoria = {
  totalItens: number;
  totalCorretos: number;
  totalErros: number;
  totalRevisao: number;
  precisao: number; // 0-100
  entregaComRessalva: boolean;
  resumo: string;
};

export function auditarClassificacao(params: {
  ncm: string | null;
  cfop: string | null;
  cst: string | null;
  cclassTrib: string | null;
  descricao: string | null;
}): ResultadoAuditoria {
  const ncm = String(params.ncm ?? "").replace(/\D/g, "");
  const cfop = String(params.cfop ?? "").replace(/\D/g, "");
  const cst = String(params.cst ?? "").trim();
  const desc = String(params.descricao ?? "").toUpperCase();

  // ── ERROS CONFIRMADOS ────────────────────────────────────────────────────

  if ((ncm === "25010020" || ncm === "25010090") && cst === "000") {
    return {
      statusAuditoria: "❌ ERRO",
      apontamento:
        "Sal iodado NCM 2501.00.20/90 é Cesta Básica (Anexo I, Art. 125 LC 214/2025). Correto: CST 200 / 200003 — alíquota zero.",
    };
  }

  if (ncm.startsWith("2303") && cst === "000") {
    return {
      statusAuditoria: "❌ ERRO",
      apontamento:
        "Bagaço de cana NCM 2303 é insumo agropecuário (Anexo IX, item 20, Art. 138 LC 214/2025). Correto: CST 200 / 200038 — redução 60%.",
    };
  }

  // ── REVISÃO E CONFIRMAÇÃO ─────────────────────────────────────────────────

  if (ncm.startsWith("2207") && cfop === "5910") {
    return {
      statusAuditoria: "⚠️ REVISÃO",
      apontamento:
        "Etanol com CFOP 5910 (bonificação/doação). Confirmar: se for venda onerosa de combustível, correto seria CST 620 / 620001 (monofásico, Art. 172).",
    };
  }

  if (
    ncm.startsWith("2106") &&
    cst === "000" &&
    (desc.includes("QUEIJO") || desc.includes("CHEDDAR") || desc.includes("MOZZARELLA"))
  ) {
    return {
      statusAuditoria: "⚠️ REVISÃO",
      apontamento:
        "Queijo classificado no cap. 21 (preparações). Se for queijo natural, NCM correto seria cap. 04 — confirmar com fornecedor.",
    };
  }

  if (ncm === "28363000" && cst === "000") {
    return {
      statusAuditoria: "⚠️ REVISÃO",
      apontamento:
        "Bicarbonato NCM 2836.30 consta no Anexo VI como componente de nutrição enteral. Se uso for industrial/doméstico, CST 000 está correto — confirmar destinação.",
    };
  }

  if (ncm.startsWith("2710") && cst === "000") {
    return {
      statusAuditoria: "⚠️ REVISÃO",
      apontamento:
        "Óleo mineral NCM 2710. Se destinado como insumo agropecuário pode ter redução Anexo IX. Se uso industrial, CST 000 está correto — confirmar destinação.",
    };
  }

  if (
    ncm.startsWith("2106") &&
    cst === "000" &&
    (desc.includes("REFRESCO") || desc.includes("TANG") || desc.includes("CLIGHT"))
  ) {
    return {
      statusAuditoria: "⚠️ REVISÃO",
      apontamento:
        "Preparação em pó para bebida NCM 2106. Confirmar subposição exata — pode haver enquadramento diferente dependendo da composição.",
    };
  }

  if (ncm.startsWith("1602") && cst === "000") {
    return {
      statusAuditoria: "⚠️ REVISÃO",
      apontamento:
        "Carne preparada/empanada NCM 1602. Anexo I cobre carnes in natura (cap. 02). CST 000 provavelmente correto — confirmar por precaução.",
    };
  }

  return {
    statusAuditoria: "✅ CORRETO",
    apontamento: "",
  };
}

export function calcularIndiceAuditoria(
  resultados: ResultadoAuditoria[]
): IndiceAuditoria {
  const totalItens = resultados.length;
  const totalErros = resultados.filter((r) => r.statusAuditoria === "❌ ERRO").length;
  const totalRevisao = resultados.filter((r) => r.statusAuditoria === "⚠️ REVISÃO").length;
  const totalCorretos = totalItens - totalErros - totalRevisao;

  // Precisão: itens sem erro ou revisão / total
  // Erros pesam 100%, revisões pesam 50% na penalização
  const penalizacao = totalErros * 1.0 + totalRevisao * 0.5;
  const precisao = totalItens > 0
    ? Math.max(0, Math.round(((totalItens - penalizacao) / totalItens) * 100))
    : 100;

  const entregaComRessalva = totalErros > 0 || totalRevisao > 0;

  let resumo: string;
  if (!entregaComRessalva) {
    resumo = `Entrega SEM RESSALVA — precisão 100% (${totalItens} itens auditados).`;
  } else if (totalErros > 0 && totalRevisao > 0) {
    resumo = `Entrega COM RESSALVA — precisão ${precisao}% | ${totalErros} erro(s) confirmado(s) e ${totalRevisao} item(ns) para revisão em ${totalItens} auditados.`;
  } else if (totalErros > 0) {
    resumo = `Entrega COM RESSALVA — precisão ${precisao}% | ${totalErros} erro(s) confirmado(s) em ${totalItens} itens auditados.`;
  } else {
    resumo = `Entrega COM RESSALVA — precisão ${precisao}% | ${totalRevisao} item(ns) requer(em) confirmação em ${totalItens} auditados.`;
  }

  return {
    totalItens,
    totalCorretos,
    totalErros,
    totalRevisao,
    precisao,
    entregaComRessalva,
    resumo,
  };
}