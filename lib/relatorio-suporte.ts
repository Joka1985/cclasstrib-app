import ExcelJS from "exceljs";

type LinhaAnalitica = {
  codigo: string | null;
  descricao: string | null;
  observacao: string | null;
};

type ResumoRelatorio = {
  totalItensPlanilhaValidos: number;
  totalItensUnicosConsiderados: number;
  totalRelacionadosAoXml: number;
  totalRelacionadosComDivergencia: number;
  totalSemRelacaoComCfopManual: number;
  totalSemRelacaoSemCfopManual: number;
  totalAptosParaAnalise: number;
  totalImprecisos: number;
  totalDuplicadosConsolidados: number;
  totalSomenteNoXml: number;
  totalDivergenciasNcm: number;
  totalDivergenciasDescricao: number;
};

type DadosRelatorio = {
  protocolo: string;
  loteId: string;
  cliente: string;
  documento: string;
  emailCliente: string;
  modoDocumentacao: string;
  resumo: ResumoRelatorio;
  analitico: {
    relacionadosComDivergencia: LinhaAnalitica[];
    semXmlComCfopManual: LinhaAnalitica[];
    semXmlSemCfopManual: LinhaAnalitica[];
    somenteNoXml: LinhaAnalitica[];
    duplicados: LinhaAnalitica[];
  };
};

function estilizarCabecalho(row: ExcelJS.Row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle", horizontal: "left" };
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFEFEF" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    };
  });
}

function ajustarColunasBasicas(worksheet: ExcelJS.Worksheet) {
  worksheet.columns = [
    { header: "Código", key: "codigo", width: 24 },
    { header: "Descrição", key: "descricao", width: 60 },
    { header: "Observação", key: "observacao", width: 70 },
  ];
}

function preencherAbaAnalitica(
  workbook: ExcelJS.Workbook,
  nomeAba: string,
  linhas: LinhaAnalitica[]
) {
  const ws = workbook.addWorksheet(nomeAba);

  ajustarColunasBasicas(ws);
  estilizarCabecalho(ws.getRow(1));

  if (linhas.length === 0) {
    ws.addRow({
      codigo: "",
      descricao: "Nenhuma ocorrência.",
      observacao: "",
    });
    return;
  }

  for (const linha of linhas) {
    ws.addRow({
      codigo: linha.codigo ?? "",
      descricao: linha.descricao ?? "",
      observacao: linha.observacao ?? "",
    });
  }
}

export async function gerarPlanilhaRelatorioAnalitico(
  dados: DadosRelatorio
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "cClassTrib";
  workbook.created = new Date();

  const resumo = workbook.addWorksheet("Resumo");

  resumo.columns = [
    { header: "Campo", key: "campo", width: 40 },
    { header: "Valor", key: "valor", width: 30 },
  ];

  estilizarCabecalho(resumo.getRow(1));

  const linhasResumo: Array<{ campo: string; valor: string | number }> = [
    { campo: "Protocolo", valor: dados.protocolo },
    { campo: "Lote ID", valor: dados.loteId },
    { campo: "Cliente", valor: dados.cliente },
    { campo: "CPF/CNPJ", valor: dados.documento },
    { campo: "E-mail do cliente", valor: dados.emailCliente },
    { campo: "Modo da documentação", valor: dados.modoDocumentacao },
    { campo: "Itens válidos da planilha", valor: dados.resumo.totalItensPlanilhaValidos },
    { campo: "Itens únicos considerados", valor: dados.resumo.totalItensUnicosConsiderados },
    { campo: "Relacionados ao XML", value: undefined as any, valor: dados.resumo.totalRelacionadosAoXml },
    { campo: "Relacionados com divergência", valor: dados.resumo.totalRelacionadosComDivergencia },
    { campo: "Sem XML com CFOP manual", valor: dados.resumo.totalSemRelacaoComCfopManual },
    { campo: "Sem XML sem CFOP manual", valor: dados.resumo.totalSemRelacaoSemCfopManual },
    { campo: "Aptos para análise", valor: dados.resumo.totalAptosParaAnalise },
    { campo: "Imprecisos", valor: dados.resumo.totalImprecisos },
    { campo: "Duplicados consolidados", valor: dados.resumo.totalDuplicadosConsolidados },
    { campo: "Somente no XML", valor: dados.resumo.totalSomenteNoXml },
    { campo: "Divergências de NCM", valor: dados.resumo.totalDivergenciasNcm },
    { campo: "Divergências de descrição", valor: dados.resumo.totalDivergenciasDescricao },
  ];

  for (const linha of linhasResumo) {
    resumo.addRow(linha);
  }

  preencherAbaAnalitica(
    workbook,
    "Relacionados divergencia",
    dados.analitico.relacionadosComDivergencia
  );

  preencherAbaAnalitica(
    workbook,
    "Sem XML com CFOP",
    dados.analitico.semXmlComCfopManual
  );

  preencherAbaAnalitica(
    workbook,
    "Sem XML sem CFOP",
    dados.analitico.semXmlSemCfopManual
  );

  preencherAbaAnalitica(
    workbook,
    "Somente no XML",
    dados.analitico.somenteNoXml
  );

  preencherAbaAnalitica(
    workbook,
    "Duplicados",
    dados.analitico.duplicados
  );

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}