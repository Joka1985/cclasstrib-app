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

function normalizarTexto(valor?: string | null) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase()
    .trim();
}

function chaveCodigoDescricao(codigo?: string | null, descricao?: string | null) {
  const codigoNormalizado = normalizarTexto(codigo);
  const descricaoNormalizada = normalizarTexto(descricao);

  if (codigoNormalizado) return `COD:${codigoNormalizado}`;
  if (descricaoNormalizada) return `DESC:${descricaoNormalizada}`;
  return "";
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

    const nfeProc = xml?.nfeProc || xml?.procNFe;
    const nfe = nfeProc?.NFe || xml?.NFe;
    const infNFe = nfe?.infNFe;

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

    const tipoDocumento = infCFe ? "OUTRO" : "NFE";

    const chaveDocumento = documentoFiscal?.Id
      ? String(documentoFiscal.Id).replace(/^NFe/, "").replace(/^CFe/, "")
      : null;

    const dataEmissao = ide?.dhEmi
      ? new Date(ide.dhEmi)
      : ide?.dEmi
      ? new Date(
          String(ide.dEmi).length === 8
            ? `${String(ide.dEmi).slice(0, 4)}-${String(ide.dEmi).slice(
                4,
                6
              )}-${String(ide.dEmi).slice(6, 8)}`
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

    const itensXmlParaSalvar = dets.map((det: any, index: number) => {
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

    if (itensXmlParaSalvar.length > 0) {
      await prisma.itemXml.createMany({
        data: itensXmlParaSalvar,
      });
    }

    await prisma.divergenciaXmlPlanilha.deleteMany({
      where: { loteId },
    });

    const itensPlanilha = await prisma.itemPlanilha.findMany({
      where: {
        loteId,
        linhaValida: true,
      },
      orderBy: { linhaOrigem: "asc" },
    });

    const xmlsRelacionados = await prisma.xmlDocumento.findMany({
      where: {
        loteId,
        statusXml: {
          in: ["SAIDA", "ENTRADA"],
        },
      },
      include: {
        itensXml: true,
      },
    });

    const itensXmlRelacionados = xmlsRelacionados.flatMap((doc) => doc.itensXml);

    const divergencias: Array<{
      loteId: string;
      codigoPlanilha?: string | null;
      codigoXml?: string | null;
      descricaoPlanilha?: string | null;
      descricaoXml?: string | null;
      tipoDivergencia: string;
      observacao?: string | null;
    }> = [];

    const mapaXml = new Map<
      string,
      {
        codigoItem: string | null;
        descricaoItem: string;
        ncm: string | null;
        cfop: string | null;
      }[]
    >();

    for (const item of itensXmlRelacionados) {
      const chave = chaveCodigoDescricao(item.codigoItem, item.descricaoItem);
      if (!chave) continue;

      if (!mapaXml.has(chave)) {
        mapaXml.set(chave, []);
      }

      mapaXml.get(chave)!.push({
        codigoItem: item.codigoItem,
        descricaoItem: item.descricaoItem,
        ncm: item.ncm,
        cfop: item.cfop,
      });
    }

    for (const itemPlanilha of itensPlanilha) {
      const chavePrincipal = chaveCodigoDescricao(
        itemPlanilha.codigoItemOuServico,
        itemPlanilha.descricaoItemOuServico
      );

      const chaveDescricao = itemPlanilha.descricaoItemOuServico
        ? `DESC:${normalizarTexto(itemPlanilha.descricaoItemOuServico)}`
        : "";

      const candidatos =
        (chavePrincipal && mapaXml.get(chavePrincipal)) ||
        (chaveDescricao && mapaXml.get(chaveDescricao)) ||
        [];

      if (candidatos.length === 0) {
        divergencias.push({
          loteId,
          codigoPlanilha: itemPlanilha.codigoItemOuServico,
          descricaoPlanilha: itemPlanilha.descricaoItemOuServico,
          tipoDivergencia: "ITEM_PLANILHA_NAO_ENCONTRADO_NO_XML",
          observacao: itemPlanilha.cfopInformadoManual
            ? `Item sem correlação em XML relacionado. CFOP manual informado pelo cliente: ${itemPlanilha.cfopInformadoManual}.`
            : "Item sem correlação em XML relacionado e sem CFOP manual informado.",
        });
        continue;
      }

      const itemXmlRef = candidatos[0];

      const descricaoPlanilhaNormalizada = normalizarTexto(
        itemPlanilha.descricaoItemOuServico
      );
      const descricaoXmlNormalizada = normalizarTexto(itemXmlRef.descricaoItem);

      if (
        descricaoPlanilhaNormalizada &&
        descricaoXmlNormalizada &&
        descricaoPlanilhaNormalizada !== descricaoXmlNormalizada
      ) {
        divergencias.push({
          loteId,
          codigoPlanilha: itemPlanilha.codigoItemOuServico,
          codigoXml: itemXmlRef.codigoItem,
          descricaoPlanilha: itemPlanilha.descricaoItemOuServico,
          descricaoXml: itemXmlRef.descricaoItem,
          tipoDivergencia: "DESCRICAO_DIVERGENTE",
          observacao: "Descrição da planilha difere da descrição encontrada no XML.",
        });
      }

      if (
        itemPlanilha.ncm &&
        itemXmlRef.ncm &&
        normalizarTexto(itemPlanilha.ncm) !== normalizarTexto(itemXmlRef.ncm)
      ) {
        divergencias.push({
          loteId,
          codigoPlanilha: itemPlanilha.codigoItemOuServico,
          codigoXml: itemXmlRef.codigoItem,
          descricaoPlanilha: itemPlanilha.descricaoItemOuServico,
          descricaoXml: itemXmlRef.descricaoItem,
          tipoDivergencia: "NCM_DIVERGENTE",
          observacao: `NCM planilha: ${itemPlanilha.ncm}. NCM XML: ${itemXmlRef.ncm}.`,
        });
      }
    }

    for (const itemXml of itensXmlRelacionados) {
      const chaveXml = chaveCodigoDescricao(itemXml.codigoItem, itemXml.descricaoItem);
      const chaveDescricaoXml = itemXml.descricaoItem
        ? `DESC:${normalizarTexto(itemXml.descricaoItem)}`
        : "";

      const apareceuNaPlanilha = itensPlanilha.some((itemPlanilha) => {
        const chavePlanilha = chaveCodigoDescricao(
          itemPlanilha.codigoItemOuServico,
          itemPlanilha.descricaoItemOuServico
        );
        const chaveDescricaoPlanilha = itemPlanilha.descricaoItemOuServico
          ? `DESC:${normalizarTexto(itemPlanilha.descricaoItemOuServico)}`
          : "";

        return (
          (!!chaveXml && chavePlanilha === chaveXml) ||
          (!!chaveDescricaoXml && chaveDescricaoPlanilha === chaveDescricaoXml)
        );
      });

      if (!apareceuNaPlanilha) {
        divergencias.push({
          loteId,
          codigoXml: itemXml.codigoItem,
          descricaoXml: itemXml.descricaoItem,
          tipoDivergencia: "ITEM_XML_NAO_ENCONTRADO_NA_PLANILHA",
          observacao: itemXml.cfop
            ? `Item existente no XML com CFOP ${itemXml.cfop}, mas ausente na planilha.`
            : "Item existente no XML, mas ausente na planilha.",
        });
      }
    }

    if (divergencias.length > 0) {
      await prisma.divergenciaXmlPlanilha.createMany({
        data: divergencias,
      });
    }

    return NextResponse.json({
      ok: true,
      mensagem: "XML recebido com sucesso.",
      xmlDocumento,
      totalItensXml: itensXmlParaSalvar.length,
      totalDivergencias: divergencias.length,
    });
  } catch (error) {
    console.error("Erro no upload do XML:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao processar XML" },
      { status: 500 }
    );
  }
}