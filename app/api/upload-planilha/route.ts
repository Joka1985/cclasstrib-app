import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

type LinhaBruta = Record<string, unknown>;

function normalizarCabecalho(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function obterCampo(linha: LinhaBruta, nomesPossiveis: string[]) {
  const mapaNormalizado: Record<string, unknown> = {};

  for (const chave of Object.keys(linha)) {
    mapaNormalizado[normalizarCabecalho(chave)] = linha[chave];
  }

  for (const nome of nomesPossiveis) {
    const valor = mapaNormalizado[normalizarCabecalho(nome)];
    if (valor !== undefined) {
      return String(valor ?? "").trim();
    }
  }

  return "";
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
        { ok: false, error: "Arquivo é obrigatório" },
        { status: 400 }
      );
    }

    const loteExiste = await prisma.lote.findUnique({
      where: { id: loteId },
    });

    if (!loteExiste) {
      return NextResponse.json(
        { ok: false, error: "Lote não encontrado" },
        { status: 404 }
      );
    }

    const bytes = await arquivo.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, { type: "buffer" });

    const nomeAba =
      workbook.SheetNames.find(
        (nome) => nome.trim().toUpperCase() === "PRODUTOS_SERVICOS"
      ) || workbook.SheetNames[0];

    const worksheet = workbook.Sheets[nomeAba];

    const linhas = XLSX.utils.sheet_to_json<LinhaBruta>(worksheet, {
      defval: "",
    });

    let quantidadeLinhasPlanilha = 0;
    let quantidadeLinhasValidas = 0;
    let quantidadeLinhasInvalidas = 0;

    const itensParaSalvar: Array<{
      linhaOrigem: number;
      codigoItemOuServico: string;
      descricaoItemOuServico: string;
      ncm: string | null;
      nbs: string | null;
      linhaValida: boolean;
      motivoInvalidade: string | null;
    }> = [];

    let indiceLinha = 1;

    for (const linha of linhas) {
      indiceLinha++;

      const codigo = obterCampo(linha, [
        "codigo_item_ou_servico",
        "cod_produto_ou_servico",
        "codigo_item",
        "codigo",
      ]);

      const descricao = obterCampo(linha, [
        "descricao_item_ou_servico",
        "descricao",
        "descricao_item",
      ]);

      const ncm = obterCampo(linha, ["ncm"]);
      const nbs = obterCampo(linha, ["nbs"]);

      const linhaVazia = !codigo && !descricao && !ncm && !nbs;
      if (linhaVazia) continue;

      quantidadeLinhasPlanilha++;

      let motivoInvalidade: string | null = null;

      if (!codigo) {
        motivoInvalidade = "Código não informado";
      } else if (!descricao) {
        motivoInvalidade = "Descrição não informada";
      } else if (!ncm && !nbs) {
        motivoInvalidade = "NCM ou NBS não informado";
      }

      const linhaValida = motivoInvalidade === null;

      if (linhaValida) {
        quantidadeLinhasValidas++;
      } else {
        quantidadeLinhasInvalidas++;
      }

      itensParaSalvar.push({
        linhaOrigem: indiceLinha,
        codigoItemOuServico: codigo,
        descricaoItemOuServico: descricao,
        ncm: ncm || null,
        nbs: nbs || null,
        linhaValida,
        motivoInvalidade,
      });
    }

    await prisma.itemPlanilha.deleteMany({
      where: { loteId },
    });

    if (itensParaSalvar.length > 0) {
      await prisma.itemPlanilha.createMany({
        data: itensParaSalvar.map((item) => ({
          loteId,
          linhaOrigem: item.linhaOrigem,
          codigoItemOuServico: item.codigoItemOuServico,
          descricaoItemOuServico: item.descricaoItemOuServico,
          ncm: item.ncm,
          nbs: item.nbs,
          linhaValida: item.linhaValida,
          motivoInvalidade: item.motivoInvalidade,
        })),
      });
    }

    const loteAtualizado = await prisma.lote.update({
      where: { id: loteId },
      data: {
        quantidadeLinhasPlanilha,
        quantidadeLinhasValidas,
        quantidadeLinhasInvalidas,
      },
    });

    return NextResponse.json({
      ok: true,
      mensagem: "Planilha processada com sucesso.",
      nomeArquivo: arquivo.name,
      abaLida: nomeAba,
      lote: loteAtualizado,
      totalItensSalvos: itensParaSalvar.length,
    });
  } catch (error) {
    console.error("Erro no upload da planilha:", error);

    return NextResponse.json(
      { ok: false, error: "Erro ao processar planilha" },
      { status: 500 }
    );
  }
}