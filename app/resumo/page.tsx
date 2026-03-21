"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ResumoPage() {
  const [protocolo, setProtocolo] = useState("");

  useEffect(() => {
    const protocoloSalvo = localStorage.getItem("protocolo") ?? "";
    setProtocolo(protocoloSalvo);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-10">
      <div className="mx-auto max-w-3xl rounded-2xl bg-white p-8 shadow">
        <h1 className="text-3xl font-bold text-zinc-900">
          Envio concluído
        </h1>

        <p className="mt-3 text-sm text-zinc-600">
          Seus documentos foram recebidos com sucesso e seguirão para triagem e
          conferência inicial.
        </p>

        <div className="mt-8 space-y-4">
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              Status da solicitação
            </h2>
            <p className="mt-2 text-sm text-zinc-700">
              Cadastro concluído, planilha enviada e XML recebido com sucesso.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              Protocolo de atendimento
            </h2>
            <p className="mt-2 text-sm font-medium text-zinc-900">
              {protocolo || "Protocolo não identificado"}
            </p>
            <p className="mt-2 text-sm text-zinc-700">
              Guarde esse número para eventual suporte e acompanhamento.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <h2 className="text-sm font-semibold text-zinc-900">
              Próximos passos
            </h2>
            <p className="mt-2 text-sm text-zinc-700">
              Recebemos sua documentação. Em breve será enviado orçamento para
              aprovação.
            </p>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap gap-4">
          <Link
            href="/"
            className="rounded-xl bg-black px-5 py-3 font-medium text-white"
          >
            Voltar ao início
          </Link>

          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("clienteId");
              localStorage.removeItem("loteId");
              localStorage.removeItem("protocolo");
              window.location.href = "/cadastro";
            }}
            className="rounded-xl border border-zinc-300 px-5 py-3 font-medium text-zinc-700"
          >
            Iniciar novo envio
          </button>
        </div>
      </div>
    </main>
  );
}