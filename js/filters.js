/**
 * filters.js — filtros combináveis e ordenação, sobre a lista de projetos
 * já enriquecida com score/alertas (ver app.js: montarProjetosEnriquecidos).
 */
export function aplicarFiltros(projetos, filtros) {
  return projetos.filter(p => {
    if (filtros.orgao && p.orgaoFinanciador !== filtros.orgao) return false;
    if (filtros.estado && p.estadoTerritorio !== filtros.estado) return false;
    if (filtros.situacao && p.situacaoAdministrativa !== filtros.situacao) return false;
    if (filtros.risco && p._score.corRisco !== filtros.risco) return false;
    if (filtros.busca) {
      const alvo = `${p.nome} ${p.orgaoFinanciador || ""} ${p.numeroProposta || ""}`.toLowerCase();
      if (!alvo.includes(filtros.busca.toLowerCase())) return false;
    }
    return true;
  });
}

const ORDENADORES = {
  maiorRisco: (a, b) => (b._score.score ?? -1) - (a._score.score ?? -1) === 0 ? 0 : (a._score.score ?? 999) - (b._score.score ?? 999),
  maisPendencias: (a, b) => (b._alertasCount || 0) - (a._alertasCount || 0),
  atualizacaoMaisAntiga: (a, b) => {
    if (!a.ultimaAtualizacao) return -1;
    if (!b.ultimaAtualizacao) return 1;
    return new Date(a.ultimaAtualizacao) - new Date(b.ultimaAtualizacao);
  },
  nome: (a, b) => a.nome.localeCompare(b.nome, "pt-BR")
};

export function ordenar(projetos, chave) {
  const fn = ORDENADORES[chave] || ORDENADORES.nome;
  return [...projetos].sort(fn);
}

export function valoresUnicos(projetos, campo) {
  return [...new Set(projetos.map(p => p[campo]).filter(Boolean))].sort();
}
