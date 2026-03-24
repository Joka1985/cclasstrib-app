import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  // versão sem zeros à esquerda no trecho numérico puro
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

  // 1) prioridade por código normalizado
  if (codigoPlanilha) {
    for (let i = 0; i < itensXml.length; i++) {
      if (usados.has(i)) continue;

      const itemXml = itensXml[i];
      const codigoXml = normalizarCodigo(itemXml.codigo);

      if (codigoXml && codigoXml === codigoPlanilha) {
        return { itemXml, indice: i, criterio: "CODIGO" as const };
      }
    }
  }

  // 2) fallback por descrição + NCM
  for (let i = 0; i < itensXml.length; i++) {
    if (usados.has(i)) continue;

    const itemXml = itensXml[i];
    const descricaoXml = normalizarTexto(itemXml.descricao);
    const ncmXml = normalizarTexto(itemXml.ncm);

    const descricaoBate =
      descricaoPlanilha && descricaoXml && descricaoPlanilha === descricaoXml;

    const ncmBate = ncmPlanilha && ncmXml && ncmPlanilha === ncmXml;

    if (descricaoBate && ncmBate) {
      return { itemXml, indice: i, criterio: "DESCRICAO_NCM" as const };
    }
  }

  // 3) fallback mais fraco: descrição igual
  for (let i = 0; i < itensXml.length; i++) {
    if (usados.has(i)) continue;

    const itemXml = itensXml[i];
    const descricaoXml = normalizarTexto(itemXml.descricao);

    if (descricaoPlanilha && descricaoXml && descricaoPlanilha === descricaoXml) {
      return { itemXml, indice: i, criterio: "DESCRICAO" as const };
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

    // Consolidação de duplicados da planilha
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

    for (const item of itensUnicosPlanilha) {
      const match = encontrarItemXmlRelacionado(item, itensXmlRelacionados, xmlUsados);

      let possuiRelacaoXml = false;
      let descricaoDivergente = false;
      let ncmDivergente = false;
      let cfopEfetivo: string | null = item.cfopManual || null;

      if (match) {
        possuiRelacaoXml = true;
        xmlUsados.add(match.indice);
        totalRelacionadosAoXml += 1;

        const itemXml = match.itemXml;

        const descricaoPlanilhaNorm = normalizarTexto(item.descricao);
        const descricaoXmlNorm = normalizarTexto(itemXml.descricao);
        const ncmPlanilhaNorm = normalizarTexto(item.ncm);
        const ncmXmlNorm = normalizarTexto(itemXml.ncm);

        descricaoDivergente =
          !!descricaoPlanilhaNorm &&
          !!descricaoXmlNorm &&
          descricaoPlanilhaNorm !== descricaoXmlNorm;

        ncmDivergente =
          !!ncmPlanilhaNorm &&
          !!ncmXmlNorm &&
          ncmPlanilhaNorm !== ncmXmlNorm;

        if (descricaoDivergente) totalDivergenciasDescricao += 1;
        if (ncmDivergente) totalDivergenciasNcm += 1;

        if (descricaoDivergente || ncmDivergente) {
          totalRelacionadosComDivergencia += 1;
        }

        cfopEfetivo = itemXml.cfop || item.cfopManual || null;
      } else {
        if (item.cfopManual) {
          totalSemRelacaoComCfopManual += 1;
        } else {
          totalSemRelacaoSemCfopManual += 1;
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

    const totalSomenteNoXml = itensXmlRelacionados.length - xmlUsados.size;

    return NextResponse.json({
      ok: true,
      lote: {
        id: lote.id,
        protocolo: lote.protocolo,
        cliente: lote.cliente.nomeRazaoSocial,
        documento: normalizarDocumento(lote.cliente.cpfCnpj),
      },
      resumo: {
        totalItensPlanilhaValidos: itensPlanilhaValidos.length,
        totalItensUnicosConsiderados: itensUnicosPlanilha.length,
        totalRelacionadosAoXml,
        totalRelacionadosComDivergencia,
        totalSemRelacaoComCfopManual,
        totalSemRelacaoSemCfopManual,
        totalAptosParaAnalise,
        totalImprecisos,
        totalDuplicadosConsolidados: itensDuplicados.length,
        totalSomenteNoXml,
        totalDivergenciasNcm,
        totalDivergenciasDescricao,
      },
      aviso:
        "O contato será realizado para efeito de orçamento apenas dos itens que contenham informações mínimas para análise: código do item, descrição do item, NCM e CFOP. Na ausência dessas informações, a classificação poderá ficar imprecisa.",
    });
  } catch (error) {
    console.error("Erro ao montar conferência final:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao carregar conferência final." },
      { status: 500 }
    );
  }
}