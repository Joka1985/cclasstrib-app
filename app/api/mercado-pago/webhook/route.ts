import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MERCADO_PAGO_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;

type MercadoPagoPaymentResponse = {
  id?: number | string;
  status?: string;
  external_reference?: string | null;
  metadata?: {
    loteId?: string;
    protocolo?: string;
    tokenAcaoOrcamento?: string;
  };
};

function extrairPaymentId(params: {
  body: any;
  searchParams: URLSearchParams;
}) {
  const { body, searchParams } = params;

  return (
    searchParams.get("data.id") ||
    searchParams.get("id") ||
    body?.data?.id ||
    body?.id ||
    null
  );
}

function extrairTipo(params: {
  body: any;
  searchParams: URLSearchParams;
}) {
  const { body, searchParams } = params;

  return (
    searchParams.get("type") ||
    searchParams.get("topic") ||
    body?.type ||
    body?.topic ||
    null
  );
}

async function consultarPagamento(paymentId: string) {
  if (!MERCADO_PAGO_ACCESS_TOKEN) {
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN não configurado.");
  }

  const resposta = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  const json = (await resposta.json()) as MercadoPagoPaymentResponse;

  if (!resposta.ok) {
    throw new Error(`Falha ao consultar pagamento no Mercado Pago: ${JSON.stringify(json)}`);
  }

  return json;
}

async function processarNotificacao(req: NextRequest, body: any) {
  const paymentId = extrairPaymentId({
    body,
    searchParams: req.nextUrl.searchParams,
  });

  const tipo = extrairTipo({
    body,
    searchParams: req.nextUrl.searchParams,
  });

  if (!paymentId) {
    return {
      ok: true,
      ignorado: true,
      motivo: "Notificação sem payment id.",
    };
  }

  if (tipo && tipo !== "payment") {
    return {
      ok: true,
      ignorado: true,
      motivo: `Tipo de notificação ignorado: ${tipo}`,
    };
  }

  const pagamento = await consultarPagamento(String(paymentId));

  const loteId =
    pagamento.external_reference ||
    pagamento.metadata?.loteId ||
    null;

  if (!loteId) {
    return {
      ok: true,
      ignorado: true,
      motivo: "Pagamento sem external_reference/loteId.",
      pagamentoId: paymentId,
      status: pagamento.status ?? null,
    };
  }

  const lote = await prisma.lote.findUnique({
    where: { id: String(loteId) },
  });

  if (!lote) {
    return {
      ok: true,
      ignorado: true,
      motivo: "Lote não encontrado para o pagamento.",
      pagamentoId: paymentId,
      loteId,
      status: pagamento.status ?? null,
    };
  }

  if (pagamento.status === "approved") {
    const loteAtualizado = await prisma.lote.update({
      where: { id: lote.id },
      data: {
        statusLote: "PAGAMENTO_APROVADO",
        dataPagamentoConfirmado: new Date(),
      },
    });

    return {
      ok: true,
      ignorado: false,
      pagamentoId: paymentId,
      status: pagamento.status,
      loteId: loteAtualizado.id,
      statusLote: loteAtualizado.statusLote,
    };
  }

  return {
    ok: true,
    ignorado: true,
    pagamentoId: paymentId,
    status: pagamento.status ?? null,
    loteId: lote.id,
    motivo: "Pagamento recebido, mas ainda não está aprovado.",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const resultado = await processarNotificacao(req, body);

    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    console.error("Erro em POST /api/mercado-pago/webhook:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao processar webhook do Mercado Pago." },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const resultado = await processarNotificacao(req, {});
    return NextResponse.json(resultado, { status: 200 });
  } catch (error) {
    console.error("Erro em GET /api/mercado-pago/webhook:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao processar webhook do Mercado Pago." },
      { status: 500 }
    );
  }
}