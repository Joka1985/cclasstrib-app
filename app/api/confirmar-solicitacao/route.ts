import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import crypto from "node:crypto";
import {
  enviarEmailSolicitacaoCliente,
  enviarEmailRelatorioSuporte,
  enviarEmailOrcamentoCliente,
} from "@/lib/email";

type ResumoSolicitacao = {
  totalItensPlanilhaValidos: number;
  totalItensUnicosConsiderados: number;
  totalRelacionadosAoXml: number;
  totalRelacionadosComDivergencia: number;
  totalSemXmlComCfopManual: number;
  totalSemXmlSemCfopManual: number;
  totalAptosAnalise: number;
  totalImprecisos: number;
  totalDuplicadosConsolidados: number;
  totalSomenteNoXml: number;
  totalDivergenciasNcm: number;
  totalDivergenciasDescricao: number;
};

type ItemPlanilhaResumo = {
  codigo: string;
  descricao: string;
  ncm: string | null;
  cfopManual: string | null;
};

type ItemXmlResumo = {
  codigo: string | null;
  descricao: string;
  ncm: string | null;
  cfop: string | null;
};

type LinhaSimples = {
  codigo: string;
  descricao: string;
  observacao: string;
};

function normalizarDocumento(valor?: string | null) {
  return String(valor ?? "").replace(/\D/g, "");
}

function normalizarTexto(valor?: string | null) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizarCodigo(valor?: string | null) {
  const texto = String(valor ?? "").trim();
  if (!texto) return "";

  const somenteAlfanumerico = texto.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
  if (!somenteAlfanumerico) return "";

  if (/^\d+$/.test(somenteAlfanumerico)) {
    return String(Number(somenteAlfanumerico));
  }

  return somenteAlfanumerico;
}

function chaveDuplicidade(item: {
  codigo?: string | null;
  descricao?: string | null;
  ncm?: string | null;
  cfop?: string | null;
}) {
  return [
    normalizarCodigo(item.codigo),
    normalizarTexto(item.descricao),
    normalizarTexto(item.ncm),
    normalizarTexto(item.cfop),
  ].join("|");
}

function encontrarItemXmlRelacionado(
  itemPlanilha: ItemPlanilhaResumo,
  itensXml: ItemXmlResumo[],
  usados: Set<number>
) {
  const codigoPlanilha = normalizarCodigo(itemPlanilha.codigo);
  const descricaoPlanilha = normalizarTexto(itemPlanilha.descricao);
  const ncmPlanilha = normalizarTexto(itemPlanilha.ncm);

  if (codigoPlanilha) {
    for (let i = 0; i < itensXml.length; i++) {
      if (usados.has(i)) continue;

      const itemXml = itensXml[i];
      const codigoXml = normalizarCodigo(itemXml.codigo);

      if (codigoXml && codigoXml === codigoPlanilha) {
        return { itemXml, indice: i };
      }
    }
  }

  for (let i = 0; i < itensXml.length; i++) {
    if (usados.has(i)) continue;

    const itemXml = itensXml[i];
    const descricaoXml = normalizarTexto(itemXml.descricao);
    const ncmXml = normalizarTexto(itemXml.ncm);

    if (
      descricaoPlanilha &&
      descricaoXml &&
      descricaoPlanilha === descricaoXml &&
      ncmPlanilha &&
      ncmXml &&
      ncmPlanilha === ncmXml
    ) {
      return { itemXml, indice: i };
    }
  }

  for (let i = 0; i < itensXml.length; i++) {
    if (usados.has(i)) continue;

    const itemXml = itensXml[i];
    const descricaoXml = normalizarTexto(itemXml.descricao);

    if (descricaoPlanilha && descricaoXml && descricaoPlanilha === descricaoXml) {
      return { itemXml, indice: i };
    }
  }

  return null;
}

function calcularValorOrcamento(itensCobraveis: number) {
  const LOTE_MINIMO_QTDE = 10;
  const LOTE_MINIMO_VALOR = 9.99;

  const valorUnitarioBase = LOTE_MINIMO_VALOR / LOTE_MINIMO_QTDE;
  const valorUnitarioFaixa2 = valorUnitarioBase * 0.9;
  const valorUnitarioFaixa3 = valorUnitarioFaixa2 * 0.9;
  const valorUnitarioFaixa4 = valorUnitarioFaixa3 * 0.9;

  if (itensCobraveis <= 0) {
    return {
      valorUnitarioAplicado: 0,
      valorTotal: 0,
      faixa: "SEM_ITENS",
      descricaoFaixa: "Sem itens cobráveis",
    };
  }

  if (itensCobraveis <= 10) {
    return {
      valorUnitarioAplicado: Number(valorUnitarioBase.toFixed(4)),
      valorTotal: Number(LOTE_MINIMO_VALOR.toFixed(2)),
      faixa: "ATE_10",
      descricaoFaixa: "Lote mínimo até 10 produtos por R$ 9,99",
    };
  }

  if (itensCobraveis <= 30) {
    const valorCalculado = itensCobraveis * valorUnitarioFaixa2;

    return {
      valorUnitarioAplicado: Number(valorUnitarioFaixa2.toFixed(4)),
      valorTotal: Number(Math.max(LOTE_MINIMO_VALOR, valorCalculado).toFixed(2)),
      faixa: "11_A_30",
      descricaoFaixa:
        "Faixa de 11 a 30 produtos com 10% de desconto no valor unitário",
    };
  }

  if (itensCobraveis <= 100) {
    const valorCalculado = itensCobraveis * valorUnitarioFaixa3;

    return {
      valorUnitarioAplicado: Number(valorUnitarioFaixa3.toFixed(4)),
      valorTotal: Number(valorCalculado.toFixed(2)),
      faixa: "31_A_100",
      descricaoFaixa:
        "Faixa de 31 a 100 produtos com 20% de desconto acumulado no valor unitário",
    };
  }

  const valorCalculado = itensCobraveis * valorUnitarioFaixa4;

  return {
    valorUnitarioAplicado: Number(valorUnitarioFaixa4.toFixed(4)),
    valorTotal: Number(valorCalculado.toFixed(2)),
    faixa: "ACIMA_100",
    descricaoFaixa:
      "Faixa acima de 100 produtos com 30% de desconto acumulado no valor unitário",
  };
}

function ajustarLarguraResumo(sheet: XLSX.WorkSheet) {
  sheet["!cols"] = [{ wch: 40 }, { wch: 30 }];
}

function ajustarLarguraTresColunas(sheet: XLSX.WorkSheet) {
  sheet["!cols"] = [{ wch: 24 }, { wch: 60 }, { wch: 70 }];
}

function linhasOuNenhumaOcorrencia(linhas: LinhaSimples[]) {
  if (linhas.length > 0) {
    return linhas.map((linha) => ({
      Código: linha.codigo,
      Descrição: linha.descricao,
      Observação: linha.observacao,
    }));
  }

  return [
    {
      Código: "",
      Descrição: "Nenhuma ocorrência.",
      Observação: "",
    },
  ];
}

function montarWorkbookRelatorio(params: {
  protocolo: string;
  loteId: string;
  cliente: string;
  documento: string;
  emailCliente: string;
  modoDocumentacao: string;
  resumo: ResumoSolicitacao;
  relacionadosDivergencia: LinhaSimples[];
  semXmlComCfop: LinhaSimples[];
  semXmlSemCfop: LinhaSimples[];
  somenteNoXml: LinhaSimples[];
  duplicados: LinhaSimples[];
}) {
  const wb = XLSX.utils.book_new();

  const wsResumoData = [
    { Campo: "Protocolo", Valor: params.protocolo },
    { Campo: "Lote ID", Valor: params.loteId },
    { Campo: "Cliente", Valor: params.cliente },
    { Campo: "CPF/CNPJ", Valor: params.documento },
    { Campo: "E-mail do cliente", Valor: params.emailCliente },
    { Campo: "Modo da documentação", Valor: params.modoDocumentacao },
    { Campo: "Itens válidos da planilha", Valor: params.resumo.totalItensPlanilhaValidos },
    {
      Campo: "Itens únicos considerados",
      Valor: params.resumo.totalItensUnicosConsiderados,
    },
    { Campo: "Relacionados ao XML", Valor: params.resumo.totalRelacionadosAoXml },
    {
      Campo: "Relacionados com divergência",
      Valor: params.resumo.totalRelacionadosComDivergencia,
    },
    {
      Campo: "Sem XML com CFOP manual",
      Valor: params.resumo.totalSemXmlComCfopManual,
    },
    {
      Campo: "Sem XML sem CFOP manual",
      Valor: params.resumo.totalSemXmlSemCfopManual,
    },
    { Campo: "Aptos para análise", Valor: params.resumo.totalAptosAnalise },
    { Campo: "Imprecisos", Valor: params.resumo.totalImprecisos },
    {
      Campo: "Duplicados consolidados",
      Valor: params.resumo.totalDuplicadosConsolidados,
    },
    { Campo: "Somente no XML", Valor: params.resumo.totalSomenteNoXml },
    {
      Campo: "Divergências de NCM",
      Valor: params.resumo.totalDivergenciasNcm,
    },
    {
      Campo: "Divergências de descrição",
      Valor: params.resumo.totalDivergenciasDescricao,
    },
  ];

  const wsResumo = XLSX.utils.json_to_sheet(wsResumoData);
  const wsRelacionados = XLSX.utils.json_to_sheet(
    linhasOuNenhumaOcorrencia(params.relacionadosDivergencia)
  );
  const wsSemXmlComCfop = XLSX.utils.json_to_sheet(
    linhasOuNenhumaOcorrencia(params.semXmlComCfop)
  );
  const wsSemXmlSemCfop = XLSX.utils.json_to_sheet(
    linhasOuNenhumaOcorrencia(params.semXmlSemCfop)
  );
  const wsSomenteNoXml = XLSX.utils.json_to_sheet(
    linhasOuNenhumaOcorrencia(params.somenteNoXml)
  );
  const wsDuplicados = XLSX.utils.json_to_sheet(
    linhasOuNenhumaOcorrencia(params.duplicados)
  );

  ajustarLarguraResumo(wsResumo);
  ajustarLarguraTresColunas(wsRelacionados);
  ajustarLarguraTresColunas(wsSemXmlComCfop);
  ajustarLarguraTresColunas(wsSemXmlSemCfop);
  ajustarLarguraTresColunas(wsSomenteNoXml);
  ajustarLarguraTresColunas(wsDuplicados);

  XLSX.utils.book_append_sheet(wb, wsResumo, "Resumo");
  XLSX.utils.book_append_sheet(wb, wsRelacionados, "Relacionados divergencia");
  XLSX.utils.book_append_sheet(wb, wsSemXmlComCfop, "Sem XML com CFOP");
  XLSX.utils.book_append_sheet(wb, wsSemXmlSemCfop, "Sem XML sem CFOP");
  XLSX.utils.book_append_sheet(wb, wsSomenteNoXml, "Somente no XML");
  XLSX.utils.book_append_sheet(wb, wsDuplicados, "Duplicados");

  return wb;
}

function analisarConferencia(
  itensPlanilhaValidos: Array<{
    codigoItemOuServico: string;
    descricaoItemOuServico: string;
    ncm: string | null;
    cfopInformadoManual: string | null;
  }>,
  itensXmlRelacionados: ItemXmlResumo[]
) {
  const mapaItensUnicos = new Map<string, ItemPlanilhaResumo>();
  const contagemDuplicados = new Map<string, number>();

  for (const item of itensPlanilhaValidos) {
    const chave = chaveDuplicidade({
      codigo: item.codigoItemOuServico,
      descricao: item.descricaoItemOuServico,
      ncm: item.ncm,
      cfop: item.cfopInformadoManual,
    });

    contagemDuplicados.set(chave, (contagemDuplicados.get(chave) ?? 0) + 1);

    if (!mapaItensUnicos.has(chave)) {
      mapaItensUnicos.set(chave, {
        codigo: item.codigoItemOuServico,
        descricao: item.descricaoItemOuServico,
        ncm: item.ncm,
        cfopManual: item.cfopInformadoManual,
      });
    }
  }

  const itensUnicosPlanilha = Array.from(mapaItensUnicos.values());

  const duplicados: LinhaSimples[] = [];
  for (const [chave, quantidade] of contagemDuplicados.entries()) {
    if (quantidade > 1) {
      const item = mapaItensUnicos.get(chave);
      if (item) {
        duplicados.push({
          codigo: item.codigo,
          descricao: item.descricao,
          observacao: `Item duplicado na planilha (${quantidade} ocorrências).`,
        });
      }
    }
  }

  const xmlUsados = new Set<number>();
  const relacionadosDivergencia: LinhaSimples[] = [];
  const semXmlComCfop: LinhaSimples[] = [];
  const semXmlSemCfop: LinhaSimples[] = [];

  let totalRelacionadosAoXml = 0;
  let totalRelacionadosComDivergencia = 0;
  let totalSemXmlComCfopManual = 0;
  let totalSemXmlSemCfopManual = 0;
  let totalAptosAnalise = 0;
  let totalImprecisos = 0;
  let totalDivergenciasNcm = 0;
  let totalDivergenciasDescricao = 0;

  for (const item of itensUnicosPlanilha) {
    const match = encontrarItemXmlRelacionado(item, itensXmlRelacionados, xmlUsados);

    if (match) {
      xmlUsados.add(match.indice);
      totalRelacionadosAoXml += 1;
      totalAptosAnalise += 1;

      const descricaoPlanilha = normalizarTexto(item.descricao);
      const descricaoXml = normalizarTexto(match.itemXml.descricao);
      const ncmPlanilha = normalizarTexto(item.ncm);
      const ncmXml = normalizarTexto(match.itemXml.ncm);

      const observacoes: string[] = [];

      if (descricaoPlanilha && descricaoXml && descricaoPlanilha !== descricaoXml) {
        totalDivergenciasDescricao += 1;
        observacoes.push("Divergência de descrição");
      }

      if (ncmPlanilha && ncmXml && ncmPlanilha !== ncmXml) {
        totalDivergenciasNcm += 1;
        observacoes.push("Divergência de NCM");
      }

      if (observacoes.length > 0) {
        totalRelacionadosComDivergencia += 1;
        relacionadosDivergencia.push({
          codigo: item.codigo,
          descricao: item.descricao,
          observacao: observacoes.join(" | "),
        });
      }

      continue;
    }

    const possuiMinimos = Boolean(
      item.codigo && item.descricao && item.ncm && item.cfopManual
    );

    if (possuiMinimos && item.cfopManual) {
      totalSemXmlComCfopManual += 1;
      totalAptosAnalise += 1;

      semXmlComCfop.push({
        codigo: item.codigo,
        descricao: item.descricao,
        observacao: `Item sem relação com XML, informado com CFOP manual ${item.cfopManual}.`,
      });
    } else {
      totalSemXmlSemCfopManual += 1;
      totalImprecisos += 1;

      semXmlSemCfop.push({
        codigo: item.codigo,
        descricao: item.descricao,
        observacao: "Item sem relação com XML e sem CFOP manual.",
      });
    }
  }

  const somenteNoXml: LinhaSimples[] = itensXmlRelacionados
    .map((item, indice) => ({ item, indice }))
    .filter(({ indice }) => !xmlUsados.has(indice))
    .map(({ item }) => ({
      codigo: item.codigo ?? "",
      descricao: item.descricao,
      observacao: `Item existente apenas no XML. CFOP: ${item.cfop ?? "-"}.`,
    }));

  const resumo: ResumoSolicitacao = {
    totalItensPlanilhaValidos: itensPlanilhaValidos.length,
    totalItensUnicosConsiderados: itensUnicosPlanilha.length,
    totalRelacionadosAoXml,
    totalRelacionadosComDivergencia,
    totalSemXmlComCfopManual,
    totalSemXmlSemCfopManual,
    totalAptosAnalise,
    totalImprecisos,
    totalDuplicadosConsolidados: duplicados.length,
    totalSomenteNoXml: somenteNoXml.length,
    totalDivergenciasNcm,
    totalDivergenciasDescricao,
  };

  return {
    resumo,
    itensUnicosPlanilha,
    relacionadosDivergencia,
    semXmlComCfop,
    semXmlSemCfop,
    somenteNoXml,
    duplicados,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const loteId = body.loteId as string | undefined;

    if (!loteId) {
      return NextResponse.json(
        { ok: false, error: "loteId é obrigatório." },
        { status: 400 }
      );
    }

    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
      include: {
        cliente: true,
        itensPlanilha: {
          orderBy: { linhaOrigem: "asc" },
        },
        xmlDocumentos: {
          include: {
            itensXml: true,
          },
        },
      },
    });

    if (!lote) {
      return NextResponse.json(
        { ok: false, error: "Lote não encontrado." },
        { status: 404 }
      );
    }

    const itensPlanilhaValidos = lote.itensPlanilha.filter((item) => item.linhaValida);

    if (itensPlanilhaValidos.length === 0) {
      return NextResponse.json(
        { ok: false, error: "O lote não possui itens válidos na planilha." },
        { status: 400 }
      );
    }

    const itensXmlRelacionados: ItemXmlResumo[] = lote.xmlDocumentos.flatMap((doc) =>
      doc.itensXml.map((item) => ({
        codigo: item.codigoItem,
        descricao: item.descricaoItem,
        ncm: item.ncm,
        cfop: item.cfop,
      }))
    );

    const {
      resumo,
      itensUnicosPlanilha,
      relacionadosDivergencia,
      semXmlComCfop,
      semXmlSemCfop,
      somenteNoXml,
      duplicados,
    } = analisarConferencia(itensPlanilhaValidos, itensXmlRelacionados);

    const protocolo =
      lote.protocolo ??
      `ENV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(
        lote.id
      ).slice(-4)}`;

    if (!lote.protocolo) {
      await prisma.lote.update({
        where: { id: lote.id },
        data: { protocolo },
      });
    }

    const documento = normalizarDocumento(lote.cliente.cpfCnpj);
    const modoDocumentacao = String(lote.modoDocumentacao ?? "SEM_XML");

    const workbook = montarWorkbookRelatorio({
      protocolo,
      loteId: lote.id,
      cliente: lote.cliente.nomeRazaoSocial,
      documento,
      emailCliente: lote.cliente.email,
      modoDocumentacao,
      resumo,
      relacionadosDivergencia,
      semXmlComCfop,
      semXmlSemCfop,
      somenteNoXml,
      duplicados,
    });

    const workbookBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    const nomeArquivo = `relatorio-conferencia-${protocolo}.xlsx`;
    const anexoBase64 = workbookBuffer.toString("base64");

    let emailClienteEnviado = false;
    let emailClienteErro: string | null = null;

    try {
      await enviarEmailSolicitacaoCliente({
        para: lote.cliente.email,
        nomeCliente: lote.cliente.nomeRazaoSocial,
        protocolo,
        resumo,
        anexoBase64,
        nomeArquivo,
      });

      emailClienteEnviado = true;
    } catch (error) {
      emailClienteErro =
        error instanceof Error ? error.message : "Erro ao enviar e-mail ao cliente.";
    }

    let emailSuporteEnviado = false;
    let emailSuporteErro: string | null = null;

    const suporteEmail = process.env.SUPORTE_EMAIL;

    if (suporteEmail) {
      try {
        await enviarEmailRelatorioSuporte({
          para: suporteEmail,
          protocolo,
          loteId: lote.id,
          cliente: lote.cliente.nomeRazaoSocial,
          documento,
          emailCliente: lote.cliente.email,
          modoDocumentacao,
          resumo,
          anexoBase64,
          nomeArquivo,
        });

        emailSuporteEnviado = true;
      } catch (error) {
        emailSuporteErro =
          error instanceof Error ? error.message : "Erro ao enviar e-mail ao suporte.";
      }
    } else {
      emailSuporteErro = "SUPORTE_EMAIL não configurado.";
    }

    let orcamentoGerado = false;
    let orcamentoEmailEnviado = false;
    let orcamentoEmailErro: string | null = null;
    let loteAtualizado: unknown = null;

    if (lote.dataOrcamentoGerado) {
      orcamentoGerado = true;
      orcamentoEmailEnviado = Boolean(lote.dataOrcamentoEnviado);

      loteAtualizado = await prisma.lote.findUnique({
        where: { id: lote.id },
        include: { cliente: true },
      });
    } else {
      const xmlUsados = new Set<number>();

      let itensCobraveis = 0;
      let itensComRessalva = 0;
      let itensImprecisos = 0;

      for (const item of itensUnicosPlanilha) {
        const match = encontrarItemXmlRelacionado(item, itensXmlRelacionados, xmlUsados);

        let cfopEfetivo: string | null = item.cfopManual || null;
        const possuiRelacaoXml = !!match;

        if (match) {
          xmlUsados.add(match.indice);
          cfopEfetivo = match.itemXml.cfop || item.cfopManual || null;
        }

        const possuiMinimos = Boolean(
          item.codigo && item.descricao && item.ncm && cfopEfetivo
        );

        if (!possuiMinimos) {
          itensImprecisos += 1;
          continue;
        }

        if (possuiRelacaoXml) {
          itensCobraveis += 1;
        } else if (item.cfopManual) {
          itensCobraveis += 1;
          itensComRessalva += 1;
        } else {
          itensImprecisos += 1;
        }
      }

      const regraOrcamento = calcularValorOrcamento(itensCobraveis);
      const valorUnitarioAplicado = regraOrcamento.valorUnitarioAplicado;
      const valorTotal = regraOrcamento.valorTotal;
      const observacaoOrcamento = `${regraOrcamento.descricaoFaixa}.`;

      const agora = new Date();
      const dataExpiracao = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
      const tokenAcaoOrcamento = crypto.randomBytes(24).toString("hex");

      if (itensCobraveis > 0) {
        try {
          await enviarEmailOrcamentoCliente({
            para: lote.cliente.email,
            nomeCliente: lote.cliente.nomeRazaoSocial,
            protocolo,
            itensCobraveis,
            itensComRessalva,
            itensImprecisos,
            valorUnitario: valorUnitarioAplicado.toFixed(4),
            valorTotal: valorTotal.toFixed(2),
            observacaoOrcamento,
            tokenAcaoOrcamento,
          });

          orcamentoEmailEnviado = true;
        } catch (error) {
          orcamentoEmailErro =
            error instanceof Error ? error.message : "Erro ao enviar orçamento.";
        }
      } else {
        orcamentoEmailErro = "Nenhum item cobrável encontrado para gerar orçamento.";
      }

      loteAtualizado = await prisma.lote.update({
        where: { id: lote.id },
        data: {
          protocolo,
          itensCobraveis,
          itensComRessalva,
          itensImprecisos,
          valorUnitario: valorUnitarioAplicado,
          valorTotal,
          observacaoOrcamento,
          tokenAcaoOrcamento: itensCobraveis > 0 ? tokenAcaoOrcamento : null,
          dataOrcamentoGerado: agora,
          dataOrcamentoEnviado: orcamentoEmailEnviado ? agora : null,
          dataOrcamentoExpiraEm: orcamentoEmailEnviado ? dataExpiracao : null,
          statusLote: orcamentoEmailEnviado
            ? "AGUARDANDO_PAGAMENTO"
            : "ORCAMENTO_GERADO",
        },
        include: { cliente: true },
      });

      orcamentoGerado = true;
    }

    return NextResponse.json({
      ok: true,
      mensagem: "Solicitação confirmada com sucesso.",
      lote: loteAtualizado,
      resumo,
      emailClienteEnviado,
      emailClienteErro,
      emailSuporteEnviado,
      emailSuporteErro,
      orcamentoGerado,
      orcamentoEmailEnviado,
      orcamentoEmailErro,
      anexoGerado: nomeArquivo,
    });
  } catch (error) {
    console.error("Erro ao confirmar solicitação:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao confirmar solicitação." },
      { status: 500 }
    );
  }
}