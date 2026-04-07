/**
 * POST /api/admin/seed-regras
 * 
 * Popula RegraAnexoContextual e BaseOficialClassificacao faltantes.
 * Protegido por ADMIN_SECRET no header Authorization.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.ADMIN_SECRET ?? "cclasstrib-admin"}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const versao = await prisma.versaoNormativa.findFirst({
      where: { publicada: true, fonteNormativa: { tipoFonte: "CCLASSTRIB_OFICIAL" } },
      orderBy: { updatedAt: "desc" },
    });

    if (!versao) {
      return NextResponse.json({ error: "Nenhuma versão normativa publicada." }, { status: 400 });
    }

    const opVenda = await prisma.operacaoFiscal.findFirst({
      where: { codigo: "VENDA_NORMAL", ativa: true },
    });

    if (!opVenda) {
      return NextResponse.json({ error: "Operação VENDA_NORMAL não encontrada." }, { status: 400 });
    }

    // Bases faltantes
    const basesFaltantes = [
      { cst: "200", cc: "200034", nome: "Fornecimento dos alimentos destinados ao consumo humano (Anexo VII)", art: "Art. 135", red: 60, anexo: "7", desc: "Alimentos destinados ao consumo humano — Anexo VII da LC 214/2025." },
      { cst: "200", cc: "200035", nome: "Fornecimento dos produtos de higiene pessoal e limpeza (Anexo VIII)", art: "Art. 136", red: 60, anexo: "8", desc: "Produtos de higiene pessoal e limpeza — Anexo VIII da LC 214/2025." },
      { cst: "200", cc: "200036", nome: "Fornecimento de produtos agropecuários in natura", art: "Art. 137", red: 60, anexo: null, desc: "Produtos agropecuários, aquícolas, pesqueiros, florestais e extrativistas vegetais in natura." },
      { cst: "200", cc: "200014", nome: "Fornecimento dos produtos hortícolas, frutas e ovos (Anexo XV)", art: "Art. 148", red: 100, anexo: "15", desc: "Hortícolas, frutas e ovos — Anexo XV da LC 214/2025." },
      { cst: "200", cc: "200013", nome: "Fornecimento de tampões higiênicos e absorventes", art: "Art. 147", red: 100, anexo: null, desc: "Absorventes higiênicos internos ou externos e coletores menstruais." },
      { cst: "200", cc: "200032", nome: "Medicamentos registrados na Anvisa ou farmácias de manipulação", art: "Art. 133", red: 60, anexo: null, desc: "Medicamentos registrados na Anvisa ou produzidos por farmácias de manipulação." },
    ];

    const basesCriadas: string[] = [];
    for (const b of basesFaltantes) {
      const existe = await prisma.baseOficialClassificacao.findFirst({
        where: { versaoNormativaId: versao.id, cstIbsCbs: b.cst, cclassTrib: b.cc },
      });
      if (!existe) {
        await prisma.baseOficialClassificacao.create({
          data: {
            versaoNormativaId: versao.id,
            cstIbsCbs: b.cst,
            descricaoCst: "Alíquota reduzida",
            cclassTrib: b.cc,
            nomeCclassTrib: b.nome,
            descricaoCclassTrib: b.desc,
            artigoLc214: b.art,
            anexo: b.anexo,
            tipoAliquota: "Padrão",
            pRedIbs: b.red,
            pRedCbs: b.red,
            indNFe: true,
            indNFCe: true,
          },
        });
        basesCriadas.push(b.cc);
      }
    }

    async function getBaseId(cc: string) {
      const b = await prisma.baseOficialClassificacao.findFirst({
        where: { versaoNormativaId: versao!.id, cclassTrib: cc },
        select: { id: true },
      });
      return b?.id ?? null;
    }

    // Regras de anexo contextual
    const regras = [
      { cod: "RAC-0401-LATICINIOS", nome: "Laticínios — Anexo VII", ini: "04010000", fim: "04069999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-0201-CARNES", nome: "Carnes — Anexo VII", ini: "02010000", fim: "02109999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-0301-PEIXES", nome: "Peixes — Anexo VII", ini: "03010000", fim: "03079999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-1006-ARROZ", nome: "Arroz — Anexo VII", ini: "10060000", fim: "10069999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-1507-OLEOS", nome: "Óleos vegetais — Anexo VII", ini: "15070000", fim: "15159999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-1701-ACUCAR", nome: "Açúcar — Anexo VII", ini: "17010000", fim: "17019999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-1901-MASSAS", nome: "Massas e pães — Anexo VII", ini: "19010000", fim: "19059999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-0901-CAFE", nome: "Café — Anexo VII", ini: "09010000", fim: "09019999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-0902-CHA", nome: "Chá e erva-mate — Anexo VII", ini: "09020000", fim: "09039999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-0904-TEMPEROS", nome: "Especiarias e temperos — Anexo VII", ini: "09040000", fim: "09109999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-2001-CONSERVAS", nome: "Conservas alimentares — Anexo VII", ini: "20010000", fim: "20099999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-2101-MOLHOS", nome: "Extratos e molhos — Anexo VII", ini: "21010000", fim: "21039999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-2201-AGUA", nome: "Água mineral — Anexo VII", ini: "22010000", fim: "22019999", cc: "200034", art: "Art. 135", pri: 10 },
      { cod: "RAC-4818-PAPEL-HIG", nome: "Papel higiênico — Anexo VIII", ini: "48180000", fim: "48189999", cc: "200035", art: "Art. 136", pri: 10 },
      { cod: "RAC-3401-SABAO", nome: "Sabão e detergente — Anexo VIII", ini: "34010000", fim: "34029999", cc: "200035", art: "Art. 136", pri: 10 },
      { cod: "RAC-3808-DESINFET", nome: "Desinfetantes e sanitários — Anexo VIII", ini: "38080000", fim: "38089999", cc: "200035", art: "Art. 136", pri: 10 },
      { cod: "RAC-9619-ABSORV", nome: "Absorventes higiênicos — Art. 147", ini: "96190000", fim: "96199999", cc: "200013", art: "Art. 147", pri: 5 },
      { cod: "RAC-0701-HORTALICAS", nome: "Hortaliças — Anexo XV", ini: "07010000", fim: "07149999", cc: "200014", art: "Art. 148", pri: 5 },
      { cod: "RAC-0801-FRUTAS", nome: "Frutas — Anexo XV", ini: "08010000", fim: "08149999", cc: "200014", art: "Art. 148", pri: 5 },
    ];

    const regrasCriadas: string[] = [];
    for (const r of regras) {
      const baseId = await getBaseId(r.cc);
      if (!baseId) continue;
      const existe = await prisma.regraAnexoContextual.findFirst({ where: { anexo: r.cod } });
      if (!existe) {
        const redVal = r.cc === "200014" || r.cc === "200013" ? 100 : 60;
        await prisma.regraAnexoContextual.create({
          data: {
            anexo: r.cod,
            descricaoAnexo: r.nome,
            operacaoFiscalId: opVenda.id,
            exigeNcm: true,
            ncmInicio: r.ini,
            ncmFim: r.fim,
            cst: "200",
            cClassTrib: r.cc,
            tipoAliquota: "REDUZIDA",
            pRedIbs: redVal,
            pRedCbs: redVal,
            fundamentoLegal: r.art,
            artigoLc214: r.art,
            baseOficialClassificacaoId: baseId,
            prioridade: r.pri,
            ativa: true,
          },
        });
        regrasCriadas.push(r.cod);
      }
    }

    return NextResponse.json({
      ok: true,
      basesCriadas,
      regrasCriadas,
      mensagem: `${basesCriadas.length} bases e ${regrasCriadas.length} regras criadas com sucesso.`,
    });
  } catch (err) {
    console.error("[seed-regras]", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Erro interno." },
      { status: 500 }
    );
  }
}