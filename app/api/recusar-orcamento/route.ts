import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function renderHtmlPage(params: {
  titulo: string;
  mensagem: string;
  corTopo?: string;
}) {
  const { titulo, mensagem, corTopo = "#991b1b" } = params;

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
            <p style="margin:0;font-size:15px;line-height:1.6;">${mensagem}</p>
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
          mensagem: "O link de recusa do orçamento está incompleto ou inválido.",
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
          titulo: "Orçamento já cancelado",
          mensagem: "Este orçamento já havia sido cancelado anteriormente.",
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
            "Este orçamento já estava expirado no momento da sua solicitação.",
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
            "Orçamento expirado antes da confirmação de recusa do cliente.",
        },
      });

      return new NextResponse(
        renderHtmlPage({
          titulo: "Orçamento expirado",
          mensagem:
            "O prazo de 24 horas deste orçamento já foi encerrado e as informações foram desconsideradas.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    await prisma.lote.update({
      where: { id: lote.id },
      data: {
        statusLote: "CANCELADO_PELO_CLIENTE",
        dataCancelamento: agora,
        motivoCancelamento:
          "Cliente informou via link do e-mail que não deseja prosseguir.",
      },
    });

    return new NextResponse(
      renderHtmlPage({
        titulo: "Orçamento cancelado com sucesso",
        mensagem:
          "Recebemos sua decisão. Este atendimento foi encerrado sem continuidade para pagamento.",
      }),
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  } catch (error) {
    console.error("Erro em /api/recusar-orcamento:", error);

    return new NextResponse(
      renderHtmlPage({
        titulo: "Erro ao processar solicitação",
        mensagem:
          "Não foi possível concluir sua solicitação neste momento. Tente novamente mais tarde.",
        corTopo: "#7f1d1d",
      }),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}