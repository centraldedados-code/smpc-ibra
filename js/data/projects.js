/**
 * projects.js
 *
 * Unifica as TRÊS fontes distintas do SMPC em uma lista de "projetos" para as
 * views, respeitando a regra: só VINCULO_EXATO é consolidado automaticamente.
 * VINCULO_PROVAVEL e AMBIGUO aparecem como sugestões pendentes de validação
 * humana (ver view "Conciliação" em app.js) e NÃO são fundidos no card do
 * projeto até serem confirmados em vinculos.js.
 *
 * Resultado: cada "projeto" final é um de:
 *   - Monitoramento + Cadastro (quando há VINCULO_EXATO confirmado)
 *   - Monitoramento isolado (a maioria — 34 dos 43 registros)
 *   - Cadastro isolado (quando não há correspondência em Monitoramento — cad-6)
 *   - Sistema específico isolado (enquanto o vínculo com Monitoramento não for
 *     confirmado manualmente em vinculos.js)
 */
import { PROJETOS_CADASTRO } from "./projects_cadastro.js";
import { PROJETOS_SISTEMAS } from "./projects_sistemas.js";
import { MONITORAMENTO_PROJETOS } from "./monitoring.js";
import { VINCULOS } from "./vinculos.js";
import { montarTabelaConciliacao } from "./reconciliation.js";

export function criarConciliacao(monitoramento = MONITORAMENTO_PROJETOS, sistemas = PROJETOS_SISTEMAS) {
  return montarTabelaConciliacao(PROJETOS_CADASTRO, sistemas, monitoramento);
}

export const CONCILIACAO = criarConciliacao();

function baseDoMonitoramento(m, cadastro, sistema) {
  return {
    id: `proj-${m.id}`,
    nome: m.nomeProjeto,
    origem: "monitoramento" + (cadastro ? "+cadastro" : "") + (sistema ? "+sistema" : ""),
    orgaoFinanciador: m.orgaoFinanciador,
    estadoTerritorio: cadastro && /^[A-Z]{2}$/.test(cadastro.estadoOuFinanciador.valor_normalizado || "") ? cadastro.estadoOuFinanciador.valor_normalizado : null,
    tipoInstrumento: null,
    numeroProposta: cadastro ? cadastro.proposta : m.codigoInstrumento,
    numeroEmenda: cadastro ? cadastro.emenda : null,
    codigoInstrumento: m.codigoInstrumento,
    situacaoAdministrativa: cadastro ? cadastro.situacaoStatusFinal : null,
    faseAtual: m.statusFase,
    programa: m.programa,
    ano: m.ano,
    // responsável: área (rótulo institucional, ex. "EXECUÇÃO") é distinta de
    // nome de pessoa. A fonte às vezes tem nome próprio — esse dado NÃO é
    // publicado neste front-end (ver monitoring.js); só o booleano indica que
    // existe, disponível apenas na fonte privada.
    areaResponsavel: m.areaResponsavel,
    responsavelNominalDisponivelSomenteNaFontePrivada: m.responsavelNominalDisponivelSomenteNaFontePrivada,
    dataCadastro: cadastro ? cadastro.dataCadastro.valor_normalizado : null,
    dataAssinatura: m.dataAssinatura.valor_normalizado,
    dataInicioExecucao: m.dataInicioExecucao.valor_normalizado,
    dataFimExecucao: m.dataFimExecucao.valor_normalizado,
    prazoPrestacaoContas: m.prazoPrestacaoContas.valor_normalizado,
    ultimaAtualizacao: null, // não existe campo de "última atualização" em nenhuma fonte
    // risco: sempre exposto separadamente do que o SMPC calcula (ver derive.js
    // e scoring.js) — nunca fundidos num único rótulo.
    riscoDeclaradoNaFonte: m.riscoDeclaradoNaFonte,
    statusRelatorio: m.statusRelatorio,
    statusEvidenciaOriginal: m.statusEvidenciaOriginal,
    statusExecucao: m.statusExecucao,
    possuiJustificativa: m.possuiJustificativa,
    possuiEncaminhamentoSemanal: m.possuiEncaminhamentoSemanal,
    possuiDetalhamentoSituacao: m.possuiDetalhamentoSituacao,
    paginaUrl: sistema ? sistema.paginaUrl : null,
    subtituloSistema: sistema ? sistema.subtitulo : null,
    // esta entidade é considerada "confirmada" para fins de contagem de
    // portfólio: é um registro da fonte de Monitoramento, que por desenho da
    // planilha representa 1 instrumento/projeto por linha.
    _entidadeConfirmada: true,
    _monitoramentoId: m.id,
    _cadastroId: cadastro ? cadastro.id : null,
    _sistemaId: sistema ? sistema.id : null
  };
}

function baseDoCadastroIsolado(c) {
  return {
    id: `proj-${c.id}`,
    nome: c.nomeProjeto,
    origem: "cadastro",
    orgaoFinanciador: c.estadoOuFinanciador.valor_normalizado,
    estadoTerritorio: /^[A-Z]{2}$/.test(c.estadoOuFinanciador.valor_normalizado || "") ? c.estadoOuFinanciador.valor_normalizado : null,
    tipoInstrumento: null,
    numeroProposta: c.proposta,
    numeroEmenda: c.emenda,
    codigoInstrumento: null,
    situacaoAdministrativa: c.situacaoStatusFinal,
    faseAtual: null, programa: null, ano: null,
    areaResponsavel: null, responsavelNominalDisponivelSomenteNaFontePrivada: false,
    dataCadastro: c.dataCadastro.valor_normalizado,
    dataAssinatura: null, dataInicioExecucao: null, dataFimExecucao: null, prazoPrestacaoContas: null,
    ultimaAtualizacao: null,
    riscoDeclaradoNaFonte: null, statusRelatorio: null, statusEvidenciaOriginal: null, statusExecucao: null,
    possuiJustificativa: false, possuiEncaminhamentoSemanal: false, possuiDetalhamentoSituacao: false,
    paginaUrl: null, subtituloSistema: null,
    // registro cadastral próprio, sem correspondência encontrada no Monitoramento —
    // tratado como entidade confirmada (não há indício de duplicação).
    _entidadeConfirmada: true,
    _monitoramentoId: null, _cadastroId: c.id, _sistemaId: null
  };
}

function baseDoSistemaIsolado(s) {
  return {
    id: `proj-${s.id}`,
    nome: s.nome,
    origem: "sistema",
    orgaoFinanciador: null, estadoTerritorio: null, tipoInstrumento: null,
    numeroProposta: null, numeroEmenda: null, codigoInstrumento: null,
    situacaoAdministrativa: null, faseAtual: null, programa: null, ano: null,
    areaResponsavel: null, responsavelNominalDisponivelSomenteNaFontePrivada: false,
    dataCadastro: null, dataAssinatura: null, dataInicioExecucao: null, dataFimExecucao: null, prazoPrestacaoContas: null,
    ultimaAtualizacao: null,
    riscoDeclaradoNaFonte: null, statusRelatorio: null, statusEvidenciaOriginal: null, statusExecucao: null,
    possuiJustificativa: false, possuiEncaminhamentoSemanal: false, possuiDetalhamentoSituacao: false,
    paginaUrl: s.paginaUrl, subtituloSistema: s.subtitulo,
    // NÃO é tratado como entidade confirmada: pode ser apenas o painel de um
    // projeto já contado na fonte de Monitoramento, aguardando confirmação.
    _entidadeConfirmada: false,
    _monitoramentoId: null, _cadastroId: null, _sistemaId: s.id
  };
}

export function construirProjetos(
  monitoramento = MONITORAMENTO_PROJETOS,
  conciliacao = criarConciliacao(monitoramento),
  sistemas = PROJETOS_SISTEMAS,
  vinculos = VINCULOS
) {
  const { cadastroXmonitoramento, sistemasXmonitoramento } = conciliacao;

  const cadastroExatoPorMonitoramentoId = new Map(
    cadastroXmonitoramento.filter(r => r.classificacao === "VINCULO_EXATO").map(r => [r.monitoramentoId, r.cadastroId])
  );
  const cadastroIdsVinculados = new Set(cadastroExatoPorMonitoramentoId.values());

  // vínculos sistema<->monitoramento CONFIRMADOS manualmente em vinculos.js (por
  // monitoramentoId), distintos dos "prováveis" calculados dinamicamente acima —
  // só os confirmados manualmente entram no card consolidado.
  const sistemaConfirmadoPorMonitoramentoId = new Map(
    vinculos.filter(v => v.tipo === "sistema-monitoramento" && v.confirmado).map(v => [v.monitoramentoId, v.sistemaId])
  );
  const sistemaIdsVinculados = new Set(sistemaConfirmadoPorMonitoramentoId.values());

  const projetos = [];

  monitoramento.forEach(m => {
    const cadastroId = cadastroExatoPorMonitoramentoId.get(m.id);
    const cadastro = cadastroId ? PROJETOS_CADASTRO.find(c => c.id === cadastroId) : null;
    const sistemaId = sistemaConfirmadoPorMonitoramentoId.get(m.id);
    const sistema = sistemaId ? sistemas.find(s => s.id === sistemaId) : null;
    projetos.push(baseDoMonitoramento(m, cadastro, sistema));
  });

  PROJETOS_CADASTRO.forEach(c => {
    if (cadastroIdsVinculados.has(c.id)) return; // já incorporado acima
    projetos.push(baseDoCadastroIsolado(c));
  });

  sistemas.forEach(s => {
    if (sistemaIdsVinculados.has(s.id)) return; // já incorporado acima
    // sugestões de vínculo prováveis/ambíguas ficam anexadas para a UI de Conciliação
    const sugestao = sistemasXmonitoramento.find(r => r.sistemaId === s.id);
    const p = baseDoSistemaIsolado(s);
    p._sugestaoVinculo = sugestao && sugestao.classificacao !== "SEM_CORRESPONDENCIA" ? sugestao : null;
    projetos.push(p);
  });

  return projetos;
}

/**
 * Contagens do portfólio para exibição em KPI — NUNCA some fontes diferentes
 * como se fossem "quantidade de projetos". Um sistema específico ainda sem
 * vínculo confirmado pode ser o mesmo projeto já contado no Monitoramento;
 * por isso ele não entra em `entidadesConfirmadas`.
 */
export function contarPortfolio(
  projetos,
  monitoramento = MONITORAMENTO_PROJETOS,
  conciliacao = criarConciliacao(monitoramento),
  sistemas = PROJETOS_SISTEMAS
) {
  const { cadastroXmonitoramento, sistemasXmonitoramento } = conciliacao;
  return {
    registrosMonitoramento: monitoramento.length,
    registrosCadastro: PROJETOS_CADASTRO.length,
    sistemasEspecificos: sistemas.length,
    vinculosExatosConfirmados: cadastroXmonitoramento.filter(r => r.classificacao === "VINCULO_EXATO").length,
    cadastroSemCorrespondencia: cadastroXmonitoramento.filter(r => r.classificacao === "SEM_CORRESPONDENCIA").length,
    vinculosProvaveisPendentes: sistemasXmonitoramento.filter(r => r.classificacao === "VINCULO_PROVAVEL").length,
    vinculosAmbiguosPendentes: sistemasXmonitoramento.filter(r => r.classificacao === "AMBIGUO").length,
    sistemasSemCorrespondencia: sistemasXmonitoramento.filter(r => r.classificacao === "SEM_CORRESPONDENCIA").length,
    // única contagem segura para "quantidade de projetos no portfólio":
    entidadesConfirmadas: projetos.filter(p => p._entidadeConfirmada).length,
    // registros que existem mas ainda não podem ser somados com segurança:
    aguardandoConfirmacaoDeVinculo: projetos.filter(p => !p._entidadeConfirmada).length
  };
}
