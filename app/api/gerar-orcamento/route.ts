import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { enviarEmailOrcamentoCliente } from "@/lib/email";

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

  const somenteAlfanumerico = texto
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

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

  const valorUnitarioBase = LOTE_MINIMO_VALOR / LOTE_MINIMO_QTDE; // 0.999
  const valorUnitarioFaixa2 = valorUnitarioBase * 0.9; // 11 a 30
  const valorUnitarioFaixa3 = valorUnitarioFaixa2 * 0.9; // 31 a 100
  const valorUnitarioFaixa4 = valorUnitarioFaixa3 * 0.9; // acima de 100

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const loteId = body.loteId as string | undefined;
    const observacaoOrcamento =
      String(body.observacaoOrcamento ?? "").trim() || null;
    const enviarEmail = Boolean(body.enviarEmail ?? true);

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

    const itensPlanilhaValidos = lote.itensPlanilha.filter(
      (item) => item.linhaValida
    );

    const itensXmlRelacionados: ItemXmlResumo[] = lote.xmlDocumentos.flatMap(
      (doc) =>
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
    const xmlUsados = new Set<number>();

    let itensCobraveis = 0;
    let itensComRessalva = 0;
    let itensImprecisos = 0;

    for (const item of itensUnicosPlanilha) {
      const match = encontrarItemXmlRelacionado(
        item,
        itensXmlRelacionados,
        xmlUsados
      );

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
    const valorTotal = regraOrcamento.valorTotal;
    const valorUnitarioAplicado = regraOrcamento.valorUnitarioAplicado;

    let emailEnviado = false;
    let emailErro: string | null = null;

    const observacaoFinal =
      observacaoOrcamento ?? `${regraOrcamento.descricaoFaixa}.`;

    const agora = new Date();
    const dataExpiracao = new Date(agora.getTime() + 24 * 60 * 60 * 1000);
    const tokenAcaoOrcamento =
      lote.tokenAcaoOrcamento ?? crypto.randomBytes(24).toString("hex");

    if (enviarEmail) {
      try {
        await enviarEmailOrcamentoCliente({
          para: lote.cliente.email,
          nomeCliente: lote.cliente.nomeRazaoSocial,
          protocolo: lote.protocolo ?? "",
          itensCobraveis,
          itensComRessalva,
          itensImprecisos,
          valorUnitario: valorUnitarioAplicado.toFixed(4),
          valorTotal: valorTotal.toFixed(2),
          observacaoOrcamento: observacaoFinal,
          tokenAcaoOrcamento,
        });

        emailEnviado = true;
      } catch (error) {
        emailErro =
          error instanceof Error ? error.message : "Erro ao enviar orçamento.";
      }
    }

    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: {
        itensCobraveis,
        itensComRessalva,
        itensImprecisos,
        valorUnitario: valorUnitarioAplicado,
        valorTotal,
        observacaoOrcamento: observacaoFinal,
        tokenAcaoOrcamento,
        dataOrcamentoGerado: agora,
        dataOrcamentoEnviado: emailEnviado ? agora : null,
        dataOrcamentoExpiraEm: emailEnviado ? dataExpiracao : null,
        statusLote: emailEnviado ? "AGUARDANDO_PAGAMENTO" : "ORCAMENTO_GERADO",
      },
    });

    return NextResponse.json({
      ok: true,
      mensagem: emailEnviado
        ? "Orçamento gerado e enviado com sucesso."
        : "Orçamento gerado com sucesso, mas o e-mail não foi enviado.",
      lote: loteAtualizado,
      emailEnviado,
      emailErro,
      regraOrcamento,
    });
  } catch (error) {
    console.error("Erro ao gerar orçamento:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao gerar orçamento." },
      { status: 500 }
    );
  }
}