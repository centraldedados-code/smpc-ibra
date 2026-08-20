/**
 * alerts.js
 * Motor de alertas baseado em regras. Todo alerta gerado explica sua causa
 * (nunca um alerta genérico sem motivo). Nenhuma regra financeira.
 */
import { JANELAS_ALERTA, DIAS_SEM_ATUALIZACAO_ALERTA } from "./config.js";

function diasEntre(dataA, dataB) {
  return Math.round((dataB.getTime() - new Date(dataA).getTime()) / 86400000);
}

export function gerarAlertas(ctx) {
  const alertas = [];
  const hoje = ctx.hoje;

  // Obrigações
  ctx.obrigacoes.forEach(o => {
    if (o.status === "Cumprida" || !o.prazo) return;
    const dias = diasEntre(o.prazo, hoje);
    const tituloVencida = o.comprovacaoPendente
      ? `PRAZO VENCIDO — CUMPRIMENTO NÃO COMPROVADO (há ${dias} dia(s))`
      : `Obrigação vencida há ${dias} dia(s)`;
    if (dias > 0) {
      alertas.push({
        nivel: "CRÍTICO",
        origem: "Obrigação",
        projetoId: o.projetoId,
        titulo: tituloVencida,
        detalhe: `"${o.obrigacao}" — prazo era ${o.prazo}. ${o.comprovacaoPendente ? "Não há, nesta base, protocolo ou comprovante registrado — isto não afirma descumprimento, apenas ausência de comprovação." : ""}`,
        referenciaId: o.id
      });
    } else if (-dias <= JANELAS_ALERTA.proximos7) {
      alertas.push({ nivel: "ATENÇÃO", origem: "Obrigação", projetoId: o.projetoId, titulo: `Obrigação vence em ${-dias} dia(s)`, detalhe: `"${o.obrigacao}" — prazo ${o.prazo}.`, referenciaId: o.id });
    } else if (-dias <= JANELAS_ALERTA.proximos15) {
      alertas.push({ nivel: "ATENÇÃO", origem: "Obrigação", projetoId: o.projetoId, titulo: `Obrigação vence em ${-dias} dia(s)`, detalhe: `"${o.obrigacao}" — prazo ${o.prazo}.`, referenciaId: o.id });
    } else if (-dias <= JANELAS_ALERTA.proximos30) {
      alertas.push({ nivel: "INFORMAÇÃO", origem: "Obrigação", projetoId: o.projetoId, titulo: `Obrigação vence em ${-dias} dia(s)`, detalhe: `"${o.obrigacao}" — prazo ${o.prazo}.`, referenciaId: o.id });
    }
  });

  // Diligências
  ctx.diligencias.forEach(d => {
    if (d.status === "Encerrada" || !d.prazo) return;
    const dias = diasEntre(d.prazo, hoje);
    if (dias > 0) {
      alertas.push({
        nivel: "CRÍTICO",
        origem: "Diligência",
        projetoId: d.projetoId,
        titulo: `Diligência vencida há ${dias} dia(s)`,
        detalhe: `Ofício/diligência ${d.numero || d.id} — item questionado: "${d.itemQuestionado}".`,
        referenciaId: d.id
      });
    }
  });

  // Evidências aguardando validação
  const porProjetoPendente = {};
  ctx.evidencias.forEach(e => {
    if (e.status === "Recebida" || e.status === "Em análise") {
      porProjetoPendente[e.projetoId] = (porProjetoPendente[e.projetoId] || 0) + 1;
    }
  });
  Object.entries(porProjetoPendente).forEach(([projetoId, qtd]) => {
    alertas.push({ nivel: "RISCO DOCUMENTAL", origem: "Evidência", projetoId, titulo: `${qtd} evidência(s) aguardam validação`, detalhe: "Existência do documento não implica validação — verificar na Matriz de Evidências.", referenciaId: null });
  });

  // Projeto sem atualização recente
  ctx.projetos.forEach(p => {
    if (!p.ultimaAtualizacao) {
      alertas.push({ nivel: "INFORMAÇÃO INCOMPLETA", origem: "Projeto", projetoId: p.id, titulo: "Data de última atualização não cadastrada", detalhe: "Não é possível avaliar recência de atualização.", referenciaId: null });
      return;
    }
    const dias = diasEntre(p.ultimaAtualizacao, hoje);
    if (dias >= DIAS_SEM_ATUALIZACAO_ALERTA) {
      alertas.push({ nivel: "ATENÇÃO", origem: "Projeto", projetoId: p.id, titulo: `Projeto sem atualização há ${dias} dias`, detalhe: `Limite parametrizado: ${DIAS_SEM_ATUALIZACAO_ALERTA} dias.`, referenciaId: null });
    }
  });

  // Responsável não cadastrado
  ctx.projetos.forEach(p => {
    if (!p.responsavelInterno) {
      alertas.push({ nivel: "INFORMAÇÃO INCOMPLETA", origem: "Projeto", projetoId: p.id, titulo: "Responsável interno não cadastrado", detalhe: "Nenhum responsável foi vinculado a este projeto.", referenciaId: null });
    }
  });

  return alertas;
}

export function contarPorNivel(alertas) {
  return alertas.reduce((acc, a) => {
    acc[a.nivel] = (acc[a.nivel] || 0) + 1;
    return acc;
  }, {});
}
