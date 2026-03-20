import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const cliente = await prisma.cliente.create({
      data: {
        tipoPessoa: body.tipoPessoa,
        nomeRazaoSocial: body.nomeRazaoSocial,
        cpfCnpj: body.cpfCnpj,
        atividadePrincipal: body.atividadePrincipal,
        email: body.email,
        telefone: body.telefone ?? null,
        uf: body.uf ?? null,
      },
    });

    const lote = await prisma.lote.create({
      data: {
        clienteId: cliente.id,
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
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Erro ao criar cliente e lote" },
      { status: 500 }
    );
  }
}