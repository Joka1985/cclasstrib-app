type ResultadoAuditoria = {
  statusAuditoria: "✅ CORRETO" | "❌ ERRO" | "⚠️ REVISÃO";
  apontamento: string;
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

  // Sal iodado NCM 2501.00.20 ou 2501.00.90 → deve ser CST 200 / 200003
  if ((ncm === "25010020" || ncm === "25010090") && cst === "000") {
    return {
      statusAuditoria: "❌ ERRO",
      apontamento:
        "Sal iodado NCM 2501.00.20/90 é Cesta Básica (Anexo I, Art. 125 LC 214/2025). Correto: CST 200 / 200003 — alíquota zero.",
    };
  }

  // Bagaço de cana NCM 2303 → deve ser CST 200 / 200038
  if (ncm.startsWith("2303") && cst === "000") {
    return {
      statusAuditoria: "❌ ERRO",
      apontamento:
        "Bagaço de cana NCM 2303 é insumo agropecuário (Anexo IX, item 20, Art. 138 LC 214/2025). Correto: CST 200 / 200038 — redução 60%.",
    };
  }

  // ── REVISÃO E CONFIRMAÇÃO ─────────────────────────────────────────────────

  // Etanol CFOP 5910 → confirmar natureza da operação
  if (ncm.startsWith("2207") && cfop === "5910") {
    return {
      statusAuditoria: "⚠️ REVISÃO",
      apontamento:
        "Etanol com CFOP 5910 (bonificação/doação). Confirmar com cliente: se for venda onerosa de combustível, correto seria CST 620 / 620001 (monofásico, Art. 172).",
    };
  }

  // Queijo fatiado NCM 2106 → confirmar NCM correto
  if (
    ncm.startsWith("2106") &&
    cst === "000" &&
    (desc.includes("QUEIJO") || desc.includes("CHEDDAR") || desc.includes("MOZZARELLA"))
  ) {
    return {
      statusAuditoria: "⚠️ REVISÃO",
      apontamento:
        "Queijo classificado no cap. 21 (preparações). Se for queijo natural, NCM correto seria cap. 04 (CST 200 / 200034). Confirmar NCM com fornecedor.",
    };
  }

  // Bicarbonato de sódio NCM 2836.30 → confirmar uso
  if (ncm === "28363000" && cst === "000") {
    return {
      statusAuditoria: "⚠️ REVISÃO",
      apontamento:
        "Bicarbonato NCM 2836.30.00 consta no Anexo VI como componente de nutrição enteral. Se uso for industrial/doméstico, CST 000 está correto. Confirmar destinação.",
    };
  }

  // Óleo mineral NCM 2710 → confirmar uso agrícola ou industrial
  if (ncm.startsWith("2710") && cst === "000") {
    return {
      statusAuditoria: "⚠️ REVISÃO",
      apontamento:
        "Óleo mineral NCM 2710. Se destinado como insumo agropecuário (lubrificante agrícola), pode ter redução Anexo IX. Se uso industrial geral, CST 000 está correto. Confirmar destinação.",
    };
  }

  // Refresco/bebida em pó NCM 2106 → confirmar subposição
  if (
    ncm.startsWith("2106") &&
    cst === "000" &&
    (desc.includes("REFRESCO") || desc.includes("TANG") || desc.includes("CLIGHT"))
  ) {
    return {
      statusAuditoria: "⚠️ REVISÃO",
      apontamento:
        "Preparação em pó para bebida NCM 2106. Confirmar subposição exata. Se contiver vitaminas com finalidade específica pode haver enquadramento diferente.",
    };
  }

  // Steak empanado NCM 1602 → provavelmente correto
  if (ncm.startsWith("1602") && cst === "000") {
    return {
      statusAuditoria: "⚠️ REVISÃO",
      apontamento:
        "Carne preparada/empanada NCM 1602. Anexo I cobre carnes in natura (cap. 02). CST 000 provavelmente correto — confirmar por precaução.",
    };
  }

  // ── CORRETO ───────────────────────────────────────────────────────────────
  return {
    statusAuditoria: "✅ CORRETO",
    apontamento: "",
  };
}