"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type RespostaCriarPreferencia = {
  ok: boolean;
  error?: string;
  initPoint?: string;
  sandboxInitPoint?: string;
  protocolo?: string | null;
  valorTotal?: number | string | null;
  itensCobraveis?: number | null;
  dataOrcamentoExpiraEm?: string | null;
  statusLote?: string | null;
};

function PagamentoConteudo() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<RespostaCriarPreferencia | null>(null);

  const ambienteLabel = useMemo(() => {
    if (process.env.NODE_ENV === "production") return "produção";
    return "teste";
  }, []);

  useEffect(() => {
    let ativo = true;

    async function iniciarCheckout() {
      if (!token) {
        setErro("Token de pagamento não informado.");
        setLoading(false);
        return;
      }

      try {
        const resposta = await fetch("/api/mercado-pago/criar-preferencia", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ token }),
        });

        const json = (await resposta.json()) as RespostaCriarPreferencia;

        if (!ativo) return;

        if (!resposta.ok || !json.ok) {
          setErro(json.error || "Não foi possível iniciar o checkout.");
          setDados(json);
          setLoading(false);
          return;
        }

        setDados(json);

        const destino = json.initPoint || json.sandboxInitPoint;

        if (!destino) {
          setErro("O checkout foi criado, mas o link de pagamento não foi retornado.");
          setLoading(false);
          return;
        }

        window.location.href = destino;
      } catch (error) {
        if (!ativo) return;

        setErro(
          error instanceof Error
            ? error.message
            : "Erro ao iniciar o pagamento."
        );
        setLoading(false);
      }
    }

    iniciarCheckout();

    return () => {
      ativo = false;
    };
  }, [token]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: "24px",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#111827",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ background: "#111827", color: "#ffffff", padding: "24px 28px" }}>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.3 }}>
            Pagamento do orçamento
          </h1>
        </div>

        <div style={{ padding: 28 }}>
          {loading && (
            <>
              <p style={{ marginTop: 0, lineHeight: 1.6 }}>
                Estamos iniciando o checkout do seu orçamento.
              </p>
              <p style={{ lineHeight: 1.6 }}>
                Você será redirecionado automaticamente para o Mercado Pago para
                concluir o pagamento por <strong>Pix</strong> ou <strong>cartão</strong>.
              </p>
              <p style={{ color: "#6b7280", marginBottom: 0 }}>
                Ambiente atual: {ambienteLabel}.
              </p>
            </>
          )}

          {!loading && erro && (
            <>
              <p style={{ marginTop: 0, lineHeight: 1.6, color: "#991b1b" }}>
                <strong>Não foi possível iniciar o pagamento.</strong>
              </p>
              <p style={{ lineHeight: 1.6 }}>{erro}</p>

              {dados?.protocolo ? (
                <p style={{ lineHeight: 1.6 }}>
                  <strong>Protocolo:</strong> {dados.protocolo}
                </p>
              ) : null}

              {dados?.statusLote ? (
                <p style={{ lineHeight: 1.6 }}>
                  <strong>Status:</strong> {dados.statusLote}
                </p>
              ) : null}

              {dados?.valorTotal !== undefined && dados?.valorTotal !== null ? (
                <p style={{ lineHeight: 1.6 }}>
                  <strong>Valor total:</strong>{" "}
                  {new Intl.NumberFormat("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  }).format(Number(dados.valorTotal))}
                </p>
              ) : null}

              {dados?.dataOrcamentoExpiraEm ? (
                <p style={{ lineHeight: 1.6 }}>
                  <strong>Validade:</strong>{" "}
                  {new Date(dados.dataOrcamentoExpiraEm).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function PagamentoFallback() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f3f4f6",
        padding: "24px",
        fontFamily: "Arial, Helvetica, sans-serif",
        color: "#111827",
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: "0 auto",
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: 14,
          overflow: "hidden",
        }}
      >
        <div style={{ background: "#111827", color: "#ffffff", padding: "24px 28px" }}>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.3 }}>
            Pagamento do orçamento
          </h1>
        </div>

        <div style={{ padding: 28 }}>
          <p style={{ margin: 0, lineHeight: 1.6 }}>
            Carregando informações do pagamento...
          </p>
        </div>
      </div>
    </main>
  );
}

export default function PagamentoPage() {
  return (
    <Suspense fallback={<PagamentoFallback />}>
      <PagamentoConteudo />
    </Suspense>
  );
}