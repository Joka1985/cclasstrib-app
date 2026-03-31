import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function checkConfig() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY não configurada");
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM não configurado");
  }
}

function escapeHtml(valor?: string | number | null) {
  return String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function montarLayout(titulo: string, conteudo: string) {
  return `
    <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <div style="background:#111827;color:#ffffff;padding:24px 28px;">
          <h2 style="margin:0;font-size:22px;line-height:1.3;">${escapeHtml(titulo)}</h2>
        </div>
        <div style="padding:28px;">
          ${conteudo}
        </div>
      </div>
    </div>
  `;
}

export async function enviarEmailAlertaSuporte(params: {
  para: string[];
  assunto: string;
  severidade: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  fonteNome: string;
  versaoAnterior?: string | null;
  versaoNova?: string | null;
  resumo: string;
  detalhesHtml?: string;
}) {
  checkConfig();

  const html = montarLayout(
    `Alerta normativo ${params.severidade}`,
    `
      <p><strong>Fonte:</strong> ${escapeHtml(params.fonteNome)}</p>
      <p><strong>Severidade:</strong> ${escapeHtml(params.severidade)}</p>
      ${
        params.versaoAnterior
          ? `<p><strong>Versão anterior:</strong> ${escapeHtml(params.versaoAnterior)}</p>`
          : ""
      }
      ${
        params.versaoNova
          ? `<p><strong>Versão nova:</strong> ${escapeHtml(params.versaoNova)}</p>`
          : ""
      }
      <p><strong>Resumo:</strong> ${escapeHtml(params.resumo)}</p>
      ${params.detalhesHtml ?? ""}
      <p style="margin-top:20px;">Este e-mail foi gerado automaticamente pelo módulo de atualização normativa.</p>
    `
  );

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: params.para,
    subject: params.assunto,
    html,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}