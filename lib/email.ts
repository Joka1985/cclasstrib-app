import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type EmailSolicitacaoParams = {
  para: string;
  nomeCliente: string;
  protocolo: string;
};

export async function enviarEmailSolicitacao({
  para,
  nomeCliente,
  protocolo,
}: EmailSolicitacaoParams) {
  const from = process.env.EMAIL_FROM;

  if (!from) {
    throw new Error("EMAIL_FROM não configurado.");
  }

  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  const info = await resend.emails.send({
    from,
    to: [para],
    subject: `Recebemos sua documentação - Protocolo ${protocolo}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>Recebemos sua documentação</h2>
        <p>Olá, ${nomeCliente}.</p>
        <p>Seu envio foi recebido com sucesso.</p>
        <p><strong>Protocolo de atendimento:</strong> ${protocolo}</p>
        <p>Em breve será enviado orçamento para aprovação.</p>
        <p>Atenciosamente,<br/>Equipe cClassTrib</p>
      </div>
    `,
  });

  return info;
}