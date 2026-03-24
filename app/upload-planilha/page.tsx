"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadPlanilhaPage() {
  const router = useRouter();

  const [loteId, setLoteId] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const loteIdSalvo = localStorage.getItem("loteId");

    if (!loteIdSalvo) {
      setMensagem("Nenhum lote encontrado. Faça o cadastro primeiro.");
      return;
    }

    setLoteId(loteIdSalvo);
  }, []);

  async function enviarPlanilha(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagem("");

    if (!loteId) {
      setMensagem("Nenhum lote encontrado. Faça o cadastro primeiro.");
      return;
    }

    if (!arquivo) {
      setMensagem("Selecione uma planilha antes de enviar.");
      return;
    }

    setCarregando(true);

    try {
      const formData = new FormData();
      formData.append("loteId", loteId);
      formData.append("arquivo", arquivo);

      const resposta = await fetch("/api/upload-planilha", {
        method: "POST",
        body: formData,
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.error || "Erro ao enviar planilha");
      }

      let mensagemFinal =
        `Upload concluído com sucesso. Arquivo: ${dados.nomeArquivo}. ` +
        `Total: ${dados.lote.quantidadeLinhasPlanilha}, válidas: ${dados.lote.quantidadeLinhasValidas}, ` +
        `inválidas: ${dados.lote.quantidadeLinhasInvalidas}, itens salvos: ${dados.totalItensSalvos}.`;

      if (dados.validacaoOperacional?.observacao) {
        mensagemFinal += ` ${dados.validacaoOperacional.observacao}`;
      }

      setMensagem(mensagemFinal);

      setTimeout(() => {
        router.push("/escolha-documentacao");
      }, 1600);
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
        <h1 className="text-3xl font-bold text-zinc-900">Upload da planilha</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Envie a planilha para validação inicial.
        </p>

        <form onSubmit={enviarPlanilha} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Arquivo da planilha
            </label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const arquivoSelecionado = e.target.files?.[0] ?? null;
                setArquivo(arquivoSelecionado);
              }}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
              required
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-black px-4 py-3 font-medium text-white disabled:opacity-60"
          >
            {carregando ? "Enviando..." : "Enviar planilha"}
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