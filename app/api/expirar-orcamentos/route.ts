import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function autorizado(req: NextRequest) {
  const segredo = process.env.CRON_SECRET;

  if (!segredo) {
    return true;
  }

  const authHeader = req.headers.get("authorization");
  const secretQuery = req.nextUrl.searchParams.get("secret");

  if (authHeader === `Bearer ${segredo}`) return true;
  if (secretQuery === segredo) return true;

  return false;
}

async function executarExpiracao() {
  const agora = new Date();

  const lotesExpirados = await prisma.lote.findMany({
    where: {
      statusLote: {
        in: ["ORCAMENTO_GERADO", "AGUARDANDO_PAGAMENTO"],
      },
      dataOrcamentoExpiraEm: {
        lt: agora,
      },
    },
    select: {
      id: true,
      protocolo: true,
      statusLote: true,
      dataOrcamentoExpiraEm: true,
    },
  });

  if (lotesExpirados.length === 0) {
    return {
      ok: true,
      totalExpirados: 0,
      lotes: [],
    };
  }

  await prisma.lote.updateMany({
    where: {
      id: {
        in: lotesExpirados.map((lote) => lote.id),
      },
    },
    data: {
      statusLote: "ORCAMENTO_EXPIRADO",
      motivoCancelamento:
        "Orçamento expirado automaticamente após 24 horas sem continuidade.",
    },
  });

  return {
    ok: true,
    totalExpirados: lotesExpirados.length,
    lotes: lotesExpirados,
  };
}

export async function GET(req: NextRequest) {
  try {
    if (!autorizado(req)) {
      return NextResponse.json(
        { ok: false, error: "Não autorizado." },
        { status: 401 }
      );
    }

    const resultado = await executarExpiracao();
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Erro em GET /api/expirar-orcamentos:", error);

    return NextResponse.json(
      { ok: false, error: "Erro interno ao expirar orçamentos." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!autorizado(req)) {
      return NextResponse.json(
        { ok: false, error: "Não autorizado." },
        { status: 401 }
      );
    }

    const resultado = await executarExpiracao();
    return NextResponse.json(resultado);
  } catch (error) {
    console.error("Erro em POST /api/expirar-orcamentos:", error);

    return NextResponse.json(
      { ok: false, error: "Erro interno ao expirar orçamentos." },
      { status: 500 }
    );
  }
}