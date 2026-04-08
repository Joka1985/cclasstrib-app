import { prisma } from "@/lib/prisma";
import { gerarArquivoParametrizacaoXlsx } from "@/lib/parametrizacao-export";
import { enviarEmailEntregaParametrizacao } from "@/lib/email-parametrizacao";

export async function finalizarEntregaParametrizacao(params: {
  loteId: string;
  ignorarPagamento?: boolean;
}) {
  const lote = await prisma.lote.findUnique({
    where: { id: params.loteId },
    include: {
      cliente: true,
      resultadosParametrizacao: {
        include: {
          operacaoFiscal: true,
          baseOficialClassificacao: true,
        },
        orderBy: [
          { abaDestino: "asc" },
          { codProduto: "asc" },
          { descricao: "asc" },
        ],
      },
    },
  });

  if (!lote) {
    throw new Error("Lote não encontrado.");
  }

  if (!lote.dataOrcamentoGerado) {
    throw new Error("Não é possível entregar antes de gerar o orçamento.");
  }

  if (!params.ignorarPagamento && !lote.dataPagamentoConfirmado) {
    throw new Error("Não é possível entregar antes da confirmação do pagamento.");
  }

  if (!lote.resultadosParametrizacao.length) {
    throw new Error("Não existem resultados de parametrização para este lote.");
  }

  const parametrizacaoFinal = lote.resultadosParametrizacao
    .filter((item) => item.abaDestino === "PARAMETRIZACAO_FINAL")
    .map((item) => ({
      codProduto: item.codProduto,
      descricao: item.descricao,
      ncm: item.ncm,
      cfop: item.cfop,
      cst: item.cst,
      cclassTrib: item.cclassTrib,
      descCclassTrib:
        item.descCclassTrib ??
        item.baseOficialClassificacao?.nomeCclassTrib ??
        null,
      tipoAliquota:
        item.tipoAliquota ??
        item.baseOficialClassificacao?.tipoAliquota ??
        null,
      pRedIbs: item.pRedIbs ? Number(item.pRedIbs) : null,
      pRedCbs: item.pRedCbs ? Number(item.pRedCbs) : null,
      artigoLc214:
        item.artigoLc214 ??
        item.baseOficialClassificacao?.artigoLc214 ??
        null,
      observacoes: item.observacoes,
      dataReferencia: item.dataReferencia,
      responsavel: item.responsavel,
    }));

  const cenariosAmbiguidade = lote.resultadosParametrizacao
    .filter((item) => item.abaDestino === "CENARIOS_AMBIGUIDADE")
    .map((item) => ({
      codProduto: item.codProduto,
      produtoCenario: `${item.descricao}${item.ncm ? ` (NCM ${item.ncm})` : ""}`,
      operacao: item.operacaoFiscal?.nomeOperacao ?? null,
      cfop: item.cfop,
      cst: item.cst,
      cclassTrib: item.cclassTrib,
      fundamentacao: item.fundamento,
      resultado:
        item.statusDecisao === "REVISAR"
          ? "REVISAR"
          : item.statusDecisao === "FECHADO_COM_RESSALVA"
            ? "FECHADO_COM_RESSALVA"
            : "FECHADO",
    }));

  const { nomeArquivo, arquivoBase64, indice } = gerarArquivoParametrizacaoXlsx({
    protocolo: lote.protocolo ?? lote.id,
    parametrizacaoFinal,
    cenariosAmbiguidade,
  });

  let emailEnviado = false;
  let emailErro: string | null = null;

  try {
    await enviarEmailEntregaParametrizacao({
      indiceAuditoria: indice,
      para: lote.cliente.email,
      nomeCliente: lote.cliente.nomeRazaoSocial,
      protocolo: lote.protocolo ?? lote.id,
      nomeArquivo,
      arquivoBase64,
    });

    emailEnviado = true;
  } catch (error) {
    emailErro =
      error instanceof Error ? error.message : "Erro ao enviar e-mail de entrega.";
  }

  const loteAtualizado = await prisma.lote.update({
    where: { id: lote.id },
    data: {
      arquivoEntregaNome: nomeArquivo,
      arquivoEntregaBase64: arquivoBase64,
      dataEntregaEnviada: emailEnviado ? new Date() : null,
      statusLote: emailEnviado ? "EMAIL_ENVIADO" : "PROCESSADO_COM_SUCESSO",
    },
    include: {
      cliente: true,
      resultadosParametrizacao: true,
    },
  });

  return {
    ok: true,
    mensagem: emailEnviado
      ? "Planilha final de parametrização gerada e enviada com sucesso."
      : "Planilha final gerada, mas houve falha no envio do e-mail.",
    lote: loteAtualizado,
    emailEnviado,
    emailErro,
  };
}