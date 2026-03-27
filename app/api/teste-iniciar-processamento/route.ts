import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { executarProcessamentoClassificacao } from "@/lib/processar-classificacao";
import { gerarParametrizacaoDoLote } from "@/lib/parametrizacao-engine";
import { finalizarEntregaParametrizacao } from "@/lib/finalizar-entrega-parametrizacao";

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
  emailEnviado?: boolean;
  emailErro?: string | null;
}) {
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
            ${params.status ? `<p><strong>Status final:</strong> ${escapeHtml(params.status)}</p>` : ""}
            <p style="line-height:1.7;">${params.mensagem}</p>
            ${
              params.emailEnviado !== undefined
                ? `<p><strong>E-mail enviado:</strong> ${params.emailEnviado ? "SIM" : "NAO"}</p>`
                : ""
            }
            ${
              params.emailErro
                ? `<p><strong>Erro no e-mail:</strong> ${escapeHtml(params.emailErro)}</p>`
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
          emailEnviado: true,
        }),
        { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
      );
    }

    await executarProcessamentoClassificacao({
      loteId: lote.id,
      ignorarPagamento: true,
      origem: "BOTAO_TESTE",
    });

    await gerarParametrizacaoDoLote({
      loteId: lote.id,
      responsavel: "Equipe cClassTrib",
    });

    const entrega = await finalizarEntregaParametrizacao({
  loteId: lote.id,
  ignorarPagamento: true,
        });

    return new Response(
      renderHtml({
        titulo: "Processamento concluído",
        mensagem: entrega.mensagem,
        protocolo: entrega.lote?.protocolo ?? lote.protocolo,
        cliente: lote.cliente.nomeRazaoSocial,
        status: entrega.lote?.statusLote ?? lote.statusLote,
        emailEnviado: entrega.emailEnviado,
        emailErro: entrega.emailErro,
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
            : "Ocorreu um erro interno ao processar o lote.",
      }),
      { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } }
    );
  }
}