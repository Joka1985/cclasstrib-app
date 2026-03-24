"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EscolhaDocumentacaoPage() {
  const router = useRouter();
  const [mensagem, setMensagem] = useState("");
  const [carregandoModo, setCarregandoModo] = useState<"COM_XML" | "SEM_XML" | null>(null);

  async function definirModo(modoDocumentacao: "COM_XML" | "SEM_XML") {
    const loteId = localStorage.getItem("loteId");

    if (!loteId) {
      setMensagem("Nenhum lote encontrado. Faça o cadastro novamente.");
      return;
    }

    setCarregandoModo(modoDocumentacao);
    setMensagem("");

    try {
      const resposta = await fetch("/api/definir-documentacao", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          loteId,
          modoDocumentacao,
        }),
      });

      const json = await resposta.json();

      if (!resposta.ok) {
        throw new Error(json.error || "Erro ao definir modo de documentação.");
      }

      if (modoDocumentacao === "COM_XML") {
        window.location.href = "/upload-xml";
        return;
      }

      window.location.href = "/conferencia-final";
    } catch (error) {
      setMensagem(
        error instanceof Error
          ? error.message
          : "Erro ao definir modo de documentação."
      );
    } finally {
      setCarregandoModo(null);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-zinc-900">
          Documentação complementar
        </h1>

        <p className="mt-3 text-sm text-zinc-600">
          Informe se a empresa possui XML para conferência documental neste
          momento.
        </p>

        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Se houver XML, o sistema fará a conferência documental dos itens da
            planilha com os itens identificados no documento fiscal.
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Se a empresa ainda não tiver realizado operações com XML, o fluxo
            seguirá normalmente com base na planilha e nas informações manuais
            disponíveis, especialmente o CFOP informado pelo cliente.
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => definirModo("COM_XML")}
            disabled={carregandoModo !== null}
            className="rounded-xl bg-black px-5 py-3 font-medium text-white disabled:opacity-60"
          >
            {carregandoModo === "COM_XML"
              ? "Abrindo etapa do XML..."
              : "Tenho XML para enviar"}
          </button>

          <button
            type="button"
            onClick={() => definirModo("SEM_XML")}
            disabled={carregandoModo !== null}
            className="rounded-xl border border-zinc-300 px-5 py-3 font-medium text-zinc-700 disabled:opacity-60"
          >
            {carregandoModo === "SEM_XML"
              ? "Prosseguindo sem XML..."
              : "Não possuo XML no momento"}
          </button>
        </div>

        {mensagem && (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {mensagem}
          </div>
        )}
      </div>
    </main>
  );
}