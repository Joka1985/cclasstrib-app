import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type ResumoSolicitacao = {
  totalItensPlanilhaValidos?: number;
  totalItensUnicosConsiderados?: number;
  totalRelacionadosAoXml?: number;
  totalRelacionadosComDivergencia?: number;
  totalSemXmlComCfopManual?: number;
  totalSemXmlSemCfopManual?: number;
  totalAptosAnalise?: number;
  totalImprecisos?: number;
  totalDuplicadosConsolidados?: number;
  totalSomenteNoXml?: number;
  totalDivergenciasNcm?: number;
  totalDivergenciasDescricao?: number;
};

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

function formatarMoeda(valor?: string | number | null) {
  const numero = Number(valor ?? 0);

  if (Number.isNaN(numero)) {
    return "R$ 0,00";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numero);
}

function montarResumoHtml(resumo?: ResumoSolicitacao) {
  if (!resumo) return "";

  return `
    <h3 style="margin:24px 0 12px 0;">Resumo do lote</h3>
    <ul style="padding-left:18px;line-height:1.7;">
      <li>Total de itens válidos na planilha: ${resumo.totalItensPlanilhaValidos ?? 0}</li>
      <li>Total de itens únicos considerados: ${resumo.totalItensUnicosConsiderados ?? 0}</li>
      <li>Total relacionados ao XML: ${resumo.totalRelacionadosAoXml ?? 0}</li>
      <li>Total relacionados com divergência: ${resumo.totalRelacionadosComDivergencia ?? 0}</li>
      <li>Total sem XML com CFOP manual: ${resumo.totalSemXmlComCfopManual ?? 0}</li>
      <li>Total sem XML sem CFOP manual: ${resumo.totalSemXmlSemCfopManual ?? 0}</li>
      <li>Total aptos para análise: ${resumo.totalAptosAnalise ?? 0}</li>
      <li>Total imprecisos: ${resumo.totalImprecisos ?? 0}</li>
      <li>Total duplicados consolidados: ${resumo.totalDuplicadosConsolidados ?? 0}</li>
      <li>Total somente no XML: ${resumo.totalSomenteNoXml ?? 0}</li>
      <li>Total divergências de NCM: ${resumo.totalDivergenciasNcm ?? 0}</li>
      <li>Total divergências de descrição: ${resumo.totalDivergenciasDescricao ?? 0}</li>
    </ul>
  `;
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

function montarBotao(label: string, href: string, background: string) {
  return `
    <a
      href="${escapeHtml(href)}"
      style="
        display:inline-block;
        padding:12px 18px;
        border-radius:10px;
        background:${background};
        color:#ffffff;
        text-decoration:none;
        font-weight:700;
        font-size:14px;
        margin-right:10px;
        margin-bottom:10px;
      "
    >
      ${escapeHtml(label)}
    </a>
  `;
}

export async function enviarEmailSolicitacaoCliente({
  para,
  nomeCliente,
  protocolo,
  resumo,
  anexoBase64,
  nomeArquivo,
}: {
  para: string;
  nomeCliente: string;
  protocolo: string;
  resumo?: ResumoSolicitacao;
  anexoBase64: string;
  nomeArquivo: string;
}) {
  checkConfig();

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: [para],
    subject: `Recebemos sua documentação - Protocolo ${protocolo}`,
    html: montarLayoutEmail(
      "Recebemos sua documentação",
      `
        <p>Olá, ${escapeHtml(nomeCliente)}</p>
        <p>Seu envio foi recebido com sucesso.</p>
        <p><strong>Protocolo:</strong> ${escapeHtml(protocolo)}</p>
        ${montarResumoHtml(resumo)}
        <p>Em breve será enviado orçamento para aprovação.</p>
        <p>Atenciosamente,<br />Equipe cClassTrib</p>
      `
    ),
    attachments: [
      {
        filename: nomeArquivo,
        content: anexoBase64,
      },
    ],
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function enviarEmailRelatorioSuporte({
  para,
  protocolo,
  loteId,
  cliente,
  documento,
  emailCliente,
  modoDocumentacao,
  resumo,
  anexoBase64,
  nomeArquivo,
}: {
  para: string;
  protocolo: string;
  loteId?: string;
  cliente: string;
  documento?: string;
  emailCliente?: string | null;
  modoDocumentacao?: string;
  resumo?: ResumoSolicitacao;
  anexoBase64: string;
  nomeArquivo: string;
}) {
  checkConfig();

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: [para],
    subject: `Relatório lote ${protocolo}`,
    html: montarLayoutEmail(
      "Relatório interno",
      `
        <p><strong>Protocolo:</strong> ${escapeHtml(protocolo)}</p>
        ${loteId ? `<p><strong>Lote ID:</strong> ${escapeHtml(loteId)}</p>` : ""}
        <p><strong>Cliente:</strong> ${escapeHtml(cliente)}</p>
        ${documento ? `<p><strong>Documento:</strong> ${escapeHtml(documento)}</p>` : ""}
        ${
          emailCliente
            ? `<p><strong>E-mail do cliente:</strong> ${escapeHtml(emailCliente)}</p>`
            : ""
        }
        ${
          modoDocumentacao
            ? `<p><strong>Modo de documentação:</strong> ${escapeHtml(modoDocumentacao)}</p>`
            : ""
        }
        ${montarResumoHtml(resumo)}
      `
    ),
    attachments: [
      {
        filename: nomeArquivo,
        content: anexoBase64,
      },
    ],
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function enviarEmailOrcamentoCliente({
  para,
  nomeCliente,
  protocolo,
  itensCobraveis,
  itensComRessalva,
  itensImprecisos,
  valorUnitario,
  valorTotal,
  observacao,
  observacaoOrcamento,
  tokenAcaoOrcamento,
}: {
  para: string;
  nomeCliente: string;
  protocolo: string;
  itensCobraveis?: number;
  itensComRessalva?: number;
  itensImprecisos?: number;
  valorUnitario?: string | number;
  valorTotal: string | number;
  observacao?: string | null;
  observacaoOrcamento?: string | null;
  tokenAcaoOrcamento: string;
}) {
  checkConfig();

  const observacaoFinal = observacaoOrcamento ?? observacao ?? undefined;

  const appUrl =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000";

  const token = encodeURIComponent(tokenAcaoOrcamento);

  const linkProsseguir = `${appUrl}/pagamento?token=${token}`;
  const linkTesteProcessamento = `${appUrl}/api/teste-iniciar-processamento?token=${token}`;
  const linkRecusar = `${appUrl}/api/recusar-orcamento?token=${token}`;

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: [para],
    subject: `Orçamento disponível - ${protocolo}`,
    html: montarLayoutEmail(
      "Orçamento disponível",
      `
        <p>Olá, ${escapeHtml(nomeCliente)}</p>
        <p><strong>Protocolo:</strong> ${escapeHtml(protocolo)}</p>

        ${
          itensCobraveis !== undefined
            ? `<p><strong>Itens cobráveis:</strong> ${itensCobraveis}</p>`
            : ""
        }
        ${
          itensComRessalva !== undefined
            ? `<p><strong>Itens com ressalva:</strong> ${itensComRessalva}</p>`
            : ""
        }
        ${
          itensImprecisos !== undefined
            ? `<p><strong>Itens imprecisos:</strong> ${itensImprecisos}</p>`
            : ""
        }
        ${
          valorUnitario !== undefined
            ? `<p><strong>Valor unitário:</strong> ${escapeHtml(
                formatarMoeda(valorUnitario)
              )}</p>`
            : ""
        }
        <p><strong>Valor total:</strong> ${escapeHtml(formatarMoeda(valorTotal))}</p>

        ${
          observacaoFinal
            ? `<p><strong>Observação:</strong> ${escapeHtml(observacaoFinal)}</p>`
            : ""
        }

        <div style="margin:24px 0 10px 0;">
          ${montarBotao("Prosseguir para pagamento", linkProsseguir, "#111827")}
          ${montarBotao("Teste iniciar processamento", linkTesteProcessamento, "#1d4ed8")}
          ${montarBotao("Não desejo prosseguir", linkRecusar, "#991b1b")}
        </div>

        <div style="margin-top:18px;padding:14px 16px;background:#eff6ff;border:1px solid #93c5fd;border-radius:10px;">
          <p style="margin:0;line-height:1.6;">
            <strong>Botão de teste interno:</strong> o botão "Teste iniciar processamento"
            foi incluído apenas para validação do fluxo técnico sem depender da aprovação do pagamento.
          </p>
        </div>

        <div style="margin-top:18px;padding:14px 16px;background:#fff7ed;border:1px solid #fdba74;border-radius:10px;">
          <p style="margin:0;line-height:1.6;">
            <strong>Validade do orçamento:</strong> 24 horas após o envio deste e-mail.
            Após esse prazo, o orçamento será expirado automaticamente e as informações serão desconsideradas para continuidade.
          </p>
        </div>

        <p style="margin-top:18px;">Atenciosamente,<br />Equipe cClassTrib</p>
      `
    ),
  });

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function enviarEmailEntregaCliente({
  para,
  nomeCliente,
  protocolo,
  arquivoBase64,
  nomeArquivo,
}: {
  para: string;
  nomeCliente: string;
  protocolo: string;
  arquivoBase64: string;
  nomeArquivo: string;
}) {
  checkConfig();

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: [para],
    subject: `Entrega do lote ${protocolo}`,
    html: montarLayoutEmail(
      "Entrega concluída",
      `
        <p>Olá, ${escapeHtml(nomeCliente)}</p>
        <p><strong>Protocolo:</strong> ${escapeHtml(protocolo)}</p>
        <p>O arquivo final classificado segue em anexo.</p>
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