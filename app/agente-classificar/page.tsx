"use client";

import { useState } from "react";

type LogSubagente = { agente: string; status: string; nota: string };

type Resultado = {
  classificado: boolean;
  cst: string | null;
  cclassTrib: string | null;
  descCclassTrib: string | null;
  artigoLc214: string | null;
  redIbs: number;
  redCbs: number;
  onerosa: boolean;
  justificativa: string;
  ambiguidade: string | null;
  confianca: "Alta" | "Média" | "Baixa";
  pendencias: string[];
  logSubagentes: LogSubagente[];
};

const TIPOS_OPERACAO = [
  { value: "VENDA_NORMAL", label: "Venda (onerosa)" },
  { value: "BONIFICACAO_MESMA_NOTA", label: "Bonificação na mesma NF" },
  { value: "BONIFICACAO_CONDICIONAL", label: "Bonificação condicional (NF separada)" },
  { value: "DOACAO", label: "Brinde / Doação" },
  { value: "EXPORTACAO", label: "Exportação" },
  { value: "TRANSFERENCIA_FILIAL", label: "Transferência matriz/filial" },
  { value: "PRODUCAO_RURAL_NAO_CONTRIBUINTE", label: "Produtor rural não contribuinte" },
  { value: "SERVICO", label: "Prestação de serviço" },
  { value: "DEVOLUCAO", label: "Devolução" },
];

const CONFIANCA_STYLES: Record<string, string> = {
  Alta: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Média: "bg-amber-50 text-amber-700 border-amber-200",
  Baixa: "bg-red-50 text-red-700 border-red-200",
};

export default function AgenteClassificarPage() {
  const [descricao, setDescricao] = useState("");
  const [ncm, setNcm] = useState("");
  const [cfop, setCfop] = useState("");
  const [tipoOperacao, setTipoOperacao] = useState("");
  const [regime, setRegime] = useState("Lucro Presumido");
  const [cnae, setCnae] = useState("");
  const [contexto, setContexto] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function classificar() {
    if (!descricao.trim() || !tipoOperacao) {
      setErro("Preencha a descrição e o tipo de operação.");
      return;
    }
    setCarregando(true);
    setErro(null);
    setResultado(null);

    try {
      const res = await fetch("/api/agente-classificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descricao, ncm, cfop, tipoOperacao, regime, cnae, contexto }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error ?? "Erro desconhecido");
      setResultado(json.resultado);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao classificar.");
    } finally {
      setCarregando(false);
    }
  }

  function exemplo() {
    setDescricao("Arroz polido tipo 1, pacote 5kg");
    setNcm("10063021");
    setCfop("5102");
    setTipoOperacao("VENDA_NORMAL");
    setRegime("Lucro Presumido");
    setContexto("Venda para consumidor final PF. Produto destinado à alimentação humana.");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-white p-8 shadow">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            Agente IA — 7 subagentes
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-zinc-900">
            Classificador cClassTrib
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Classificação avulsa por IBS/CBS conforme LC 214/2025
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-zinc-500">Descrição do produto / serviço *</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                placeholder="Ex: Arroz polido tipo 1, pacote 5kg"
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500">NCM</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                placeholder="Ex: 10063021"
                value={ncm}
                onChange={(e) => setNcm(e.target.value)}
                maxLength={10}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500">CFOP</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                placeholder="Ex: 5102"
                value={cfop}
                onChange={(e) => setCfop(e.target.value)}
                maxLength={5}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500">Tipo de operação *</label>
              <select
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                value={tipoOperacao}
                onChange={(e) => setTipoOperacao(e.target.value)}
              >
                <option value="">Selecione...</option>
                {TIPOS_OPERACAO.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500">Regime tributário</label>
              <select
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                value={regime}
                onChange={(e) => setRegime(e.target.value)}
              >
                <option>Lucro Presumido</option>
                <option>Lucro Real</option>
                <option>Simples Nacional</option>
                <option>MEI</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-zinc-500">CNAE do emitente</label>
              <input
                className="mt-1 w-full rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                placeholder="Ex: 4712-1/00"
                value={cnae}
                onChange={(e) => setCnae(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-zinc-500">Contexto adicional</label>
              <textarea
                className="mt-1 w-full resize-none rounded-xl border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-300"
                rows={2}
                placeholder="Ex: venda para consumidor final PF, produto para alimentação humana."
                value={contexto}
                onChange={(e) => setContexto(e.target.value)}
              />
            </div>
          </div>

          {erro && (
            <p className="mt-3 text-sm text-red-600">{erro}</p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              onClick={classificar}
              disabled={carregando}
              className="rounded-2xl bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:opacity-80 disabled:opacity-40"
            >
              {carregando ? "Classificando..." : "Classificar"}
            </button>
            <button
              onClick={exemplo}
              className="rounded-2xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              Exemplo
            </button>
            <button
              onClick={() => { setDescricao(""); setNcm(""); setCfop(""); setTipoOperacao(""); setContexto(""); setCnae(""); setResultado(null); setErro(null); }}
              className="rounded-2xl border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-600 transition hover:bg-zinc-50"
            >
              Limpar
            </button>
          </div>
        </div>

        {resultado && (
          <div className="mt-6 rounded-3xl bg-white p-8 shadow">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">Resultado</p>
                <p className="mt-1 text-sm text-zinc-600">{descricao}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-medium ${CONFIANCA_STYLES[resultado.confianca] ?? ""}`}>
                Confiança {resultado.confianca}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                { label: "CST IBS/CBS", value: resultado.cst ?? "—" },
                { label: "cClassTrib", value: resultado.cclassTrib ?? "—" },
                { label: "Red. IBS", value: resultado.redIbs === 100 ? "Alíquota zero" : resultado.redIbs > 0 ? `${resultado.redIbs}%` : "Normal" },
                { label: "Onerosa", value: resultado.onerosa ? "Sim" : "Não" },
                { label: "Fundamento", value: resultado.artigoLc214 ?? "—" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-zinc-50 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">{item.label}</p>
                  <p className="mt-1 font-mono text-sm font-semibold text-zinc-900">{item.value}</p>
                </div>
              ))}
            </div>

            {resultado.descCclassTrib && (
              <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
                <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Nome do cClassTrib</p>
                <p className="mt-1 text-sm text-zinc-700">{resultado.descCclassTrib}</p>
              </div>
            )}

            <div className="mt-4 rounded-2xl bg-emerald-50 p-4">
              <p className="text-[10px] font-medium uppercase tracking-wide text-emerald-600">Justificativa técnica</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-700">{resultado.justificativa}</p>
            </div>

            {resultado.ambiguidade && (
              <div className="mt-3 rounded-2xl border-l-4 border-amber-400 bg-amber-50 p-4">
                <p className="text-[10px] font-medium uppercase tracking-wide text-amber-600">Ambiguidade identificada</p>
                <p className="mt-1 text-sm text-zinc-700">{resultado.ambiguidade}</p>
              </div>
            )}

            {resultado.pendencias.length > 0 && (
              <div className="mt-3 rounded-2xl bg-red-50 p-4">
                <p className="text-[10px] font-medium uppercase tracking-wide text-red-600">Pendências — revisão humana</p>
                <ul className="mt-1 list-inside list-disc text-sm text-zinc-700">
                  {resultado.pendencias.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}

            {resultado.logSubagentes.length > 0 && (
              <div className="mt-4 rounded-2xl bg-zinc-50 p-4">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400">Log dos 7 subagentes</p>
                <div className="space-y-1.5">
                  {resultado.logSubagentes.map((log, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs text-zinc-600">
                      <span className={`mt-1 h-2 w-2 flex-shrink-0 rounded-full ${log.status === "ok" ? "bg-emerald-400" : log.status === "alerta" ? "bg-amber-400" : "bg-red-400"}`} />
                      <span><strong>{log.agente}:</strong> {log.nota}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
