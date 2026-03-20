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

function paraArray<T>(valor: T | T[] | undefined): T[] {
  if (!valor) return [];
  return Array.isArray(valor) ? valor : [valor];
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
      removeNSPrefix: true,
    });

    const xml = parser.parse(textoXml);

    // Suporta NF-e/NFC-e
    const nfeProc = xml?.nfeProc || xml?.procNFe;
    const nfe = nfeProc?.NFe || xml?.NFe;
    const infNFe = nfe?.infNFe;

    // Suporta CF-e SAT (modelo 59)
    const cfe = xml?.CFe;
    const infCFe = cfe?.infCFe;

    const documentoFiscal = infNFe || infCFe;

    if (!documentoFiscal) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Estrutura de XML não reconhecida. Envie NF-e/NFC-e (NFe/infNFe) ou CF-e SAT (CFe/infCFe).",
        },
        { status: 400 }
      );
    }

    const emit = primeiroValor(documentoFiscal.emit);
    const dest = primeiroValor(documentoFiscal.dest);
    const ide = primeiroValor(documentoFiscal.ide);
    const dets = paraArray(documentoFiscal.det);

    const emitenteCpfCnpj = limparDocumento(emit?.CNPJ || emit?.CPF);
    const destinatarioCpfCnpj = limparDocumento(dest?.CNPJ || dest?.CPF);
    const documentoCliente = limparDocumento(lote.cliente.cpfCnpj);

    let statusXml: "SAIDA" | "ENTRADA" | "NAO_RELACIONADO" | "INVALIDO" =
      "INVALIDO";

    if (emitenteCpfCnpj === documentoCliente) {
      statusXml = "SAIDA";
    } else if (destinatarioCpfCnpj === documentoCliente) {
      statusXml = "ENTRADA";
    } else {
      statusXml = "NAO_RELACIONADO";
    }

    const tipoDocumento =
      infCFe ? "OUTRO" : "NFE";

    const chaveDocumento =
      documentoFiscal?.Id
        ? String(documentoFiscal.Id).replace(/^NFe/, "").replace(/^CFe/, "")
        : null;

    const dataEmissao =
      ide?.dhEmi
        ? new Date(ide.dhEmi)
        : ide?.dEmi
        ? new Date(
            String(ide.dEmi).length === 8
              ? `${String(ide.dEmi).slice(0, 4)}-${String(ide.dEmi).slice(4, 6)}-${String(ide.dEmi).slice(6, 8)}`
              : ide.dEmi
          )
        : null;

    const xmlDocumento = await prisma.xmlDocumento.create({
      data: {
        loteId,
        tipoDocumento,
        chaveDocumento,
        emitenteCpfCnpj,
        emitenteNome: emit?.xNome ?? emit?.xFant ?? null,
        destinatarioCpfCnpj: destinatarioCpfCnpj || null,
        destinatarioNome: dest?.xNome ?? null,
        dataEmissao,
        statusXml,
      },
    });

    const itensXml = dets.map((det: any, index: number) => {
      const prod = primeiroValor(det?.prod);

      const quantidade = prod?.qCom ? Number(prod.qCom) : null;
      const valorUnitario = prod?.vUnCom ? Number(prod.vUnCom) : null;
      const valorTotal = prod?.vProd ? Number(prod.vProd) : null;

      return {
        xmlDocumentoId: xmlDocumento.id,
        numeroItem: Number(det?.nItem ?? index + 1),
        codigoItem: prod?.cProd ? String(prod.cProd) : null,
        descricaoItem: prod?.xProd ? String(prod.xProd) : "",
        ncm: prod?.NCM ? String(prod.NCM) : null,
        cfop: prod?.CFOP ? String(prod.CFOP) : null,
        quantidade,
        valorUnitario,
        valorTotal,
      };
    });

    if (itensXml.length > 0) {
      await prisma.itemXml.createMany({
        data: itensXml,
      });
    }

    return NextResponse.json({
      ok: true,
      mensagem: "XML recebido com sucesso.",
      xmlDocumento,
      totalItensXml: itensXml.length,
    });
  } catch (error) {
    console.error("Erro no upload do XML:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao processar XML" },
      { status: 500 }
    );
  }
}