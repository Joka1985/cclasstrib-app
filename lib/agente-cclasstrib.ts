/**
 * Agente IA cClassTrib — 7 subagentes
 *
 * Substitui o classificador heurístico simples (classificador.ts) quando o
 * motor de banco (parametrizacao-engine.ts) não fecha automaticamente
 * (statusDecisao === "REVISAR" | "SEM_EVIDENCIA").
 *
 * Também pode ser chamado diretamente via API para classificação avulsa.
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type ConfiancaAgente = "Alta" | "Média" | "Baixa";

export type LogSubagente = {
  agente: string;
  status: "ok" | "alerta" | "erro";
  nota: string;
};

export type ResultadoAgenteIA = {
  /** Classificado com sucesso pelo agente */
  classificado: boolean;
  cst: string | null;
  cclassTrib: string | null;
  descCclassTrib: string | null;
  artigoLc214: string | null;
  redIbs: number;
  redCbs: number;
  onerosa: boolean;
  justificativa: string;
  ambiguidade: string | null;
  confianca: ConfiancaAgente;
  pendencias: string[];
  logSubagentes: LogSubagente[];
  /** ID da BaseOficialClassificacao correspondente, se encontrado no banco */
  baseOficialClassificacaoId: string | null;
};

export type InputAgenteIA = {
  descricao: string;
  ncm: string | null;
  cfop: string | null;
  tipoOperacao: string;
  regime?: string;
  cnae?: string | null;
  contexto?: string | null;
};

// ─── Base resumida (top 80 registros para caber no prompt) ───────────────────

async function carregarBaseResumida(): Promise<string> {
  const bases = await prisma.baseOficialClassificacao.findMany({
    where: {
      versaoNormativa: {
        publicada: true,
        fonteNormativa: { tipoFonte: "CCLASSTRIB_OFICIAL" },
      },
    },
    orderBy: [{ cstIbsCbs: "asc" }, { cclassTrib: "asc" }],
    take: 100,
    select: {
      cstIbsCbs: true,
      cclassTrib: true,
      nomeCclassTrib: true,
      artigoLc214: true,
      pRedIbs: true,
    },
  });

  if (!bases.length) {
    // Fallback estático caso o banco ainda não esteja populado
    return FALLBACK_BASE_RESUMIDA;
  }

  return bases
    .map(
      (b) =>
        `CST${b.cstIbsCbs}|${b.cclassTrib}|${b.nomeCclassTrib ?? ""}|${b.artigoLc214 ?? ""}|red${Number(b.pRedIbs ?? 0)}%`
    )
    .join("\n");
}

// ─── Buscar BaseOficialClassificacao pelo par CST+cClassTrib ─────────────────

async function buscarBaseOficialPorPar(
  cst: string,
  cclassTrib: string
): Promise<string | null> {
  const base = await prisma.baseOficialClassificacao.findFirst({
    where: {
      cstIbsCbs: cst,
      cclassTrib,
      versaoNormativa: {
        publicada: true,
        fonteNormativa: { tipoFonte: "CCLASSTRIB_OFICIAL" },
      },
    },
    select: { id: true },
    orderBy: { updatedAt: "desc" },
  });

  return base?.id ?? null;
}

// ─── Prompt do agente ─────────────────────────────────────────────────────────

function buildPrompt(input: InputAgenteIA, baseResumida: string): string {
  return `Você é um agente especialista em reforma tributária brasileira — IBS, CBS e LC 214/2025.

TABELA OFICIAL cClassTrib (publicada pela SEFAZ):
${baseResumida}

OPERAÇÃO A CLASSIFICAR:
- Descrição: ${input.descricao}
- NCM: ${input.ncm ?? "não informado"}
- CFOP: ${input.cfop ?? "não informado"}
- Tipo de operação: ${input.tipoOperacao}
- Regime tributário: ${input.regime ?? "não informado"}
- CNAE do emitente: ${input.cnae ?? "não informado"}
- Contexto adicional: ${input.contexto ?? "nenhum"}

LÓGICA OBRIGATÓRIA — siga na ordem:
1. [Ingestão] Identificar todos os campos disponíveis
2. [Normalização] Normalizar NCM (8 dígitos), CFOP (4 dígitos), descrição
3. [Enquadramento Operacional] Definir onerosidade (art. 4° e 5° LC 214):
   - Onerosa: há pagamento, permuta ou dação
   - Não onerosa: brinde, doação, bonificação, transferência etc.
   - CFOP 5.9xx/6.9xx → provavelmente não onerosa
   - CFOP 7.xxx → exportação (imune)
   - Bonificação na MESMA nota → 410001 (desconto incondicional)
   - Bonificação em nota SEPARADA condicional → tributada normalmente
4. [Jurídico-Tributário] Verificar na tabela acima:
   - Não incidência / imunidade / incidência
   - Cruzar NCM + descrição + CNAE + Anexos I–XV da LC 214
5. [Classificador] Definir CST e cClassTrib exatos da tabela
6. [Revisor] Verificar conflitos e ambiguidades (ex: luva doméstica vs. cirúrgica)
7. [Auditor] Definir confiança e listar pendências para revisão humana

Retorne SOMENTE JSON válido sem markdown nem texto fora do JSON:
{
  "cst": "3 dígitos ex: 000",
  "cclassTrib": "6 dígitos ex: 000001",
  "descCclassTrib": "nome do cClassTrib",
  "artigoLc214": "artigo(s) aplicados",
  "redIbs": número 0-100,
  "redCbs": número 0-100,
  "onerosa": true ou false,
  "justificativa": "raciocínio técnico passo a passo",
  "ambiguidade": "descrição da ambiguidade ou null",
  "confianca": "Alta" ou "Média" ou "Baixa",
  "pendencias": ["array de pontos para revisão humana"],
  "logSubagentes": [
    {"agente": "Ingestão", "status": "ok", "nota": "..."},
    {"agente": "Normalização", "status": "ok", "nota": "..."},
    {"agente": "Enquadramento Operacional", "status": "ok", "nota": "..."},
    {"agente": "Jurídico-Tributário", "status": "ok", "nota": "..."},
    {"agente": "Classificador", "status": "ok", "nota": "..."},
    {"agente": "Revisor", "status": "ok", "nota": "..."},
    {"agente": "Auditor", "status": "ok", "nota": "..."}
  ]
}`;
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function classificarComAgenteIA(
  input: InputAgenteIA
): Promise<ResultadoAgenteIA> {
  const baseResumida = await carregarBaseResumida();
  const prompt = buildPrompt(input, baseResumida);

  let raw: string;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    });

    raw = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .replace(/```json|```/g, "")
      .trim();
  } catch (err) {
    console.error("[AgenteIA] Erro na chamada à API Anthropic:", err);
    return resultadoErro("Erro de comunicação com a API de classificação.");
  }

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error("[AgenteIA] JSON inválido recebido:", raw.slice(0, 200));
    return resultadoErro("Resposta inválida do agente de classificação.");
  }

  const cst = String(parsed.cst ?? "").trim() || null;
  const cclassTrib = String(parsed.cclassTrib ?? "").trim() || null;

  // Buscar o ID da base oficial correspondente
  const baseOficialClassificacaoId =
    cst && cclassTrib ? await buscarBaseOficialPorPar(cst, cclassTrib) : null;

  const confianca = (parsed.confianca as ConfiancaAgente) ?? "Baixa";
  const classificado =
    !!cst && !!cclassTrib && confianca !== "Baixa";

  return {
    classificado,
    cst,
    cclassTrib,
    descCclassTrib: String(parsed.descCclassTrib ?? "") || null,
    artigoLc214: String(parsed.artigoLc214 ?? "") || null,
    redIbs: Number(parsed.redIbs ?? 0),
    redCbs: Number(parsed.redCbs ?? 0),
    onerosa: Boolean(parsed.onerosa ?? true),
    justificativa: String(parsed.justificativa ?? ""),
    ambiguidade:
      parsed.ambiguidade && parsed.ambiguidade !== "null"
        ? String(parsed.ambiguidade)
        : null,
    confianca,
    pendencias: Array.isArray(parsed.pendencias)
      ? (parsed.pendencias as string[])
      : [],
    logSubagentes: Array.isArray(parsed.logSubagentes)
      ? (parsed.logSubagentes as LogSubagente[])
      : [],
    baseOficialClassificacaoId,
  };
}

// ─── Classificação em lote via agente IA ─────────────────────────────────────

export type ItemLoteAgente = InputAgenteIA & {
  itemPlanilhaId?: string;
};

export type ResultadoLoteAgente = ResultadoAgenteIA & {
  itemPlanilhaId?: string;
};

export async function classificarLoteComAgenteIA(
  itens: ItemLoteAgente[]
): Promise<ResultadoLoteAgente[]> {
  // Processa em paralelo com limite de 5 simultâneos
  const resultados: ResultadoLoteAgente[] = [];

  const CONCORRENCIA = 5;
  for (let i = 0; i < itens.length; i += CONCORRENCIA) {
    const batch = itens.slice(i, i + CONCORRENCIA);
    const resultadosBatch = await Promise.all(
      batch.map(async (item) => {
        const resultado = await classificarComAgenteIA(item);
        return { ...resultado, itemPlanilhaId: item.itemPlanilhaId };
      })
    );
    resultados.push(...resultadosBatch);
  }

  return resultados;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resultadoErro(mensagem: string): ResultadoAgenteIA {
  return {
    classificado: false,
    cst: null,
    cclassTrib: null,
    descCclassTrib: null,
    artigoLc214: null,
    redIbs: 0,
    redCbs: 0,
    onerosa: true,
    justificativa: mensagem,
    ambiguidade: null,
    confianca: "Baixa",
    pendencias: ["Erro interno — revisão humana obrigatória."],
    logSubagentes: [],
    baseOficialClassificacaoId: null,
  };
}

// ─── Fallback estático (caso banco não esteja populado) ──────────────────────

const FALLBACK_BASE_RESUMIDA = `CST000|000001|Tributações integralmente pelo IBS e CBS||red0%
CST200|200003|Alimentação humana - Cesta Básica (Anexo I)|Art. 125|red100%
CST200|200009|Medicamentos (Anexo XIV)|Art. 146|red100%
CST200|200013|Absorventes e tampões higiênicos|Art. 147|red100%
CST200|200014|Hortícolas, frutas e ovos - Anexo XV|Art. 148|red100%
CST200|200028|Serviços de educação (Anexo II)|Art. 129|red60%
CST200|200029|Serviços de saúde humana (Anexo III)|Art. 130|red60%
CST200|200032|Medicamentos Anvisa / farmácia manipulação|Art. 133|red60%
CST200|200034|Alimentos consumo humano (Anexo VII)|Art. 135|red60%
CST200|200035|Higiene pessoal e limpeza (Anexo VIII)|Art. 136|red60%
CST200|200036|Produtos agropecuários in natura|Art. 137|red60%
CST200|200038|Insumos agropecuários e aquícolas (Anexo IX)|Art. 138|red60%
CST200|200047|Bares e Restaurantes|Art. 275|red40%
CST200|200048|Hotelaria e Parques de Diversão|Art. 281|red40%
CST200|200049|Transporte coletivo intermunicipal|Art. 286|red40%
CST200|200051|Agências de Turismo|Art. 289, II|red40%
CST200|200052|Profissões intelectuais (contadores, advogados, médicos)|Art. 127|red30%
CST200|200046|Operações com bens imóveis (compra e venda)|Art. 261|red50%
CST200|200027|Locação de bens imóveis|Art. 261, par. único|red70%
CST410|410001|Bonificação na mesma NF (desconto incondicional)|Art. 5°, §1°, I|red0%
CST410|410002|Transferência entre estabelecimentos do mesmo contribuinte|Art. 6°, II|red0%
CST410|410003|Doação sem contraprestação|Art. 6°, VIII|red0%
CST410|410004|Exportação de bens e serviços|Art. 8°|red0%
CST410|410005|Fornecimento por ente público|Art. 9°, I|red0%
CST410|410008|Livros, jornais, periódicos|Art. 9°, IV|red0%
CST410|410014|Produtor rural não contribuinte|Art. 164|red0%
CST410|410027|Exportação de serviço ou bem imaterial|Art. 80 II|red0%
CST410|410999|Operações não onerosas não especificadas|Art. 4°, §1°|red0%
CST620|620001|Tributação monofásica sobre combustíveis|Art. 172|red0%
CST620|620006|Monofásica combustíveis cobrada anteriormente|Art. 180|red0%`;
