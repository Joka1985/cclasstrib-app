import { Resend } from "resend";

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");
  return new Resend(process.env.RESEND_API_KEY);
}

function checkConfig() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY não configurada");
  if (!process.env.EMAIL_FROM) throw new Error("EMAIL_FROM não configurado");
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
  indiceAuditoria,
}: {
  para: string;
  nomeCliente: string;
  protocolo: string;
  nomeArquivo: string;
  arquivoBase64: string;
  indiceAuditoria?: {
    precisao: number;
    totalItens: number;
    totalErros: number;
    totalRevisao: number;
    totalCorretos: number;
    entregaComRessalva: boolean;
    resumo: string;
  };
}) {
  checkConfig();

  const comRessalva = indiceAuditoria?.entregaComRessalva ?? false;
  const precisao = indiceAuditoria?.precisao ?? 100;

  const badgeRessalva = comRessalva
    ? `<span style="display:inline-block;padding:4px 12px;border-radius:20px;background:#fef3c7;color:#92400e;font-size:13px;font-weight:700;">⚠️ COM RESSALVA</span>`
    : `<span style="display:inline-block;padding:4px 12px;border-radius:20px;background:#d1fae5;color:#065f46;font-size:13px;font-weight:700;">✅ SEM RESSALVA</span>`;

  const blocoAuditoria = indiceAuditoria
    ? `
      <div style="margin:20px 0;padding:16px;border-radius:10px;background:${comRessalva ? "#fffbeb" : "#f0fdf4"};border:1px solid ${comRessalva ? "#fde68a" : "#bbf7d0"};">
        <p style="margin:0 0 8px 0;font-weight:700;font-size:15px;">Índice de precisão da classificação ${badgeRessalva}</p>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr>
            <td style="padding:4px 8px 4px 0;color:#6b7280;">Precisão geral</td>
            <td style="padding:4px 0;font-weight:700;color:${precisao === 100 ? "#065f46" : precisao >= 80 ? "#92400e" : "#991b1b"};">${precisao}%</td>
          </tr>
          <tr>
            <td style="padding:4px 8px 4px 0;color:#6b7280;">Total de itens auditados</td>
            <td style="padding:4px 0;font-weight:600;">${indiceAuditoria.totalItens}</td>
          </tr>
          <tr>
            <td style="padding:4px 8px 4px 0;color:#6b7280;">✅ Corretos</td>
            <td style="padding:4px 0;font-weight:600;color:#065f46;">${indiceAuditoria.totalCorretos}</td>
          </tr>
          ${indiceAuditoria.totalErros > 0 ? `
          <tr>
            <td style="padding:4px 8px 4px 0;color:#6b7280;">❌ Erros confirmados</td>
            <td style="padding:4px 0;font-weight:600;color:#991b1b;">${indiceAuditoria.totalErros}</td>
          </tr>` : ""}
          ${indiceAuditoria.totalRevisao > 0 ? `
          <tr>
            <td style="padding:4px 8px 4px 0;color:#6b7280;">⚠️ Itens para revisão</td>
            <td style="padding:4px 0;font-weight:600;color:#92400e;">${indiceAuditoria.totalRevisao}</td>
          </tr>` : ""}
        </table>
        ${comRessalva ? `<p style="margin:12px 0 0 0;font-size:12px;color:#6b7280;">Os apontamentos estão detalhados nas colunas STATUS_AUDITORIA e APONTAMENTO_AUDITORIA da planilha anexa.</p>` : ""}
      </div>
    `
    : "";

  const assunto = comRessalva
    ? `Parametrização COM RESSALVA (precisão ${precisao}%) - ${protocolo}`
    : `Parametrização SEM RESSALVA (precisão 100%) - ${protocolo}`;

  const { data, error } = await getResend().emails.send({
    from: process.env.EMAIL_FROM!,
    to: [para],
    subject: assunto,
    html: montarLayoutEmail(
      comRessalva
        ? "Planilha de parametrização — COM RESSALVA"
        : "Planilha de parametrização — SEM RESSALVA",
      `
        <p>Olá, ${escapeHtml(nomeCliente)}</p>
        <p><strong>Protocolo:</strong> ${escapeHtml(protocolo)}</p>
        ${blocoAuditoria}
        <p>Segue em anexo a <strong>planilha final de parametrização cClassTrib</strong> para implantação no ERP.</p>
        <p>Quando aplicável, o arquivo também contém a aba <strong>CENARIOS_AMBIGUIDADE</strong>, demonstrando que a operação define o código, e não apenas o produto.</p>
        <p>Atenciosamente,<br />Equipe cClassTrib</p>
      `
    ),
    attachments: [{ filename: nomeArquivo, content: arquivoBase64 }],
  });

  if (error) throw new Error(error.message);
  return data;
}