/**
 * scoring.js
 * Calcula score de conformidade, execução física ponderada e classificação
 * de risco. NUNCA retorna um número quando não há dado suficiente — nesse
 * caso retorna status "insuficiente" com o motivo, e a interface deve
 * exibir isso literalmente, não um score fictício.
 */
import { PESOS_SCORE, FAIXAS_RISCO, REGRAS_CRITICIDADE } from "./config.js";

/**
 * Execução física ponderada: se as metas do projeto tiverem peso definido,
 * usa média ponderada; senão, se houver metas mas sem peso, usa média
 * simples (deixando isso explícito no retorno); se não houver metas
 * cadastradas, retorna insuficiente.
 */
export function calcularExecucaoFisica(projetoId, execucaoFisica) {
  const metas = execucaoFisica.filter(e => e.projetoId === projetoId);
  if (metas.length === 0) {
    return { status: "insuficiente", motivo: "Nenhuma meta de execução física cadastrada para este projeto." };
  }
  const comPercentual = metas.filter(m => m.quantidadePrevista > 0 && m.quantidadeRealizada != null);
  if (comPercentual.length === 0) {
    return { status: "insuficiente", motivo: "Metas cadastradas, mas sem quantidade realizada informada." };
  }
  const temPeso = comPercentual.every(m => typeof m.peso === "number" && m.peso > 0);
  let percentual;
  let metodo;
  if (temPeso) {
    const somaPesos = comPercentual.reduce((s, m) => s + m.peso, 0);
    percentual = comPercentual.reduce((s, m) => s + (m.quantidadeRealizada / m.quantidadePrevista) * m.peso, 0) / somaPesos;
    metodo = "média ponderada por peso das metas";
  } else {
    percentual = comPercentual.reduce((s, m) => s + m.quantidadeRealizada / m.quantidadePrevista, 0) / comPercentual.length;
    metodo = "média simples (pesos não cadastrados para todas as metas)";
  }
  return { status: "ok", percentual: Math.min(percentual * 100, 100), metodo, metasConsideradas: comPercentual.length, metasTotal: metas.length };
}

/**
 * Cobertura de conformidade documental / evidências: proporção de
 * evidências "Validada" ou "Validada com ressalva" sobre o total NECESSÁRIO
 * cadastrado. Só conta registros com `status` canônico preenchido — registros
 * derivados automaticamente do Monitoramento têm status=null por desenho
 * (ver derive.js: atraso é informação temporal, não uma constatação de
 * recebimento/validação), então NÃO entram nesta conta. Isso evita fabricar
 * um percentual de cobertura que a fonte nunca afirmou.
 */
function calcularCoberturaEvidencias(projetoId, evidencias) {
  const registros = evidencias.filter(e => e.projetoId === projetoId && e.status !== null && e.status !== undefined);
  if (registros.length === 0) {
    return { status: "insuficiente", motivo: "Nenhuma evidência com status confirmado (validado por humano) cadastrada para este projeto. Registros só com status temporal (atrasada/em conformidade) não contam como constatação de cobertura." };
  }
  const validadas = registros.filter(e => e.status === "Validada" || e.status === "Validada com ressalva").length;
  return { status: "ok", percentual: (validadas / registros.length) * 100, validadas, total: registros.length };
}

/**
 * Prazos/obrigações: percentual de obrigações cumpridas dentro do prazo,
 * penalizando vencidas.
 */
function calcularPrazosObrigacoes(projetoId, obrigacoes, hoje) {
  const registros = obrigacoes.filter(o => o.projetoId === projetoId);
  if (registros.length === 0) {
    return { status: "insuficiente", motivo: "Nenhuma obrigação cadastrada para este projeto." };
  }
  const vencidas = registros.filter(o => o.status !== "Cumprida" && o.prazo && new Date(o.prazo) < hoje).length;
  const cumpridas = registros.filter(o => o.status === "Cumprida").length;
  const percentual = Math.max(0, ((cumpridas - vencidas) / registros.length) * 100);
  return { status: "ok", percentual, vencidas, cumpridas, total: registros.length };
}

/**
 * Conformidade documental: aqui, na ausência de um checklist de documentos
 * obrigatórios parametrizado por projeto, retornamos sempre insuficiente
 * de forma explícita — não inventamos exigência documental (item 22).
 */
function calcularConformidadeDocumental(projetoId, checklistDocumentos) {
  const registros = (checklistDocumentos || []).filter(c => c.projetoId === projetoId);
  if (registros.length === 0) {
    return { status: "insuficiente", motivo: "Checklist de documentos obrigatórios não parametrizado para este projeto." };
  }
  const ok = registros.filter(c => c.status === "Regular").length;
  return { status: "ok", percentual: (ok / registros.length) * 100, ok, total: registros.length };
}

/**
 * Calcula o score consolidado de um projeto. Se algum componente estiver
 * "insuficiente", ele não entra no denominador — o score é recalculado
 * apenas sobre os componentes com dado real, e o resultado deixa isso
 * explícito (parcial: true) para nunca passar a falsa impressão de
 * completude.
 */
export function calcularScore(projeto, ctx) {
  const componentes = {
    execucaoFisica: calcularExecucaoFisica(projeto.id, ctx.execucaoFisica),
    conformidadeDocumental: calcularConformidadeDocumental(projeto.id, ctx.checklistDocumentos),
    evidenciasRastreabilidade: calcularCoberturaEvidencias(projeto.id, ctx.evidencias),
    prazosObrigacoes: calcularPrazosObrigacoes(projeto.id, ctx.obrigacoes, ctx.hoje)
  };

  const disponiveis = Object.entries(componentes).filter(([, v]) => v.status === "ok");

  // Override de criticidade tem prioridade absoluta sobre o cálculo numérico.
  const motivosCriticos = REGRAS_CRITICIDADE
    .map(r => ({ id: r.id, motivo: r.avaliar(projeto, ctx) }))
    .filter(r => r.motivo);

  if (motivosCriticos.length > 0) {
    return {
      scoreDisponivel: disponiveis.length > 0,
      score: disponiveis.length > 0 ? somaScorePonderado(disponiveis) : null,
      classificacao: "CRÍTICO",
      corRisco: "critico",
      override: true,
      motivos: motivosCriticos.map(m => m.motivo),
      componentes
    };
  }

  if (disponiveis.length === 0) {
    return {
      scoreDisponivel: false,
      score: null,
      classificacao: "Não avaliado",
      corRisco: null,
      override: false,
      motivos: ["Dados insuficientes em todos os componentes do score. Nenhum score foi calculado."],
      componentes
    };
  }

  const score = somaScorePonderado(disponiveis);
  const faixa = FAIXAS_RISCO.find(f => score >= f.min && score <= f.max);
  const parcial = disponiveis.length < 4;

  return {
    scoreDisponivel: true,
    score,
    parcial,
    componentesConsiderados: disponiveis.map(([k]) => k),
    classificacao: faixa ? faixa.classificacao : "Não classificado",
    corRisco: faixa ? faixa.cor : null,
    override: false,
    motivos: parcial
      ? [`Score calculado apenas sobre ${disponiveis.length} de 4 componentes (os demais estão sem dado suficiente).`]
      : ["Score calculado sobre os 4 componentes."],
    componentes
  };
}

function somaScorePonderado(disponiveis) {
  const somaPesos = disponiveis.reduce((s, [k]) => s + PESOS_SCORE[k], 0);
  const somaPonderada = disponiveis.reduce((s, [k, v]) => s + v.percentual * PESOS_SCORE[k], 0);
  return Math.round((somaPonderada / somaPesos) * 10) / 10;
}
