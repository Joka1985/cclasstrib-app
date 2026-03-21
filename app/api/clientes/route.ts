import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function gerarProtocolo() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  const aleatorio = Math.floor(1000 + Math.random() * 9000);

  return `ENV-${ano}${mes}${dia}-${aleatorio}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body.cnaeCodigo || !body.cnaeDescricao) {
      return NextResponse.json(
        { ok: false, error: "Selecione um CNAE válido na lista." },
        { status: 400 }
      );
    }

    const cliente = await prisma.cliente.create({
      data: {
        tipoPessoa: body.tipoPessoa,
        nomeRazaoSocial: body.nomeRazaoSocial,
        cpfCnpj: body.cpfCnpj,
        atividadePrincipal: `${body.cnaeCodigo} - ${body.cnaeDescricao}`,
        email: body.email,
        telefone: body.telefone ?? null,
        uf: body.uf ?? null,
      },
    });

    const lote = await prisma.lote.create({
      data: {
        clienteId: cliente.id,
        protocolo: gerarProtocolo(),
        statusLote: "DOCUMENTACAO_PENDENTE",
        quantidadeLinhasPlanilha: 0,
        quantidadeLinhasValidas: 0,
        quantidadeLinhasInvalidas: 0,
        valorUnitario: 0,
        valorTotal: 0,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        cliente,
        lote,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Erro ao criar cliente e lote:", error);

    if (error?.code === "P2002") {
      return NextResponse.json(
        { ok: false, error: "Já existe cliente cadastrado com este CPF/CNPJ." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error: error?.message || "Erro ao criar cliente e lote",
      },
      { status: 500 }
    );
  }
}