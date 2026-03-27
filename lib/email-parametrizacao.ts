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

function montarLayoutEmail(titulo: string, conteudo: string) {
  return `
    <div style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <div style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden;">
        <div style="background:#111827;color:#ffffff;padding:24px 28px;">
          <h2 style="margin:0;font-size:22px;line-height:1.3;">${titulo}</h2>
        </div>
        <div style="padding:28px;">
          ${conteudo}
        </div>
      </div>
    </div>
  `;
}

export async function enviarEmailEntregaParametrizacao({
  para,
  nomeCliente,
  protocolo,
  nomeArquivo,
  arquivoBase64,
}: {
  para: string;
  nomeCliente: string;
  protocolo: string;
  nomeArquivo: string;
  arquivoBase64: string;
}) {
  checkConfig();

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: [para],
    subject: `Planilha final de parametrização - ${protocolo}`,
    html: montarLayoutEmail(
      "Planilha final de parametrização disponível",
      `
        <p>Olá, ${escapeHtml(nomeCliente)}</p>
        <p><strong>Protocolo:</strong> ${escapeHtml(protocolo)}</p>
        <p>Segue em anexo a <strong>planilha final de parametrização cClassTrib</strong> para implantação no ERP.</p>
        <p>Quando aplicável, o arquivo também contém a aba <strong>CENARIOS_AMBIGUIDADE</strong>, demonstrando que a operação define o código, e não apenas o produto.</p>
        <p>Atenciosamente,<br />Equipe cClassTrib</p>
      `
    ),
    attachments: [
      {
        filename: nomeArquivo,
        content: arquivoBase64,
      },
    ],
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}