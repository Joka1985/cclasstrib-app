import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const APP_URL =
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "http://localhost:3000";

const PAGAMENTO_URL_BASE =
  process.env.PAGAMENTO_URL_BASE || `${APP_URL}/pagamento`;

function renderHtmlPage(params: {
  titulo: string;
  mensagem: string;
  corTopo?: string;
  botaoTexto?: string;
  botaoHref?: string;
}) {
  const {
    titulo,
    mensagem,
    corTopo = "#111827",
    botaoTexto,
    botaoHref,
  } = params;

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${titulo}</title>
      </head>
      <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="padding:24px 28px;background:${corTopo};color:#ffffff;">
            <h1 style="margin:0;font-size:22px;line-height:1.3;">${titulo}</h1>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 18px 0;font-size:15px;line-height:1.6;">${mensagem}</p>
            ${
              botaoTexto && botaoHref
                ? `
                  <a
                    href="${botaoHref}"
                    style="
                      display:inline-block;
                      padding:12px 18px;
                      border-radius:10px;
                      background:#111827;
                      color:#ffffff;
                      text-decoration:none;
                      font-weight:700;
                      font-size:14px;
                    "
                  >
                    ${botaoTexto}
                  </a>
                `
                : ""
            }
          </div>
        </div>
      </body>
    </html>
  `;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");

    if (!token) {
      return new NextResponse(
        renderHtmlPage({
          titulo: "Link inválido",
          mensagem:
            "O link para prosseguir com o pagamento está incompleto ou inválido.",
          corTopo: "#991b1b",
        }),
        {
          status: 400,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
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
      return new NextResponse(
        renderHtmlPage({
          titulo: "Orçamento não encontrado",
          mensagem:
            "Não foi possível localizar um orçamento correspondente a este link.",
          corTopo: "#991b1b",
        }),
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    if (lote.statusLote === "CANCELADO_PELO_CLIENTE") {
      return new NextResponse(
        renderHtmlPage({
          titulo: "Orçamento cancelado",
          mensagem:
            "Este orçamento já foi cancelado anteriormente e não pode mais seguir para pagamento.",
          corTopo: "#991b1b",
        }),
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    if (lote.statusLote === "ORCAMENTO_EXPIRADO") {
      return new NextResponse(
        renderHtmlPage({
          titulo: "Orçamento expirado",
          mensagem:
            "Este orçamento já expirou e não pode mais seguir para pagamento.",
          corTopo: "#991b1b",
        }),
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
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
            "Orçamento expirado automaticamente ao tentar prosseguir para pagamento.",
        },
      });

      return new NextResponse(
        renderHtmlPage({
          titulo: "Orçamento expirado",
          mensagem:
            "O prazo de 24 horas deste orçamento já foi encerrado. As informações foram desconsideradas para continuidade.",
          corTopo: "#991b1b",
        }),
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    if (
      lote.statusLote !== "AGUARDANDO_PAGAMENTO" &&
      lote.statusLote !== "PAGAMENTO_APROVADO"
    ) {
      await prisma.lote.update({
        where: { id: lote.id },
        data: {
          statusLote: "AGUARDANDO_PAGAMENTO",
        },
      });
    }

    const urlPagamento = `${PAGAMENTO_URL_BASE}?token=${encodeURIComponent(
      token
    )}`;

    return NextResponse.redirect(urlPagamento);
  } catch (error) {
    console.error("Erro em /api/prosseguir-pagamento:", error);

    return new NextResponse(
      renderHtmlPage({
        titulo: "Erro ao processar solicitação",
        mensagem:
          "Não foi possível processar sua solicitação neste momento. Tente novamente mais tarde.",
        corTopo: "#991b1b",
      }),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}