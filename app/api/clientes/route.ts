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

    return NextResponse.json({ ok: true, cliente }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: "Erro ao criar cliente" },
      { status: 500 }
    );
  }
}