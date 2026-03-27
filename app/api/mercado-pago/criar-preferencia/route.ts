import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

const MERCADO_PAGO_ACCESS_TOKEN = process.env.MERCADO_PAGO_ACCESS_TOKEN;

function normalizarDocumento(valor?: string | null) {
  return String(valor ?? "").replace(/\D/g, "");
}

export async function POST(req: NextRequest) {
  try {
    if (!MERCADO_PAGO_ACCESS_TOKEN) {
      return NextResponse.json(
        { ok: false, error: "MERCADO_PAGO_ACCESS_TOKEN não configurado." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const token = String(body?.token ?? "").trim();

    if (!token) {
      return NextResponse.json(
        { ok: false, error: "Token do orçamento é obrigatório." },
        { status: 400 }
      );
    }

    const lote = await prisma.lote.findFirst({
      where: {
        tokenAcaoOrcamento: token,
      },
      include: {
        cliente: true,
      },
    });

    if (!lote) {
      return NextResponse.json(
        { ok: false, error: "Orçamento não encontrado." },
        { status: 404 }
      );
    }

    if (lote.statusLote === "CANCELADO_PELO_CLIENTE") {
      return NextResponse.json(
        {
          ok: false,
          error: "Este orçamento foi cancelado pelo cliente.",
          protocolo: lote.protocolo,
          valorTotal: Number(lote.valorTotal ?? 0),
          statusLote: lote.statusLote,
        },
        { status: 400 }
      );
    }

    if (lote.statusLote === "ORCAMENTO_EXPIRADO") {
      return NextResponse.json(
        {
          ok: false,
          error: "Este orçamento já está expirado.",
          protocolo: lote.protocolo,
          valorTotal: Number(lote.valorTotal ?? 0),
          statusLote: lote.statusLote,
          dataOrcamentoExpiraEm: lote.dataOrcamentoExpiraEm,
        },
        { status: 400 }
      );
    }

    const agora = new Date();
    const expirou =
      lote.dataOrcamentoExpiraEm &&
      lote.dataOrcamentoExpiraEm.getTime() < agora.getTime();

    if (expirou) {
      await prisma.lote.update({
        where: { id: lote.id },
        data: {
          statusLote: "ORCAMENTO_EXPIRADO",
          motivoCancelamento:
            "Orçamento expirado automaticamente ao tentar criar preferência de pagamento.",
        },
      });

      return NextResponse.json(
        {
          ok: false,
          error: "O prazo deste orçamento expirou.",
          protocolo: lote.protocolo,
          valorTotal: Number(lote.valorTotal ?? 0),
          statusLote: "ORCAMENTO_EXPIRADO",
          dataOrcamentoExpiraEm: lote.dataOrcamentoExpiraEm,
        },
        { status: 400 }
      );
    }

    if (!lote.valorTotal || Number(lote.valorTotal) <= 0) {
      return NextResponse.json(
        { ok: false, error: "O orçamento não possui valor válido para cobrança." },
        { status: 400 }
      );
    }

    const webhookUrl = `${APP_URL}/api/mercado-pago/webhook`;
    const pagamentoPageUrl = `${APP_URL}/pagamento?token=${encodeURIComponent(
      token
    )}`;

    const preferencePayload = {
      items: [
        {
          id: lote.id,
          title: `Classificação fiscal - protocolo ${lote.protocolo ?? lote.id}`,
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(lote.valorTotal),
        },
      ],
      payer: {
        name: lote.cliente.nomeRazaoSocial,
        email: lote.cliente.email,
        identification: {
          type:
            normalizarDocumento(lote.cliente.cpfCnpj).length > 11
              ? "CNPJ"
              : "CPF",
          number: normalizarDocumento(lote.cliente.cpfCnpj),
        },
      },
      external_reference: lote.id,
      notification_url: webhookUrl,
      back_urls: {
        success: pagamentoPageUrl,
        pending: pagamentoPageUrl,
        failure: pagamentoPageUrl,
      },
      auto_return: "approved",
      statement_descriptor: "CCLASSTRIB",
      payment_methods: {
        excluded_payment_methods: [],
        excluded_payment_types: [],
        installments: 1,
        default_installments: 1,
      },
      metadata: {
        loteId: lote.id,
        protocolo: lote.protocolo,
        tokenAcaoOrcamento: token,
      },
    };

    const resposta = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MERCADO_PAGO_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(preferencePayload),
      cache: "no-store",
    });

    const json = await resposta.json();

    if (!resposta.ok) {
      console.error("Erro Mercado Pago criar preferência:", json);

      return NextResponse.json(
        {
          ok: false,
          error: "Não foi possível criar a preferência de pagamento.",
          detalhes: json,
        },
        { status: 500 }
      );
    }

    if (lote.statusLote !== "AGUARDANDO_PAGAMENTO") {
      await prisma.lote.update({
        where: { id: lote.id },
        data: {
          statusLote: "AGUARDANDO_PAGAMENTO",
        },
      });
    }

    return NextResponse.json({
      ok: true,
      preferenceId: json.id,
      initPoint: json.init_point ?? null,
      sandboxInitPoint: json.sandbox_init_point ?? null,
      protocolo: lote.protocolo,
      valorTotal: Number(lote.valorTotal),
      itensCobraveis: lote.itensCobraveis,
      dataOrcamentoExpiraEm: lote.dataOrcamentoExpiraEm,
      statusLote: lote.statusLote,
    });
  } catch (error) {
    console.error("Erro em /api/mercado-pago/criar-preferencia:", error);

    return NextResponse.json(
      { ok: false, error: "Erro interno ao criar preferência de pagamento." },
      { status: 500 }
    );
  }
}