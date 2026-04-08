import * as XLSX from "xlsx";
import { auditarClassificacao } from "@/lib/auditoria-classificacao";

export type LinhaParametrizacaoFinal = {
  codProduto: string;
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  cst: string | null;
  cclassTrib: string | null;
  descCclassTrib: string | null;
  tipoAliquota: string | null;
  pRedIbs: string | number | null;
  pRedCbs: string | number | null;
  artigoLc214: string | null;
  observacoes: string | null;
  dataReferencia: Date | string | null;
  responsavel: string | null;
};

export type LinhaAmbiguidade = {
  codProduto: string;
  produtoCenario: string;
  operacao: string | null;
  cfop: string | null;
  cst: string | null;
  cclassTrib: string | null;
  fundamentacao: string | null;
  resultado: string | null;
};

function formatarData(valor?: Date | string | null) {
  if (!valor) return "";
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleDateString("pt-BR");
}

function normalizarNumero(valor?: string | number | null) {
  if (valor == null || valor === "") return "";
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : String(valor);
}

function autoFitColumns(sheet: XLSX.WorkSheet, rows: Record<string, unknown>[]) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const widths = headers.map((header) => {
    let max = header.length;
    for (const row of rows) {
      const cellValue = row[header];
      const size = String(cellValue ?? "").length;
      if (size > max) max = size;
    }
    return { wch: Math.min(Math.max(max + 2, 12), 60) };
  });
  sheet["!cols"] = widths;
}

export function gerarWorkbookParametrizacao(params: {
  parametrizacaoFinal: LinhaParametrizacaoFinal[];
  cenariosAmbiguidade: LinhaAmbiguidade[];
}) {
  const wb = XLSX.utils.book_new();

  const linhasParametrizacao = params.parametrizacaoFinal.map((item) => {
    const { statusAuditoria, apontamento } = auditarClassificacao({
      ncm: item.ncm,
      cfop: item.cfop,
      cst: item.cst,
      cclassTrib: item.cclassTrib,
      descricao: item.descricao,
    });

    return {
      "CÓD_PRODUTO": item.codProduto,
      "DESCRIÇÃO": item.descricao,
      "NCM": item.ncm ?? "",
      "CFOP": item.cfop ?? "",
      "CST": item.cst ?? "",
      "cClassTrib": item.cclassTrib ?? "",
      "DESC_cClassTrib": item.descCclassTrib ?? "",
      "TIPO_ALÍQUOTA": item.tipoAliquota ?? "",
      "pRedIBS%": normalizarNumero(item.pRedIbs),
      "pRedCBS%": normalizarNumero(item.pRedCbs),
      "ARTIGO_LC214": item.artigoLc214 ?? "",
      "OBSERVAÇÕES": item.observacoes ?? "",
      "DATA": formatarData(item.dataReferencia),
      "RESPONSÁVEL": item.responsavel ?? "",
      "STATUS_AUDITORIA": statusAuditoria,
      "APONTAMENTO_AUDITORIA": apontamento,
    };
  });

  const linhasAmbiguidade = params.cenariosAmbiguidade.map((item) => ({
    "CÓD_PRODUTO": item.codProduto,
    "PRODUTO/CENÁRIO": item.produtoCenario,
    "OPERAÇÃO": item.operacao ?? "",
    "CFOP": item.cfop ?? "",
    "CST": item.cst ?? "",
    "cClassTrib": item.cclassTrib ?? "",
    "FUNDAMENTAÇÃO": item.fundamentacao ?? "",
    "RESULTADO": item.resultado ?? "",
  }));

  const wsParametrizacao = XLSX.utils.json_to_sheet(
    linhasParametrizacao.length
      ? linhasParametrizacao
      : [
          {
            "CÓD_PRODUTO": "", "DESCRIÇÃO": "", "NCM": "", "CFOP": "",
            "CST": "", "cClassTrib": "", "DESC_cClassTrib": "",
            "TIPO_ALÍQUOTA": "", "pRedIBS%": "", "pRedCBS%": "",
            "ARTIGO_LC214": "", "OBSERVAÇÕES": "", "DATA": "",
            "RESPONSÁVEL": "", "STATUS_AUDITORIA": "", "APONTAMENTO_AUDITORIA": "",
          },
        ]
  );

  const wsAmbiguidade = XLSX.utils.json_to_sheet(
    linhasAmbiguidade.length
      ? linhasAmbiguidade
      : [
          {
            "CÓD_PRODUTO": "", "PRODUTO/CENÁRIO": "", "OPERAÇÃO": "",
            "CFOP": "", "CST": "", "cClassTrib": "",
            "FUNDAMENTAÇÃO": "", "RESULTADO": "",
          },
        ]
  );

  autoFitColumns(wsParametrizacao, linhasParametrizacao);
  autoFitColumns(wsAmbiguidade, linhasAmbiguidade);

  XLSX.utils.book_append_sheet(wb, wsParametrizacao, "PARAMETRIZACAO_FINAL");
  XLSX.utils.book_append_sheet(wb, wsAmbiguidade, "CENARIOS_AMBIGUIDADE");

  return wb;
}

export function gerarArquivoParametrizacaoXlsx(params: {
  protocolo: string;
  parametrizacaoFinal: LinhaParametrizacaoFinal[];
  cenariosAmbiguidade: LinhaAmbiguidade[];
}) {
  const workbook = gerarWorkbookParametrizacao({
    parametrizacaoFinal: params.parametrizacaoFinal,
    cenariosAmbiguidade: params.cenariosAmbiguidade,
  });

  const buffer = XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
  }) as Buffer;

  const nomeArquivo = `parametrizacao-cclasstrib-${params.protocolo}.xlsx`;

  return {
    nomeArquivo,
    buffer,
    arquivoBase64: buffer.toString("base64"),
  };
}