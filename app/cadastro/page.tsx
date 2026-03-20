"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormData = {
  tipoPessoa: "PF" | "PJ";
  nomeRazaoSocial: string;
  cpfCnpj: string;
  atividadePrincipal: string;
  email: string;
  telefone: string;
  uf: string;
};

export default function CadastroPage() {
  const router = useRouter();

  const [form, setForm] = useState<FormData>({
    tipoPessoa: "PJ",
    nomeRazaoSocial: "",
    cpfCnpj: "",
    atividadePrincipal: "",
    email: "",
    telefone: "",
    uf: "",
  });

  const [mensagem, setMensagem] = useState("");
  const [carregando, setCarregando] = useState(false);

  function atualizarCampo(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setForm((anterior) => ({
      ...anterior,
      [name]: value,
    }));
  }

  async function enviarFormulario(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMensagem("");
    setCarregando(true);

    try {
      const resposta = await fetch("/api/clientes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.error || "Erro ao cadastrar cliente");
      }

      localStorage.setItem("clienteId", dados.cliente.id);
      localStorage.setItem("loteId", dados.lote.id);

      setMensagem("Cadastro concluído. Redirecionando para upload da planilha...");

      setTimeout(() => {
        router.push("/upload-planilha");
      }, 1200);
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
        <h1 className="text-3xl font-bold text-zinc-900">Cadastro do cliente</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Preencha os dados abaixo para iniciar o processo.
        </p>

        <form onSubmit={enviarFormulario} className="mt-8 space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Tipo de pessoa
            </label>
            <select
              name="tipoPessoa"
              value={form.tipoPessoa}
              onChange={atualizarCampo}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
            >
              <option value="PJ">Pessoa Jurídica</option>
              <option value="PF">Pessoa Física</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Nome / Razão social
            </label>
            <input
              type="text"
              name="nomeRazaoSocial"
              value={form.nomeRazaoSocial}
              onChange={atualizarCampo}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
              placeholder="Digite o nome ou razão social"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              CPF / CNPJ
            </label>
            <input
              type="text"
              name="cpfCnpj"
              value={form.cpfCnpj}
              onChange={atualizarCampo}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
              placeholder="Digite o CPF ou CNPJ"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Atividade principal
            </label>
            <input
              type="text"
              name="atividadePrincipal"
              value={form.atividadePrincipal}
              onChange={atualizarCampo}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
              placeholder="Ex.: comércio varejista, indústria, serviços"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              E-mail
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={atualizarCampo}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
              placeholder="Digite o e-mail"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              Telefone
            </label>
            <input
              type="text"
              name="telefone"
              value={form.telefone}
              onChange={atualizarCampo}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3"
              placeholder="Digite o telefone"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-700">
              UF
            </label>
            <input
              type="text"
              name="uf"
              value={form.uf}
              onChange={atualizarCampo}
              maxLength={2}
              className="w-full rounded-xl border border-zinc-300 px-4 py-3 uppercase"
              placeholder="Ex.: SP"
            />
          </div>

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-black px-4 py-3 font-medium text-white disabled:opacity-60"
          >
            {carregando ? "Salvando..." : "Continuar"}
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