"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type RespostaUploadXml = {
  ok: boolean;
  mensagem?: string;
  error?: string;
  totalArquivosXmlProcessados?: number;
  totalDocumentosCriados?: number;
  totalItensXml?: number;
  totalDivergencias?: number;
};

export default function UploadXmlPage() {
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

  async function enviarXml() {
    setMensagem("");

    if (!loteId.trim()) {
      setMensagem("Nenhum lote encontrado. Faça o cadastro primeiro.");
      return;
    }

    if (!arquivo) {
      setMensagem("Selecione um arquivo antes de enviar.");
      return;
    }

    setCarregando(true);

    try {
      const formData = new FormData();
      formData.append("loteId", loteId);
      formData.append("arquivo", arquivo);

      const resposta = await fetch("/api/upload-xml", {
        method: "POST",
        body: formData,
      });

      const texto = await resposta.text();

      let dados: RespostaUploadXml;
      try {
        dados = JSON.parse(texto);
      } catch {
        throw new Error(texto.slice(0, 300));
      }

      if (!resposta.ok || !dados.ok) {
        throw new Error(dados.error || "Erro ao enviar XML.");
      }

      const mensagemFinal =
        `${dados.mensagem ?? "Arquivo processado com sucesso."} ` +
        `Arquivos XML processados: ${dados.totalArquivosXmlProcessados ?? 0}. ` +
        `Documentos criados: ${dados.totalDocumentosCriados ?? 0}. ` +
        `Itens do XML: ${dados.totalItensXml ?? 0}. ` +
        `Divergências encontradas: ${dados.totalDivergencias ?? 0}.`;

      setMensagem(mensagemFinal);
      setArquivo(null);

      setTimeout(() => {
        router.push("/conferencia-final");
      }, 1800);
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
        <h1 className="text-3xl font-bold text-zinc-900">Upload do XML</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Envie o XML para triagem e conferência.
        </p>

        <div className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Arquivo XML
            </label>
            <input
              type="file"
              accept=".xml,.zip,.rar"
              onChange={(e) => {
                const arquivoSelecionado = e.target.files?.[0] ?? null;
                setArquivo(arquivoSelecionado);
              }}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
            />
            <p className="mt-2 text-xs text-zinc-500">
              Formatos aceitos: .xml, .zip e .rar
            </p>
          </div>

          <button
            type="button"
            onClick={enviarXml}
            disabled={carregando}
            className="w-full rounded-xl bg-black px-4 py-3 font-medium text-white disabled:opacity-60"
          >
            {carregando ? "Enviando..." : "Enviar XML"}
          </button>

          {mensagem && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
              {mensagem}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}