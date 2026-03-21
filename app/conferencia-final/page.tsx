"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DadosConferencia = {
  lote: {
    id: string;
    protocolo: string | null;
    cliente: string;
    documento: string;
  };
  resumo: {
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
  aviso: string;
};

export default function ConferenciaFinalPage() {
  const router = useRouter();

  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [dados, setDados] = useState<DadosConferencia | null>(null);

  useEffect(() => {
    async function carregar() {
      const loteId = localStorage.getItem("loteId");

      if (!loteId) {
        setMensagem("Nenhum lote encontrado. Faça o cadastro novamente.");
        setCarregando(false);
        return;
      }

      try {
        const resposta = await fetch("/api/conferencia-final", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ loteId }),
        });

        const json = await resposta.json();

        if (!resposta.ok) {
          throw new Error(json.error || "Erro ao carregar conferência.");
        }

        setDados(json);
      } catch (error) {
        setMensagem(
          error instanceof Error ? error.message : "Erro ao carregar conferência."
        );
      } finally {
        setCarregando(false);
      }
    }

    carregar();
  }, []);

  async function prosseguir() {
    const loteId = localStorage.getItem("loteId");

    if (!loteId) {
      setMensagem("Nenhum lote encontrado.");
      return;
    }

    setProcessando(true);
    setMensagem("");

    try {
      const resposta = await fetch("/api/confirmar-solicitacao", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ loteId }),
      });

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(json.error || "Erro ao confirmar solicitação.");
      }

      router.push("/resumo");
    } catch (error) {
      setMensagem(
        error instanceof Error ? error.message : "Erro ao confirmar solicitação."
      );
    } finally {
      setProcessando(false);
    }
  }

  async function naoProsseguir() {
    const loteId = localStorage.getItem("loteId");

    if (!loteId) {
      setMensagem("Nenhum lote encontrado.");
      return;
    }

    setProcessando(true);
    setMensagem("");

    try {
      const resposta = await fetch("/api/cancelar-solicitacao", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ loteId }),
      });

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(json.error || "Erro ao cancelar solicitação.");
      }

      localStorage.removeItem("clienteId");
      localStorage.removeItem("loteId");
      localStorage.removeItem("protocolo");

      router.push("/");
    } catch (error) {
      setMensagem(
        error instanceof Error ? error.message : "Erro ao cancelar solicitação."
      );
    } finally {
      setProcessando(false);
    }
  }

  if (carregando) {
    return (
      <main className="min-h-screen bg-zinc-50 px-6 py-10">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow">
          Carregando conferência...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-zinc-900">Conferência final</h1>

        {dados && (
          <>
            <p className="mt-2 text-sm text-zinc-600">
              Cliente: <strong>{dados.lote.cliente}</strong>
            </p>

            <p className="mt-1 text-sm text-zinc-600">
              Protocolo provisório: <strong>{dados.lote.protocolo}</strong>
            </p>

            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {dados.aviso}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <div className="rounded-xl border p-4">
                <div className="text-sm text-zinc-500">Itens válidos da planilha</div>
                <div className="text-2xl font-bold">
                  {dados.resumo.totalItensPlanilhaValidos}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm text-zinc-500">Itens únicos considerados</div>
                <div className="text-2xl font-bold">
                  {dados.resumo.totalItensUnicosConsiderados}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm text-zinc-500">Itens relacionados ao XML</div>
                <div className="text-2xl font-bold">
                  {dados.resumo.totalRelacionadosAoXml}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm text-zinc-500">
                  Itens relacionados com divergência
                </div>
                <div className="text-2xl font-bold">
                  {dados.resumo.totalRelacionadosComDivergencia}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm text-zinc-500">
                  Sem XML, mas com CFOP manual
                </div>
                <div className="text-2xl font-bold">
                  {dados.resumo.totalSemRelacaoComCfopManual}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm text-zinc-500">
                  Sem XML e sem CFOP manual
                </div>
                <div className="text-2xl font-bold">
                  {dados.resumo.totalSemRelacaoSemCfopManual}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm text-zinc-500">
                  Itens aptos para análise
                </div>
                <div className="text-2xl font-bold">
                  {dados.resumo.totalAptosParaAnalise}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm text-zinc-500">
                  Itens com classificação imprecisa
                </div>
                <div className="text-2xl font-bold">
                  {dados.resumo.totalImprecisos}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm text-zinc-500">
                  Itens duplicados consolidados
                </div>
                <div className="text-2xl font-bold">
                  {dados.resumo.totalDuplicadosConsolidados}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm text-zinc-500">
                  Itens encontrados apenas no XML
                </div>
                <div className="text-2xl font-bold">
                  {dados.resumo.totalSomenteNoXml}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm text-zinc-500">Divergências de NCM</div>
                <div className="text-2xl font-bold">
                  {dados.resumo.totalDivergenciasNcm}
                </div>
              </div>

              <div className="rounded-xl border p-4">
                <div className="text-sm text-zinc-500">
                  Divergências de descrição
                </div>
                <div className="text-2xl font-bold">
                  {dados.resumo.totalDivergenciasDescricao}
                </div>
              </div>
            </div>

            <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
              O prosseguimento implicará contato para efeito de orçamento apenas
              dos itens com informações mínimas completas para análise. Itens sem
              código, descrição, NCM ou CFOP poderão ter classificação imprecisa.
            </div>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={prosseguir}
                disabled={processando}
                className="rounded-xl bg-black px-5 py-3 font-medium text-white disabled:opacity-60"
              >
                {processando ? "Processando..." : "Prosseguir"}
              </button>

              <button
                type="button"
                onClick={naoProsseguir}
                disabled={processando}
                className="rounded-xl border border-zinc-300 px-5 py-3 font-medium text-zinc-700 disabled:opacity-60"
              >
                Não prosseguir
              </button>
            </div>
          </>
        )}

        {mensagem && (
          <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            {mensagem}
          </div>
        )}
      </div>
    </main>
  );
}