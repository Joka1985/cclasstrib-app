"use client";

import { useEffect, useState } from "react";

export default function GestaoLotePage() {
  const [loteId, setLoteId] = useState("");
  const [valorUnitario, setValorUnitario] = useState("10.00");
  const [observacaoOrcamento, setObservacaoOrcamento] = useState("");
  const [arquivoEntrega, setArquivoEntrega] = useState<File | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const loteSalvo = localStorage.getItem("loteId") ?? "";
    setLoteId(loteSalvo);
  }, []);

  async function gerarOrcamento() {
    setCarregando(true);
    setMensagem("");

    try {
      const resposta = await fetch("/api/gerar-orcamento", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loteId,
          valorUnitario: Number(valorUnitario),
          observacaoOrcamento,
          enviarEmail: true,
        }),
      });

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(json.error || "Erro ao gerar orçamento.");
      }

      setMensagem(
        json.emailEnviado
          ? `Orçamento gerado e enviado com sucesso. Valor total: R$ ${json.lote.valorTotal}.`
          : `Orçamento gerado, mas o e-mail não foi enviado. Motivo: ${json.emailErro || "não informado"}.`
      );
    } catch (error) {
      setMensagem(
        error instanceof Error ? error.message : "Erro ao gerar orçamento."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function confirmarPagamento() {
    setCarregando(true);
    setMensagem("");

    try {
      const resposta = await fetch("/api/confirmar-pagamento", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ loteId }),
      });

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(json.error || "Erro ao confirmar pagamento.");
      }

      setMensagem("Pagamento confirmado com sucesso.");
    } catch (error) {
      setMensagem(
        error instanceof Error ? error.message : "Erro ao confirmar pagamento."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function iniciarProcessamento() {
    setCarregando(true);
    setMensagem("");

    try {
      const resposta = await fetch("/api/iniciar-processamento", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ loteId }),
      });

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(json.error || "Erro ao iniciar processamento.");
      }

      setMensagem("Processamento iniciado com sucesso.");
    } catch (error) {
      setMensagem(
        error instanceof Error ? error.message : "Erro ao iniciar processamento."
      );
    } finally {
      setCarregando(false);
    }
  }

  async function entregarClassificacao() {
    if (!arquivoEntrega) {
      setMensagem("Selecione o arquivo final classificado.");
      return;
    }

    setCarregando(true);
    setMensagem("");

    try {
      const formData = new FormData();
      formData.append("loteId", loteId);
      formData.append("arquivo", arquivoEntrega);

      const resposta = await fetch("/api/entregar-classificacao", {
        method: "POST",
        body: formData,
      });

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(json.error || "Erro ao entregar classificação.");
      }

      setMensagem(
        json.emailEnviado
          ? "Arquivo final entregue e enviado ao cliente com sucesso."
          : `Entrega registrada, mas o e-mail não foi enviado. Motivo: ${json.emailErro || "não informado"}.`
      );
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Erro ao entregar classificação."
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow space-y-6">
        <h1 className="text-3xl font-bold text-zinc-900">Gestão do lote</h1>

        <div>
          <label className="mb-2 block text-sm font-medium text-zinc-700">
            Lote ID
          </label>
          <input
            type="text"
            value={loteId}
            onChange={(e) => setLoteId(e.target.value)}
            className="w-full rounded-xl border border-zinc-300 px-4 py-3"
          />
        </div>

        <div className="rounded-xl border p-4 space-y-4">
          <h2 className="text-xl font-semibold">1. Gerar orçamento</h2>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Valor unitário por item
            </label>
            <input
              type="number"
              step="0.01"
              value={valorUnitario}
              onChange={(e) => setValorUnitario(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Observação do orçamento
            </label>
            <textarea
              value={observacaoOrcamento}
              onChange={(e) => setObservacaoOrcamento(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
              rows={4}
            />
          </div>

          <button
            type="button"
            onClick={gerarOrcamento}
            disabled={carregando}
            className="rounded-xl bg-black px-5 py-3 font-medium text-white disabled:opacity-60"
          >
            Gerar e enviar orçamento
          </button>
        </div>

        <div className="rounded-xl border p-4 space-y-4">
          <h2 className="text-xl font-semibold">2. Confirmar pagamento</h2>
          <button
            type="button"
            onClick={confirmarPagamento}
            disabled={carregando}
            className="rounded-xl bg-black px-5 py-3 font-medium text-white disabled:opacity-60"
          >
            Confirmar pagamento
          </button>
        </div>

        <div className="rounded-xl border p-4 space-y-4">
          <h2 className="text-xl font-semibold">3. Iniciar processamento</h2>
          <button
            type="button"
            onClick={iniciarProcessamento}
            disabled={carregando}
            className="rounded-xl bg-black px-5 py-3 font-medium text-white disabled:opacity-60"
          >
            Iniciar processamento
          </button>
        </div>

        <div className="rounded-xl border p-4 space-y-4">
          <h2 className="text-xl font-semibold">
            4. Entregar itens classificados
          </h2>

          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setArquivoEntrega(e.target.files?.[0] ?? null)}
            className="w-full rounded-xl border border-zinc-300 px-4 py-3"
          />

          <button
            type="button"
            onClick={entregarClassificacao}
            disabled={carregando}
            className="rounded-xl bg-black px-5 py-3 font-medium text-white disabled:opacity-60"
          >
            Enviar arquivo final ao cliente
          </button>
        </div>

        {mensagem && (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            {mensagem}
          </div>
        )}
      </div>
    </main>
  );
}