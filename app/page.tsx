import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-16">
      <div className="mx-auto max-w-5xl">
        <div className="rounded-3xl bg-white p-10 shadow">
          <div className="max-w-3xl">
            <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
              cClassTrib
            </p>

            <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900">
              Triagem e conferência fiscal de planilhas e documentos XML
            </h1>

            <p className="mt-4 text-lg leading-8 text-zinc-600">
              Envie sua planilha e seus documentos fiscais para validação inicial,
              conferência de itens e preparação do processamento tributário.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="/cadastro"
                className="rounded-2xl bg-black px-6 py-3 font-medium text-white transition hover:opacity-90"
              >
                Iniciar cadastro
              </Link>

              <Link
                href="/upload-planilha"
                className="rounded-2xl border border-zinc-300 px-6 py-3 font-medium text-zinc-700 transition hover:bg-zinc-100"
              >
                Continuar envio
              </Link>
            </div>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 p-5">
              <h2 className="text-base font-semibold text-zinc-900">
                1. Cadastro
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                O cliente informa os dados básicos e o sistema cria automaticamente
                o lote de processamento.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-5">
              <h2 className="text-base font-semibold text-zinc-900">
                2. Upload de documentos
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                A planilha e os XMLs são enviados para leitura, triagem e
                conferência inicial.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 p-5">
              <h2 className="text-base font-semibold text-zinc-900">
                3. Conferência
              </h2>
              <p className="mt-2 text-sm text-zinc-600">
                O sistema compara itens, aponta divergências e prepara a base para
                orçamento e processamento.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}