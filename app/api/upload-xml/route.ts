import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { XMLParser } from "fast-xml-parser";

function limparDocumento(valor?: string) {
  return String(valor ?? "").replace(/\D/g, "");
}

function primeiroValor<T>(valor: T | T[] | undefined): T | undefined {
  if (Array.isArray(valor)) return valor[0];
  return valor;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    mensagem: "Rota upload-xml ativa",
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const loteId = formData.get("loteId");
    const arquivo = formData.get("arquivo");

    if (!loteId || typeof loteId !== "string") {
      return NextResponse.json(
        { ok: false, error: "loteId é obrigatório" },
        { status: 400 }
      );
    }

    if (!arquivo || !(arquivo instanceof File)) {
      return NextResponse.json(
        { ok: false, error: "Arquivo XML é obrigatório" },
        { status: 400 }
      );
    }

    const lote = await prisma.lote.findUnique({
      where: { id: loteId },
      include: { cliente: true },
    });

    if (!lote) {
      return NextResponse.json(
        { ok: false, error: "Lote não encontrado" },
        { status: 404 }
      );
    }

    const textoXml = await arquivo.text();

    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: "",
    });

    const xml = parser.parse(textoXml);

    const nfeProc = xml?.nfeProc;
    const nfe = nfeProc?.NFe || xml?.NFe;
    const infNFe = nfe?.infNFe;

    if (!infNFe) {
      return NextResponse.json(
        { ok: false, error: "Estrutura de XML não reconhecida" },
        { status: 400 }
      );
    }

    const emit = primeiroValor(infNFe.emit);
    const dest = primeiroValor(infNFe.dest);
    const ide = primeiroValor(infNFe.ide);

    const emitenteCpfCnpj = limparDocumento(emit?.CNPJ || emit?.CPF);
    const destinatarioCpfCnpj = limparDocumento(dest?.CNPJ || dest?.CPF);
    const documentoCliente = limparDocumento(lote.cliente.cpfCnpj);

    let statusXml: "SAIDA" | "ENTRADA" | "NAO_RELACIONADO" | "INVALIDO" = "INVALIDO";

    if (emitenteCpfCnpj === documentoCliente) {
      statusXml = "SAIDA";
    } else if (destinatarioCpfCnpj === documentoCliente) {
      statusXml = "ENTRADA";
    } else {
      statusXml = "NAO_RELACIONADO";
    }

    const xmlDocumento = await prisma.xmlDocumento.create({
      data: {
        loteId,
        tipoDocumento: "NFE",
        chaveDocumento: infNFe?.Id ? String(infNFe.Id).replace(/^NFe/, "") : null,
        emitenteCpfCnpj,
        emitenteNome: emit?.xNome ?? null,
        destinatarioCpfCnpj: destinatarioCpfCnpj || null,
        destinatarioNome: dest?.xNome ?? null,
        dataEmissao: ide?.dhEmi ? new Date(ide.dhEmi) : null,
        statusXml,
      },
    });

    return NextResponse.json({
      ok: true,
      mensagem: "XML recebido com sucesso.",
      xmlDocumento,
    });
  } catch (error) {
    console.error("Erro no upload do XML:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao processar XML" },
      { status: 500 }
    );
  }
}