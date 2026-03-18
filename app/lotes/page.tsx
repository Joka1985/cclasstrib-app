"use client";

import { useState } from "react";

export default function LotesPage() {
  const [clienteId, setClienteId] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function criarLote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagem("");
    setCarregando(true);

    try {
      const resposta = await fetch("/api/lotes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ clienteId }),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.error || "Erro ao criar lote");
      }

      setMensagem(`Lote criado com sucesso. ID do lote: ${dados.lote.id}`);
      setClienteId("");
    } catch (error) {
      const mensagemErro =
        error instanceof Error ? error.message : "Erro inesperado";
      setMensagem(mensagemErro);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-zinc-900">Criar lote</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Informe o ID do cliente para gerar um lote vinculado.
        </p>

        <form onSubmit={criarLote} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              ID do cliente
            </label>
            <input
              type="text"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
              placeholder="Cole aqui o ID do cliente"
              required
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-black px-4 py-3 font-medium text-white disabled:opacity-60"
          >
            {carregando ? "Criando..." : "Criar lote"}
          </button>

          {mensagem && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              {mensagem}
            </div>
          )}
        </form>
      </div>
    </main>
  );
}