import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function escapeHtml(valor?: string | null) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(params: {
  titulo: string;
  mensagem: string;
  protocolo?: string | null;
  cliente?: string | null;
  status?: string | null;
  loteId?: string | null;
}) {
  const scriptDisparo = params.loteId
    ? `
      <script>
        (async function () {
          try {
            await fetch("/api/processar-lote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ loteId: "${escapeHtml(params.loteId)}" })
            });
          } catch (error) {
            console.error("Erro ao disparar processamento em segundo plano:", error);
          }
        })();
      </script>
    `
    : "";

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${escapeHtml(params.titulo)}</title>
      </head>
      <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
        <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
          <div style="background:#111827;color:#ffffff;padding:24px 28px;">
            <h2 style="margin:0;font-size:22px;line-height:1.3;">${escapeHtml(params.titulo)}</h2>
          </div>
          <div style="padding:28px;">
            ${params.protocolo ? `<p><strong>Protocolo:</strong> ${escapeHtml(params.protocolo)}</p>` : ""}
            ${params.cliente ? `<p><strong>Cliente:</strong> ${escapeHtml(params.cliente)}</p>` : ""}
            ${params.status ? `<p><strong>Status atual:</strong> ${escapeHtml(params.status)}</p>` : ""}
            <p style="line-height:1.7;">${params.mensagem}</p>
            <p style="line-height:1.7;color:#6b7280;">
              Você não precisa aguardar nesta página. O processamento seguirá em segundo plano.
            </p>
          </div>
        </div>
        ${scriptDisparo}
      </body>
    </html>
  `;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    if (!token) {
      return new Response(
        renderHtml({
          titulo: "Link inválido",
          mensagem: "O token não foi informado.",
        }),
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    const lote = await prisma.lote.findFirst({
      where: { tokenAcaoOrcamento: token },
      select: {
        id: true,
        protocolo: true,
        statusLote: true,
        dataOrcamentoGerado: true,
        dataEntregaEnviada: true,
        cliente: {
          select: {
            nomeRazaoSocial: true,
            email: true,
          },
        },
      },
    });

    if (!lote) {
      return new Response(
        renderHtml({
          titulo: "Lote não encontrado",
          mensagem: "Não foi possível localizar um lote para este token.",
        }),
        { status: 404, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    if (!lote.dataOrcamentoGerado) {
      return new Response(
        renderHtml({
          titulo: "Processamento não liberado",
          mensagem: "O orçamento ainda não foi gerado para este lote.",
          protocolo: lote.protocolo,
          cliente: lote.cliente.nomeRazaoSocial,
          status: lote.statusLote,
        }),
        { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    if (lote.dataEntregaEnviada) {
      return new Response(
        renderHtml({
          titulo: "Lote já entregue",
          mensagem: "Este lote já havia sido entregue anteriormente.",
          protocolo: lote.protocolo,
          cliente: lote.cliente.nomeRazaoSocial,
          status: lote.statusLote,
        }),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    await prisma.lote.update({
      where: { id: lote.id },
      data: {
        statusLote: "EM_PROCESSAMENTO",
        dataProcessamentoIniciado: new Date(),
      },
    });

    return new Response(
      renderHtml({
        titulo: "Processamento iniciado",
        mensagem:
          "Seu lote foi colocado em processamento com sucesso. O sistema continuará a execução em segundo plano e a entrega será enviada quando a rotina terminar.",
        protocolo: lote.protocolo,
        cliente: lote.cliente.nomeRazaoSocial,
        status: "EM_PROCESSAMENTO",
        loteId: lote.id,
      }),
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  } catch (error) {
    console.error("Erro ao iniciar processamento pelo botão de teste:", error);

    return new Response(
      renderHtml({
        titulo: "Erro no processamento",
        mensagem:
          error instanceof Error
            ? error.message
            : "Ocorreu um erro interno ao iniciar o lote.",
      }),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}