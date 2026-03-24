import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  enviarEmailRelatorioSuporte,
  enviarEmailSolicitacaoCliente,
} from "@/lib/email";
import { gerarPlanilhaRelatorioAnalitico } from "@/lib/relatorio-suporte";

function normalizarTexto(valor?: string | null) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .trim();
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

function normalizarDocumento(valor?: string | null) {
  return String(valor ?? "").replace(/\D/g, "");
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

type ItemPlanilhaResumo = {
  codigo: string;
  descricao: string;
  ncm: string | null;
  cfopManual: string | null;
  quantidade: number;
};

type ItemXmlResumo = {
  codigo: string | null;
  descricao: string;
  ncm: string | null;
  cfop: string | null;
};

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

    const descricaoBate =
      descricaoPlanilha && descricaoXml && descricaoPlanilha === descricaoXml;
    const ncmBate = ncmPlanilha && ncmXml && ncmPlanilha === ncmXml;

    if (descricaoBate && ncmBate) {
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
          where: {
            statusXml: {
              in: ["SAIDA", "ENTRADA"],
            },
          },
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
    const itensXmlRelacionados: ItemXmlResumo[] = lote.xmlDocumentos.flatMap((doc) =>
      doc.itensXml.map((item) => ({
        codigo: item.codigoItem,
        descricao: item.descricaoItem,
        ncm: item.ncm,
        cfop: item.cfop,
      }))
    );

    const mapaItensUnicos = new Map<string, ItemPlanilhaResumo>();

    for (const item of itensPlanilhaValidos) {
      const chave = chaveDuplicidade({
        codigo: item.codigoItemOuServico,
        descricao: item.descricaoItemOuServico,
        ncm: item.ncm,
        cfop: item.cfopInformadoManual,
      });

      if (!mapaItensUnicos.has(chave)) {
        mapaItensUnicos.set(chave, {
          codigo: item.codigoItemOuServico,
          descricao: item.descricaoItemOuServico,
          ncm: item.ncm,
          cfopManual: item.cfopInformadoManual,
          quantidade: 0,
        });
      }

      mapaItensUnicos.get(chave)!.quantidade += 1;
    }

    const itensUnicosPlanilha = Array.from(mapaItensUnicos.values());
    const itensDuplicados = itensUnicosPlanilha.filter((item) => item.quantidade > 1);

    let totalRelacionadosAoXml = 0;
    let totalRelacionadosComDivergencia = 0;
    let totalSemRelacaoComCfopManual = 0;
    let totalSemRelacaoSemCfopManual = 0;
    let totalAptosParaAnalise = 0;
    let totalImprecisos = 0;
    let totalDivergenciasNcm = 0;
    let totalDivergenciasDescricao = 0;

    const xmlUsados = new Set<number>();

    const relacionadosComDivergencia: Array<{
      codigo: string | null;
      descricao: string | null;
      observacao: string | null;
    }> = [];

    const semXmlComCfopManual: Array<{
      codigo: string | null;
      descricao: string | null;
      observacao: string | null;
    }> = [];

    const semXmlSemCfopManual: Array<{
      codigo: string | null;
      descricao: string | null;
      observacao: string | null;
    }> = [];

    for (const item of itensUnicosPlanilha) {
      const match = encontrarItemXmlRelacionado(item, itensXmlRelacionados, xmlUsados);

      let cfopEfetivo: string | null = item.cfopManual || null;

      if (match) {
        xmlUsados.add(match.indice);
        totalRelacionadosAoXml += 1;

        const itemXml = match.itemXml;

        const descricaoPlanilhaNorm = normalizarTexto(item.descricao);
        const descricaoXmlNorm = normalizarTexto(itemXml.descricao);
        const ncmPlanilhaNorm = normalizarTexto(item.ncm);
        const ncmXmlNorm = normalizarTexto(itemXml.ncm);

        const descricaoDivergente =
          !!descricaoPlanilhaNorm &&
          !!descricaoXmlNorm &&
          descricaoPlanilhaNorm !== descricaoXmlNorm;

        const ncmDivergente =
          !!ncmPlanilhaNorm &&
          !!ncmXmlNorm &&
          ncmPlanilhaNorm !== ncmXmlNorm;

        if (descricaoDivergente || ncmDivergente) {
          totalRelacionadosComDivergencia += 1;

          const observacoes: string[] = [];
          if (descricaoDivergente) {
            totalDivergenciasDescricao += 1;
            observacoes.push("Divergência de descrição");
          }
          if (ncmDivergente) {
            totalDivergenciasNcm += 1;
            observacoes.push("Divergência de NCM");
          }

          relacionadosComDivergencia.push({
            codigo: item.codigo,
            descricao: item.descricao,
            observacao: observacoes.join(" / "),
          });
        }

        cfopEfetivo = itemXml.cfop || item.cfopManual || null;
      } else {
        if (item.cfopManual) {
          totalSemRelacaoComCfopManual += 1;
          semXmlComCfopManual.push({
            codigo: item.codigo,
            descricao: item.descricao,
            observacao: `Sem XML relacionado. CFOP manual informado: ${item.cfopManual}.`,
          });
        } else {
          totalSemRelacaoSemCfopManual += 1;
          semXmlSemCfopManual.push({
            codigo: item.codigo,
            descricao: item.descricao,
            observacao: "Sem XML relacionado e sem CFOP manual.",
          });
        }
      }

      const possuiDadosMinimos = Boolean(
        item.codigo &&
          item.descricao &&
          item.ncm &&
          cfopEfetivo
      );

      if (possuiDadosMinimos) {
        totalAptosParaAnalise += 1;
      } else {
        totalImprecisos += 1;
      }
    }

    const somenteNoXml: Array<{
      codigo: string | null;
      descricao: string | null;
      observacao: string | null;
    }> = [];

    for (let i = 0; i < itensXmlRelacionados.length; i++) {
      if (xmlUsados.has(i)) continue;

      const itemXml = itensXmlRelacionados[i];
      somenteNoXml.push({
        codigo: itemXml.codigo,
        descricao: itemXml.descricao,
        observacao: itemXml.cfop
          ? `Item existente apenas no XML. CFOP: ${itemXml.cfop}.`
          : "Item existente apenas no XML.",
      });
    }

    const duplicados = itensDuplicados.map((item) => ({
      codigo: item.codigo,
      descricao: item.descricao,
      observacao: `Consolidado como item único. Ocorrências identificadas: ${item.quantidade}.`,
    }));

    const resumo = {
      totalItensPlanilhaValidos: itensPlanilhaValidos.length,
      totalItensUnicosConsiderados: itensUnicosPlanilha.length,
      totalRelacionadosAoXml,
      totalRelacionadosComDivergencia,
      totalSemRelacaoComCfopManual,
      totalSemRelacaoSemCfopManual,
      totalAptosParaAnalise,
      totalImprecisos,
      totalDuplicadosConsolidados: itensDuplicados.length,
      totalSomenteNoXml: somenteNoXml.length,
      totalDivergenciasNcm,
      totalDivergenciasDescricao,
    };

    const protocolo = lote.protocolo ?? "";
    const nomeArquivo = `relatorio-conferencia-${protocolo || lote.id}.xlsx`;

    const planilhaBuffer = await gerarPlanilhaRelatorioAnalitico({
      protocolo,
      loteId: lote.id,
      cliente: lote.cliente.nomeRazaoSocial,
      documento: normalizarDocumento(lote.cliente.cpfCnpj),
      emailCliente: lote.cliente.email,
      modoDocumentacao: String(lote.modoDocumentacao),
      resumo,
      analitico: {
        relacionadosComDivergencia,
        semXmlComCfopManual,
        semXmlSemCfopManual,
        somenteNoXml,
        duplicados,
      },
    });

    const anexoBase64 = planilhaBuffer.toString("base64");

    const suporteEmail = process.env.SUPORTE_EMAIL;
    if (!suporteEmail) {
      throw new Error("SUPORTE_EMAIL não configurado.");
    }

    let emailClienteEnviado = false;
    let emailClienteErro: string | null = null;
    let emailSuporteEnviado = false;
    let emailSuporteErro: string | null = null;

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
        error instanceof Error ? error.message : "Falha ao enviar e-mail ao cliente.";
      console.error("Erro ao enviar e-mail ao cliente:", error);
    }

    try {
      await enviarEmailRelatorioSuporte({
        para: suporteEmail,
        protocolo,
        loteId: lote.id,
        cliente: lote.cliente.nomeRazaoSocial,
        documento: normalizarDocumento(lote.cliente.cpfCnpj),
        emailCliente: lote.cliente.email,
        modoDocumentacao: String(lote.modoDocumentacao),
        resumo,
        anexoBase64,
        nomeArquivo,
      });
      emailSuporteEnviado = true;
    } catch (error) {
      emailSuporteErro =
        error instanceof Error ? error.message : "Falha ao enviar e-mail ao suporte.";
      console.error("Erro ao enviar e-mail ao suporte:", error);
    }

    return NextResponse.json({
      ok: emailClienteEnviado || emailSuporteEnviado,
      mensagem: "Processo de confirmação executado.",
      emailClienteEnviado,
      emailClienteErro,
      emailSuporteEnviado,
      emailSuporteErro,
    });
  } catch (error: unknown) {
    console.error("Erro ao confirmar solicitação:", error);

    const mensagem =
      error instanceof Error ? error.message : "Erro ao confirmar solicitação.";

    return NextResponse.json(
      { ok: false, error: mensagem },
      { status: 500 }
    );
  }
}