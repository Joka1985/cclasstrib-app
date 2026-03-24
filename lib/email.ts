import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type ResumoRelatorio = {
  totalItensPlanilhaValidos: number;
  totalItensUnicosConsiderados: number;
  totalRelacionadosAoXml: number;
  totalRelacionadosComDivergencia: number;
  totalSemRelacaoComCfopManual: number;
  totalSemRelacaoSemCfopManual: number;
  totalAptosParaAnalise: number;
  totalImprecisos: number;
  totalDuplicadosConsolidados: number;
  totalSomenteNoXml: number;
  totalDivergenciasNcm: number;
  totalDivergenciasDescricao: number;
};

type EmailSolicitacaoClienteParams = {
  para: string;
  nomeCliente: string;
  protocolo: string;
  resumo: ResumoRelatorio;
  anexoBase64: string;
  nomeArquivo: string;
};

type EmailRelatorioSuporteParams = {
  para: string;
  protocolo: string;
  loteId: string;
  cliente: string;
  documento: string;
  emailCliente: string;
  modoDocumentacao: string;
  resumo: ResumoRelatorio;
  anexoBase64: string;
  nomeArquivo: string;
};

function garantirConfig() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY não configurada.");
  }

  if (!process.env.EMAIL_FROM) {
    throw new Error("EMAIL_FROM não configurado.");
  }
}

export async function enviarEmailSolicitacaoCliente({
  para,
  nomeCliente,
  protocolo,
  resumo,
  anexoBase64,
  nomeArquivo,
}: EmailSolicitacaoClienteParams) {
  garantirConfig();

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: [para],
    subject: `Recebemos sua documentação - Protocolo ${protocolo}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>Recebemos sua documentação</h2>
        <p>Olá, ${nomeCliente}.</p>
        <p>Seu envio foi recebido com sucesso.</p>
        <p><strong>Protocolo de atendimento:</strong> ${protocolo}</p>
        <p>Em breve será enviado orçamento para aprovação.</p>

        <h3>Resumo da conferência</h3>
        <ul>
          <li>Itens válidos da planilha: ${resumo.totalItensPlanilhaValidos}</li>
          <li>Itens únicos considerados: ${resumo.totalItensUnicosConsiderados}</li>
          <li>Relacionados ao XML: ${resumo.totalRelacionadosAoXml}</li>
          <li>Relacionados com divergência: ${resumo.totalRelacionadosComDivergencia}</li>
          <li>Sem XML com CFOP manual: ${resumo.totalSemRelacaoComCfopManual}</li>
          <li>Sem XML sem CFOP manual: ${resumo.totalSemRelacaoSemCfopManual}</li>
          <li>Aptos para análise: ${resumo.totalAptosParaAnalise}</li>
          <li>Itens com classificação imprecisa: ${resumo.totalImprecisos}</li>
        </ul>

        <p>Segue em anexo a planilha de conferência deste protocolo.</p>

        <p>Atenciosamente,<br/>Equipe cClassTrib</p>
      </div>
    `,
    attachments: [
      {
        filename: nomeArquivo,
        content: anexoBase64,
      },
    ],
  });

  if (error) {
    throw new Error(error.message || "Erro ao enviar e-mail ao cliente.");
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
}: EmailRelatorioSuporteParams) {
  garantirConfig();

  const { data, error } = await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: [para],
    subject: `Relatório de conferência - ${cliente} - ${protocolo}`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
        <h2>Relatório interno do lote</h2>

        <p><strong>Protocolo:</strong> ${protocolo}</p>
        <p><strong>Lote ID:</strong> ${loteId}</p>
        <p><strong>Cliente:</strong> ${cliente}</p>
        <p><strong>CPF/CNPJ:</strong> ${documento}</p>
        <p><strong>E-mail do cliente:</strong> ${emailCliente}</p>
        <p><strong>Modo da documentação:</strong> ${modoDocumentacao}</p>

        <h3>Resumo consolidado</h3>
        <ul>
          <li>Itens válidos da planilha: ${resumo.totalItensPlanilhaValidos}</li>
          <li>Itens únicos considerados: ${resumo.totalItensUnicosConsiderados}</li>
          <li>Relacionados ao XML: ${resumo.totalRelacionadosAoXml}</li>
          <li>Relacionados com divergência: ${resumo.totalRelacionadosComDivergencia}</li>
          <li>Sem XML com CFOP manual: ${resumo.totalSemRelacaoComCfopManual}</li>
          <li>Sem XML sem CFOP manual: ${resumo.totalSemRelacaoSemCfopManual}</li>
          <li>Aptos para análise: ${resumo.totalAptosParaAnalise}</li>
          <li>Imprecisos: ${resumo.totalImprecisos}</li>
          <li>Duplicados consolidados: ${resumo.totalDuplicadosConsolidados}</li>
          <li>Somente no XML: ${resumo.totalSomenteNoXml}</li>
          <li>Divergências de NCM: ${resumo.totalDivergenciasNcm}</li>
          <li>Divergências de descrição: ${resumo.totalDivergenciasDescricao}</li>
        </ul>

        <p>Segue em anexo a planilha analítica do lote.</p>
      </div>
    `,
    attachments: [
      {
        filename: nomeArquivo,
        content: anexoBase64,
      },
    ],
  });

  if (error) {
    throw new Error(error.message || "Erro ao enviar relatório ao suporte.");
  }

  return data;
}