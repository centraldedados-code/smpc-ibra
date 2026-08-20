/**
 * reports.js — monta o HTML de cada relatório. A impressão/PDF usa o
 * @media print do style.css; não há geração de PDF binário no cliente
 * nesta versão (evita dependências externas pesadas). "Imprimir" no
 * navegador já produz PDF adequado com o layout de impressão dedicado.
 */
export function relatorioExecutivoPortfolio(projetos, alertas) {
  const criticos = projetos.filter(p => p._score.classificacao === "CRÍTICO");
  return {
    titulo: "Relatório Executivo do Portfólio",
    geradoEm: new Date().toLocaleString("pt-BR"),
    resumo: {
      totalProjetos: projetos.length,
      criticos: criticos.length,
      naoAvaliados: projetos.filter(p => p._score.classificacao === "Não avaliado").length,
      totalAlertas: alertas.length
    },
    linhas: projetos.map(p => ({
      nome: p.nome,
      situacao: p.situacaoAdministrativa || "Não informado",
      classificacao: p._score.classificacao,
      motivo: (p._score.motivos || []).join(" | ")
    }))
  };
}

export function fichaExecutivaProjeto(projeto, alertasDoProjeto) {
  return {
    titulo: `Ficha Executiva — ${projeto.nome}`,
    geradoEm: new Date().toLocaleString("pt-BR"),
    projeto,
    alertas: alertasDoProjeto
  };
}

export function checklistPrestacaoContas(projeto, ctx) {
  const itens = [
    { item: "Obrigações cumpridas", ok: ctx.obrigacoes.filter(o => o.projetoId === projeto.id).every(o => o.status === "Cumprida"), qtd: ctx.obrigacoes.filter(o => o.projetoId === projeto.id).length },
    { item: "Diligências encerradas", ok: ctx.diligencias.filter(d => d.projetoId === projeto.id).every(d => d.status === "Encerrada"), qtd: ctx.diligencias.filter(d => d.projetoId === projeto.id).length },
    { item: "Evidências validadas", ok: ctx.evidencias.filter(e => e.projetoId === projeto.id).every(e => e.status === "Validada" || e.status === "Validada com ressalva"), qtd: ctx.evidencias.filter(e => e.projetoId === projeto.id).length },
    { item: "Riscos/não conformidades encerrados", ok: ctx.riscos.filter(r => r.projetoId === projeto.id).every(r => r.situacao === "Encerrada"), qtd: ctx.riscos.filter(r => r.projetoId === projeto.id).length }
  ];
  return { titulo: `Checklist de Preparação para Prestação de Contas — ${projeto.nome}`, itens };
}
