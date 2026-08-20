import { IDENTIDADE } from "./config.js";
import { construirProjetos, contarPortfolio, criarConciliacao } from "./data/projects.js";
import { PROJETOS_SISTEMAS } from "./data/projects_sistemas.js";
import { MONITORAMENTO_PROJETOS } from "./data/monitoring.js";
import { carregarDadosSMPC } from "./data/live_feed.js";
import { OBRIGACOES as OBRIGACOES_MANUAIS } from "./data/obligations.js";
import { DILIGENCIAS as DILIGENCIAS_MANUAIS } from "./data/diligences.js";
import { EVIDENCIAS as EVIDENCIAS_MANUAIS } from "./data/evidences.js";
import { RISCOS as RISCOS_MANUAIS } from "./data/risks.js";
import { EXECUCAO_FISICA as EXECUCAO_FISICA_MANUAL } from "./data/physical_execution.js";
import { TRILHA_AUDITORIA } from "./data/audit_log.js";
import { derivarObrigacoes, derivarRiscos, derivarExecucaoFisica, derivarEvidencias } from "./data/derive.js";
import { calcularScore } from "./scoring.js";
import { gerarAlertas } from "./alerts.js";

const HOJE = new Date();
const NI = "Não informado";
let PROJECT_VIEW_MODE = "cards";
let ACTIVE_DETAIL_TAB = "visao";

const FEED_DADOS = await carregarDadosSMPC({
  projetos: MONITORAMENTO_PROJETOS,
  obrigacoes: OBRIGACOES_MANUAIS,
  evidencias: EVIDENCIAS_MANUAIS,
  diligencias: DILIGENCIAS_MANUAIS,
  riscos: RISCOS_MANUAIS,
  sistemas: PROJETOS_SISTEMAS,
  conciliacao: []
});

const MONITORAMENTO_ATIVO = FEED_DADOS.projetos;
const SISTEMAS_ATIVOS = FEED_DADOS.sistemas?.length ? FEED_DADOS.sistemas : PROJETOS_SISTEMAS;
const VINCULOS_ATIVOS = FEED_DADOS.online
  ? SISTEMAS_ATIVOS.filter(s => s.confirmado && s.monitoramentoIdConfirmado).map(s => ({
      tipo: "sistema-monitoramento",
      sistemaId: s.id,
      monitoramentoId: s.monitoramentoIdConfirmado,
      confirmado: true,
      confirmadoPor: "Validação registrada na planilha institucional",
      confirmadoEm: null,
      observacao: "Vínculo confirmado em 07_CONCILIACAO"
    }))
  : undefined;

const CONCILIACAO = criarConciliacao(MONITORAMENTO_ATIVO, SISTEMAS_ATIVOS);
const PROJETOS = construirProjetos(MONITORAMENTO_ATIVO, CONCILIACAO, SISTEMAS_ATIVOS, VINCULOS_ATIVOS);
const ENTIDADES = PROJETOS.filter(p => p._entidadeConfirmada);
const CONTAGENS = contarPortfolio(PROJETOS, MONITORAMENTO_ATIVO, CONCILIACAO, SISTEMAS_ATIVOS);

const projetoIdPorMonitoramentoId = (monId) => {
  const p = PROJETOS.find(pr => pr._monitoramentoId === monId);
  return p ? p.id : null;
};

// Quando o Apps Script está online, os módulos operacionais passam a ser
// integralmente dirigidos pela planilha. Offline, o SMPC mantém o fallback
// local + derivações conservadoras já auditadas.
const OBRIGACOES = FEED_DADOS.online
  ? FEED_DADOS.obrigacoes
  : [...OBRIGACOES_MANUAIS, ...derivarObrigacoes(MONITORAMENTO_ATIVO, projetoIdPorMonitoramentoId)];
const RISCOS = FEED_DADOS.online
  ? FEED_DADOS.riscos
  : [...RISCOS_MANUAIS, ...derivarRiscos(MONITORAMENTO_ATIVO, projetoIdPorMonitoramentoId)];
const DILIGENCIAS = FEED_DADOS.online ? FEED_DADOS.diligencias : DILIGENCIAS_MANUAIS;
const EXECUCAO_FISICA = [...EXECUCAO_FISICA_MANUAL, ...derivarExecucaoFisica(MONITORAMENTO_ATIVO, projetoIdPorMonitoramentoId)];
const EVIDENCIAS = FEED_DADOS.online
  ? FEED_DADOS.evidencias
  : [...EVIDENCIAS_MANUAIS, ...derivarEvidencias(MONITORAMENTO_ATIVO, projetoIdPorMonitoramentoId)];
const CONCILIACAO_PLANILHA = FEED_DADOS.online && Array.isArray(FEED_DADOS.conciliacao) ? FEED_DADOS.conciliacao : [];

const CTX_BASE = {
  hoje: HOJE,
  obrigacoes: OBRIGACOES,
  diligencias: DILIGENCIAS,
  evidencias: EVIDENCIAS,
  riscos: RISCOS,
  execucaoFisica: EXECUCAO_FISICA,
  checklistDocumentos: [],
  projetos: PROJETOS
};

const ALERTAS = gerarAlertas(CTX_BASE);
PROJETOS.forEach(p => {
  p._score = calcularScore(p, CTX_BASE);
  p._alertas = ALERTAS.filter(a => a.projetoId === p.id);
  p._alertasCount = p._alertas.length;
});

const ALERTAS_DIVERGENCIA = [];
CONCILIACAO.cadastroXmonitoramento.forEach(r => {
  if (!r.divergencias?.length) return;
  const p = PROJETOS.find(pr => pr._monitoramentoId === r.monitoramentoId);
  r.divergencias.forEach(d => {
    ALERTAS_DIVERGENCIA.push({
      nivel: "REQUER VALIDAÇÃO",
      origem: "Conciliação de Fontes",
      projetoId: p ? p.id : null,
      titulo: `Divergência de ${d.campo} entre Cadastro e Monitoramento`,
      detalhe: `Fonte Cadastro afirma: "${d.cadastro}". Fonte Monitoramento afirma: "${d.monitoramento}". Nenhuma fonte foi presumida correta.`,
      referenciaId: null
    });
  });
});
const TODOS_ALERTAS = [...ALERTAS, ...ALERTAS_DIVERGENCIA];

const dataStateText = document.querySelector(".data-state span:last-child");
if (dataStateText) {
  dataStateText.textContent = FEED_DADOS.online ? "Dados via Google Sheets" : "Base local sanitizada";
  if (FEED_DADOS.atualizadoEm) dataStateText.title = `Feed atualizado em ${FEED_DADOS.atualizadoEm}`;
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name) {
  const paths = {
    home: '<path d="M3 10.5 10 4l7 6.5"/><path d="M5.5 9.5V17h9V9.5"/>',
    projects: '<rect x="3" y="4" width="14" height="12" rx="2"/><path d="M7 4V2.8h6V4M7 9h6M7 12h4"/>',
    systems: '<rect x="3" y="3" width="14" height="10" rx="2"/><path d="M7 17h6M10 13v4"/>',
    calendar: '<rect x="3" y="4.5" width="14" height="12.5" rx="2"/><path d="M6 2.5v4M14 2.5v4M3 8h14"/>',
    file: '<path d="M5 2.5h6l4 4V17H5z"/><path d="M11 2.5v4h4M7.5 10h5M7.5 13h5"/>',
    shield: '<path d="M10 2.5 16 5v4.5c0 4-2.5 6.4-6 8-3.5-1.6-6-4-6-8V5z"/><path d="m7.5 10 1.6 1.6 3.5-3.7"/>',
    reconcile: '<path d="M4 6h10l-2.5-2.5M16 14H6l2.5 2.5"/>',
    report: '<path d="M4 17V9M8 17V5M12 17v-4M16 17V7"/>',
    audit: '<circle cx="9" cy="9" r="5.5"/><path d="m13 13 4 4M6.5 9h5M9 6.5v5"/>',
    search: '<circle cx="8.5" cy="8.5" r="5"/><path d="m12.3 12.3 4.2 4.2"/>',
    external: '<path d="M11 4h5v5M16 4l-7 7"/><path d="M14 11v5H4V6h5"/>',
    arrow: '<path d="M5 10h10M11 6l4 4-4 4"/>',
    alert: '<path d="M10 3 18 17H2z"/><path d="M10 7v4M10 14h.01"/>',
    grid: '<rect x="3" y="3" width="5" height="5" rx="1"/><rect x="12" y="3" width="5" height="5" rx="1"/><rect x="3" y="12" width="5" height="5" rx="1"/><rect x="12" y="12" width="5" height="5" rx="1"/>',
    list: '<path d="M7 5h10M7 10h10M7 15h10"/><circle cx="3.5" cy="5" r=".5"/><circle cx="3.5" cy="10" r=".5"/><circle cx="3.5" cy="15" r=".5"/>',
    link: '<path d="M8.5 11.5 11.5 8.5"/><path d="M7 13H5.5a3.5 3.5 0 0 1 0-7H9M13 7h1.5a3.5 3.5 0 0 1 0 7H11"/>',
    check: '<path d="m4 10 4 4 8-9"/>',
    clock: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4l3 2"/>',
    data: '<ellipse cx="10" cy="5" rx="6" ry="2.5"/><path d="M4 5v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5V5M4 10v5c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-5"/>'
  };
  return `<svg viewBox="0 0 20 20" aria-hidden="true">${paths[name] || paths.file}</svg>`;
}

function fmtData(iso) {
  if (!iso) return NI;
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : esc(iso);
}

function fmtPct(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return NI;
  return `${Math.round(Number(v) * 10) / 10}%`;
}

function diasAte(iso) {
  if (!iso) return null;
  const d = new Date(`${iso}T12:00:00`);
  const h = new Date(HOJE.getFullYear(), HOJE.getMonth(), HOJE.getDate(), 12, 0, 0);
  return Math.ceil((d - h) / 86400000);
}

function classNivel(nivel) {
  if (nivel === "CRÍTICO") return "critical";
  if (nivel === "REQUER VALIDAÇÃO") return "validation";
  if (nivel === "ATENÇÃO" || nivel === "RISCO DOCUMENTAL") return "warning";
  return "info";
}

function riskClass(score) {
  if (!score) return "neutral";
  if (score.classificacao === "CRÍTICO" || score.corRisco === "critico") return "critical";
  if (score.corRisco === "alto") return "high";
  if (score.corRisco === "medio") return "medium";
  if (score.corRisco === "baixo") return "low";
  return "neutral";
}

function riskBadge(score) {
  const cls = riskClass(score);
  const texto = score?.classificacao || "Não avaliado";
  const label = score?.scoreDisponivel && score?.score != null && texto !== "CRÍTICO"
    ? `${texto} · ${score.score}${score.parcial ? "*" : ""}`
    : texto;
  return `<span class="risk-badge ${cls}">${esc(label)}</span>`;
}

function statusBadge(p) {
  const status = p.faseAtual || p.situacaoAdministrativa || "Não informado";
  return `<span class="status-badge" title="Situação registrada na fonte">${esc(status)}</span>`;
}

function projetoPorId(id) {
  return PROJETOS.find(p => p.id === id) || null;
}

function nomeDoProjeto(id) {
  return projetoPorId(id)?.nome || id || NI;
}

function execucaoDoProjeto(p) {
  const c = p?._score?.componentes?.execucaoFisica;
  return c?.status === "ok" ? c.percentual : null;
}

function evidenciaDoProjeto(p) {
  const ev = EVIDENCIAS.find(e => e.projetoId === p.id);
  if (!ev) return NI;
  return ev.status || ev.statusTemporal || ev.statusEvidenciaOriginal || NI;
}

function obrigacoesDoProjeto(p) {
  return OBRIGACOES.filter(o => o.projetoId === p.id).sort((a,b) => String(a.prazo || "9999").localeCompare(String(b.prazo || "9999")));
}

function proximaObrigacao(p) {
  const lista = obrigacoesDoProjeto(p).filter(o => o.status !== "Cumprida" && o.prazo);
  if (!lista.length) return null;
  const vencidas = lista.filter(o => diasAte(o.prazo) < 0).sort((a,b) => a.prazo.localeCompare(b.prazo));
  if (vencidas.length) return vencidas[0];
  return lista.sort((a,b) => a.prazo.localeCompare(b.prazo))[0];
}

function sistemasSugeridosParaProjeto(p) {
  if (!p?._monitoramentoId) return [];
  return CONCILIACAO.sistemasXmonitoramento
    .filter(r => (r.candidatos || []).includes(p._monitoramentoId))
    .map(r => ({
      conciliacao: r,
      sistema: SISTEMAS_ATIVOS.find(s => s.id === r.sistemaId)
    }))
    .filter(x => x.sistema);
}

function sistemaConfirmadoDoProjeto(p) {
  if (!p?.paginaUrl) return null;
  return SISTEMAS_ATIVOS.find(s => s.id === p._sistemaId) || { nome: p.nome, paginaUrl: p.paginaUrl };
}

function externalLink(url, label = "Acessar sistema") {
  return `<a class="btn btn-primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ${icon("external")}</a>`;
}

function pageHead(title, subtitle, actions = "") {
  return `<div class="page-head"><div><h2>${esc(title)}</h2><p>${subtitle}</p></div>${actions ? `<div class="page-head-actions">${actions}</div>` : ""}</div>`;
}

function emptyState(text) {
  return `<div class="empty-state"><div class="empty-icon">—</div>${text}</div>`;
}

function renderBarChart(items, classResolver = () => "") {
  const max = Math.max(1, ...items.map(i => i.value));
  if (!items.length) return emptyState("Dados insuficientes para esta visualização.");
  return `<div class="chart-bars">${items.map(i => `
    <div class="chart-row">
      <div class="chart-label" title="${esc(i.label)}">${esc(i.label)}</div>
      <div class="chart-track"><div class="chart-fill ${classResolver(i)}" style="width:${Math.max(3,(i.value/max)*100)}%"></div></div>
      <div class="chart-value">${i.value}</div>
    </div>`).join("")}</div>`;
}

function groupCount(list, getter) {
  const map = new Map();
  list.forEach(item => {
    const key = getter(item) || "Não informado";
    map.set(key, (map.get(key) || 0) + 1);
  });
  return [...map.entries()].map(([label,value]) => ({label,value})).sort((a,b) => b.value-a.value);
}

function horizonteObrigacoes() {
  const abertas = OBRIGACOES.filter(o => o.status !== "Cumprida" && o.prazo);
  const buckets = [
    {label:"Vencidas", value:abertas.filter(o => diasAte(o.prazo) < 0).length, cls:"danger"},
    {label:"Próximos 7 dias", value:abertas.filter(o => { const d=diasAte(o.prazo); return d>=0&&d<=7; }).length, cls:"orange"},
    {label:"8 a 15 dias", value:abertas.filter(o => { const d=diasAte(o.prazo); return d>7&&d<=15; }).length, cls:"warn"},
    {label:"16 a 30 dias", value:abertas.filter(o => { const d=diasAte(o.prazo); return d>15&&d<=30; }).length, cls:""}
  ];
  return buckets;
}

function topAlertas(limit=6) {
  const ordem = {"CRÍTICO":0,"REQUER VALIDAÇÃO":1,"ATENÇÃO":2,"RISCO DOCUMENTAL":3,"INFORMAÇÃO INCOMPLETA":4,"INFORMAÇÃO":5};
  return [...TODOS_ALERTAS].sort((a,b)=>(ordem[a.nivel]??9)-(ordem[b.nivel]??9)).slice(0,limit);
}

function navTo(hash) {
  location.hash = hash;
}

// ---------------------------------------------------------------- VISÃO GERAL

function viewVisaoGeral() {
  const criticos = ENTIDADES.filter(p => p._score.classificacao === "CRÍTICO").length;
  const projetosComAtencao = new Set(TODOS_ALERTAS
    .filter(a => ["CRÍTICO","ATENÇÃO","REQUER VALIDAÇÃO","RISCO DOCUMENTAL"].includes(a.nivel) && a.projetoId)
    .map(a => a.projetoId)).size;
  const obrigacoes30 = OBRIGACOES.filter(o => o.status !== "Cumprida" && o.prazo && diasAte(o.prazo) >= 0 && diasAte(o.prazo) <= 30).length;
  const diligenciasAbertas = DILIGENCIAS.filter(d => d.status !== "Encerrada").length;
  const evidenciasAtencao = EVIDENCIAS.filter(e => /atrasad/i.test(e.statusTemporal || "")).length;
  const semAtualizacao = ENTIDADES.filter(p => !p.ultimaAtualizacao).length;

  const kpis = [
    {value:CONTAGENS.entidadesConfirmadas,label:"Projetos monitorados",note:"Entidades únicas confirmadas",icon:"projects",cls:""},
    {value:projetosComAtencao,label:"Demandam atenção",note:"Alertas críticos, atenção ou validação",icon:"alert",cls:projetosComAtencao?"warn":""},
    {value:criticos,label:"Classificação crítica",note:"Critical Override com motivo rastreável",icon:"shield",cls:criticos?"crit":""},
    {value:obrigacoes30,label:"Obrigações próximas",note:"Com prazo nos próximos 30 dias",icon:"calendar",cls:obrigacoes30?"warn":""},
    {value:diligenciasAbertas,label:"Diligências abertas",note:"Registros ainda não encerrados",icon:"file",cls:diligenciasAbertas?"warn":""},
    {value:evidenciasAtencao,label:"Evidências em atenção",note:"Status temporal informado como atrasado",icon:"check",cls:evidenciasAtencao?"warn":""}
  ];

  const alertas = topAlertas(6);
  const situacoes = groupCount(ENTIDADES, p => p.faseAtual || p.situacaoAdministrativa).slice(0,6);
  const riscos = groupCount(ENTIDADES, p => p._score.classificacao).slice(0,6);
  const horiz = horizonteObrigacoes();

  return `
    ${pageHead("Visão Geral", "Monitoramento institucional do portfólio de projetos, com foco em exceções, prazos e rastreabilidade.")}

    <div class="kpi-grid">
      ${kpis.map(k => `<div class="kpi-card ${k.cls}"><div class="kpi-icon">${icon(k.icon)}</div><div class="kpi-value">${k.value}</div><div class="kpi-label">${esc(k.label)}</div><div class="kpi-note">${esc(k.note)}</div></div>`).join("")}
    </div>

    <section class="section">
      <div class="section-head"><div><div class="section-title">Atenção Executiva</div><div class="section-sub">Ocorrências priorizadas por criticidade e necessidade de validação</div></div><button class="text-link" data-go="modoAuditor">Ver todos os alertas →</button></div>
      <div class="attention-panel">
        <div class="attention-head"><div class="attention-head-title"><span>${icon("alert")}</span><span>Itens que pedem ação ou análise</span></div><span class="mini-badge sem">${TODOS_ALERTAS.length} alerta(s)</span></div>
        <div class="attention-list">
          ${alertas.length ? alertas.map(a => {
            const p = projetoPorId(a.projetoId);
            return `<div class="attention-item"><span class="attention-dot ${classNivel(a.nivel)}"></span><div class="attention-copy"><strong>${esc(a.titulo)}</strong><span>${esc(a.detalhe)}</span></div>${p ? `<button class="text-link attention-project" data-project="${esc(p.id)}">${esc(p.nome)} →</button>` : `<span class="attention-project">${esc(a.origem)}</span>`}</div>`;
          }).join("") : `<div style="padding:22px">${emptyState("Nenhuma ocorrência prioritária com os dados cadastrados.")}</div>`}
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><div><div class="section-title">Leitura do portfólio</div><div class="section-sub">Poucas visualizações, concentradas no que ajuda a interpretar a carteira</div></div></div>
      <div class="insight-grid">
        <div class="insight-card"><div class="insight-title">Projetos por situação</div><div class="insight-desc">Situação/fase exatamente como registrada nas fontes</div>${renderBarChart(situacoes)}</div>
        <div class="insight-card"><div class="insight-title">Classificação calculada pelo SMPC</div><div class="insight-desc">Não substitui o risco declarado na fonte</div>${renderBarChart(riscos, i => /CRÍTICO/i.test(i.label)?"danger":/alto/i.test(i.label)?"orange":/médio/i.test(i.label)?"warn":/não avaliado/i.test(i.label)?"muted":"")}</div>
        <div class="insight-card"><div class="insight-title">Obrigações por horizonte</div><div class="insight-desc">Somente registros com prazo disponível</div>${renderBarChart(horiz, i => i.cls)}</div>
      </div>
    </section>

    <section class="section">
      <div class="section-head"><div><div class="section-title">Governança das fontes</div><div class="section-sub">Fontes diferentes não são somadas como se fossem novos projetos</div></div><button class="text-link" data-go="conciliacao">Abrir conciliação →</button></div>
      <div class="kpi-grid">
        ${[
          {v:CONTAGENS.registrosMonitoramento,l:"Registros de monitoramento",i:"data"},
          {v:CONTAGENS.registrosCadastro,l:"Registros cadastrais",i:"file"},
          {v:CONTAGENS.sistemasEspecificos,l:"Sistemas específicos",i:"systems"},
          {v:CONTAGENS.vinculosExatosConfirmados,l:"Vínculos exatos",i:"link"},
          {v:CONTAGENS.vinculosProvaveisPendentes,l:"Vínculos prováveis",i:"reconcile",c:"warn"},
          {v:CONTAGENS.vinculosAmbiguosPendentes,l:"Vínculos ambíguos",i:"alert",c:"warn"}
        ].map(k=>`<div class="kpi-card ${k.c||"neutral"}"><div class="kpi-icon">${icon(k.i)}</div><div class="kpi-value">${k.v}</div><div class="kpi-label">${esc(k.l)}</div></div>`).join("")}
      </div>
    </section>

    ${semAtualizacao ? `<section class="section"><div class="notice info"><strong>Qualidade dos dados:</strong> ${semAtualizacao} entidade(s) não possuem campo de última atualização na fonte atual. O SMPC mantém a ausência explícita em vez de inventar uma data.</div></section>` : ""}
  `;
}

// ---------------------------------------------------------------- PROJETOS

function projectCard(p) {
  const exec = execucaoDoProjeto(p);
  const evidencia = evidenciaDoProjeto(p);
  const obrig = proximaObrigacao(p);
  const sistema = sistemaConfirmadoDoProjeto(p);
  const sugeridos = sistemasSugeridosParaProjeto(p);
  const risk = riskClass(p._score);
  const area = p.areaResponsavel || NI;
  const alertas = p._alertasCount || 0;
  const systemState = sistema ? "Sistema associado" : sugeridos.length ? "Vínculo do sistema aguardando validação" : "Sistema específico não associado";

  return `<article class="project-card risk-${risk}">
    <div class="project-top">
      <button class="project-name-btn" data-project="${esc(p.id)}">${esc(p.nome)}</button>
      ${statusBadge(p)}
    </div>
    <div class="project-meta"><strong>${esc(p.orgaoFinanciador || "Órgão não informado")}</strong><br>${esc([p.estadoTerritorio,p.programa].filter(Boolean).join(" · ") || "Território/programa não informado")}</div>
    <div class="project-metrics">
      <div class="metric"><div class="metric-label">Execução física</div><div class="metric-value">${exec == null ? NI : fmtPct(exec)}</div></div>
      <div class="metric"><div class="metric-label">Evidências</div><div class="metric-value" title="${esc(evidencia)}">${esc(evidencia)}</div></div>
      <div class="metric"><div class="metric-label">Risco SMPC</div><div class="metric-value">${riskBadge(p._score)}</div></div>
    </div>
    <div class="project-obligation">
      <div class="label">Próxima obrigação / prazo monitorado</div>
      <div class="value">${obrig ? `<strong>${esc(obrig.obrigacao)}</strong><span>${fmtData(obrig.prazo)}${diasAte(obrig.prazo)<0?" · vencido":""}</span>` : `<span>${NI}</span>`}</div>
    </div>
    <div class="project-foot">
      <div class="project-foot-meta">Área responsável: <strong>${esc(area)}</strong><br>${alertas} alerta(s) · atualização: ${p.ultimaAtualizacao ? fmtData(p.ultimaAtualizacao) : "não informada"}</div>
      <div class="project-actions">
        <button class="btn btn-secondary" data-project="${esc(p.id)}">Ver ficha ${icon("arrow")}</button>
        ${sistema ? externalLink(sistema.paginaUrl,"Abrir projeto") : `<span class="system-state">${esc(systemState)}</span>`}
      </div>
    </div>
  </article>`;
}

function options(vals, label) {
  return `<option value="">${esc(label)}</option>${vals.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join("")}`;
}

function viewProjetos() {
  const situacoes = [...new Set(ENTIDADES.map(p => p.faseAtual || p.situacaoAdministrativa).filter(Boolean))].sort();
  const orgaos = [...new Set(ENTIDADES.map(p => p.orgaoFinanciador).filter(Boolean))].sort();
  const ufs = [...new Set(ENTIDADES.map(p => p.estadoTerritorio).filter(Boolean))].sort();
  const areas = [...new Set(ENTIDADES.map(p => p.areaResponsavel).filter(Boolean))].sort();
  return `
    ${pageHead("Projetos", "Acompanhamento executivo das entidades confirmadas no portfólio do SMPC.", `<span class="mini-badge sem">${ENTIDADES.length} projeto(s)</span>`)}
    <div class="toolbar">
      <div class="search-wrap">${icon("search")}<input id="fBusca" type="search" placeholder="Buscar projeto, órgão, proposta ou programa..."></div>
      <select id="fSituacao">${options(situacoes,"Situação")}</select>
      <select id="fRisco"><option value="">Risco SMPC</option><option value="critical">Crítico</option><option value="high">Alto</option><option value="medium">Médio</option><option value="low">Baixo</option><option value="neutral">Não avaliado</option></select>
      <select id="fOrgao">${options(orgaos,"Órgão")}</select>
      <select id="fEstado">${options(ufs,"UF")}</select>
      <select id="fArea">${options(areas,"Área responsável")}</select>
      <select id="fOrdenar"><option value="nome">Ordenar: nome</option><option value="risco">Maior risco</option><option value="pendencias">Mais pendências</option><option value="prazo">Prazo mais próximo</option></select>
      <div class="view-toggle" aria-label="Alternar visualização"><button class="toggle-btn ${PROJECT_VIEW_MODE==="cards"?"active":""}" data-viewmode="cards">${icon("grid")} Cards</button><button class="toggle-btn ${PROJECT_VIEW_MODE==="table"?"active":""}" data-viewmode="table">${icon("list")} Tabela</button></div>
    </div>
    <div id="projectResults"></div>
  `;
}

function filtrarProjetos() {
  const busca = (document.getElementById("fBusca")?.value || "").toLowerCase().trim();
  const situacao = document.getElementById("fSituacao")?.value || "";
  const risco = document.getElementById("fRisco")?.value || "";
  const orgao = document.getElementById("fOrgao")?.value || "";
  const estado = document.getElementById("fEstado")?.value || "";
  const area = document.getElementById("fArea")?.value || "";
  const ordem = document.getElementById("fOrdenar")?.value || "nome";

  let lista = ENTIDADES.filter(p => {
    const alvo = `${p.nome} ${p.orgaoFinanciador||""} ${p.numeroProposta||""} ${p.programa||""}`.toLowerCase();
    if (busca && !alvo.includes(busca)) return false;
    if (situacao && (p.faseAtual || p.situacaoAdministrativa) !== situacao) return false;
    if (risco && riskClass(p._score) !== risco) return false;
    if (orgao && p.orgaoFinanciador !== orgao) return false;
    if (estado && p.estadoTerritorio !== estado) return false;
    if (area && p.areaResponsavel !== area) return false;
    return true;
  });

  const riskRank = {critical:0,high:1,medium:2,low:3,neutral:4};
  if (ordem === "risco") lista.sort((a,b)=>(riskRank[riskClass(a._score)]??9)-(riskRank[riskClass(b._score)]??9));
  else if (ordem === "pendencias") lista.sort((a,b)=>(b._alertasCount||0)-(a._alertasCount||0));
  else if (ordem === "prazo") lista.sort((a,b)=>{
    const oa=proximaObrigacao(a)?.prazo||"9999-12-31"; const ob=proximaObrigacao(b)?.prazo||"9999-12-31"; return oa.localeCompare(ob);
  });
  else lista.sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR"));
  return lista;
}

function projectTable(lista) {
  return `<div class="table-shell"><div class="table-scroll"><table><thead><tr><th>Projeto</th><th>Situação</th><th>Órgão</th><th>Execução</th><th>Risco SMPC</th><th>Área</th><th>Próximo prazo</th><th>Ação</th></tr></thead><tbody>
    ${lista.map(p=>{
      const o=proximaObrigacao(p); const sistema=sistemaConfirmadoDoProjeto(p);
      return `<tr><td><button class="table-project-link" data-project="${esc(p.id)}">${esc(p.nome)}</button></td><td>${esc(p.faseAtual||p.situacaoAdministrativa||NI)}</td><td>${esc(p.orgaoFinanciador||NI)}</td><td>${execucaoDoProjeto(p)==null?NI:fmtPct(execucaoDoProjeto(p))}</td><td>${riskBadge(p._score)}</td><td>${esc(p.areaResponsavel||NI)}</td><td>${o?`${fmtData(o.prazo)}${diasAte(o.prazo)<0?" · vencido":""}`:NI}</td><td><div class="project-actions"><button class="btn btn-secondary" data-project="${esc(p.id)}">Ver ficha</button>${sistema?externalLink(sistema.paginaUrl,"Abrir"):""}</div></td></tr>`;
    }).join("")}
  </tbody></table></div></div>`;
}

function renderProjectResults() {
  const host=document.getElementById("projectResults");
  if(!host) return;
  const lista=filtrarProjetos();
  if(!lista.length){host.innerHTML=emptyState("Nenhum projeto corresponde aos filtros aplicados.");return;}
  host.innerHTML=PROJECT_VIEW_MODE==="table"?projectTable(lista):`<div class="project-grid">${lista.map(projectCard).join("")}</div>`;
  bindProjectLinks(host);
}

// ---------------------------------------------------------------- SISTEMAS DOS PROJETOS

function conciliacaoDoSistema(id) {
  const sistema = SISTEMAS_ATIVOS.find(s => s.id === id);
  if (sistema?.confirmado && sistema?.monitoramentoIdConfirmado) {
    return {
      sistemaId: id,
      monitoramentoId: sistema.monitoramentoIdConfirmado,
      candidatos: [sistema.monitoramentoIdConfirmado],
      classificacao: "VINCULO_EXATO",
      criterio: "Vínculo confirmado humanamente na planilha institucional"
    };
  }
  return CONCILIACAO.sistemasXmonitoramento.find(r=>r.sistemaId===id) || null;
}

function reconciliationBadge(r) {
  if(!r) return `<span class="mini-badge sem">Sem análise</span>`;
  if(r.classificacao==="VINCULO_EXATO") return `<span class="mini-badge exato">Vínculo exato</span>`;
  if(r.classificacao==="VINCULO_PROVAVEL") return `<span class="mini-badge provavel">Vínculo provável</span>`;
  if(r.classificacao==="AMBIGUO") return `<span class="mini-badge ambiguo">Ambíguo</span>`;
  return `<span class="mini-badge sem">Sem correspondência</span>`;
}

function viewSistemas() {
  return `
    ${pageHead("Sistemas dos Projetos", "Acesso direto aos sistemas específicos já existentes. Esses acessos são preservados independentemente da validação dos vínculos com o portfólio.", `<span class="mini-badge exato">${SISTEMAS_ATIVOS.length} sistemas</span>`)}
    <div class="notice info" style="margin-bottom:16px"><strong>Regra de acesso:</strong> esta tela é o catálogo oficial dos sistemas existentes. O acesso direto não confirma, por si só, o vínculo com um registro do Monitoramento.</div>
    <div class="system-grid">
      ${SISTEMAS_ATIVOS.map(s=>{
        const r=conciliacaoDoSistema(s.id);
        const desc=s.subtitulo||"Sistema específico do projeto";
        return `<article class="system-card"><div class="system-card-head"><div class="system-icon">${icon("systems")}</div>${reconciliationBadge(r)}</div><h3>${esc(s.nome)}</h3><p>${esc(desc)}</p><div class="system-actions"><span style="font-size:9px;color:var(--muted-2)">${r?.classificacao==="AMBIGUO"?"Vínculo requer decisão humana":r?.classificacao==="VINCULO_PROVAVEL"?"Vínculo ainda não confirmado":"Acesso preservado"}</span>${externalLink(s.paginaUrl,"Acessar sistema")}</div></article>`;
      }).join("")}
    </div>`;
}

// ---------------------------------------------------------------- FICHA DO PROJETO

function detailTabs(p) {
  const counts={
    execucao:EXECUCAO_FISICA.filter(x=>x.projetoId===p.id).length,
    evidencias:EVIDENCIAS.filter(x=>x.projetoId===p.id).length,
    obrigacoes:OBRIGACOES.filter(x=>x.projetoId===p.id).length,
    diligencias:DILIGENCIAS.filter(x=>x.projetoId===p.id).length,
    riscos:RISCOS.filter(x=>x.projetoId===p.id).length,
    historico:TRILHA_AUDITORIA.filter(x=>x.projetoId===p.id).length
  };
  const tabs=[{id:"visao",label:"Visão Geral",show:true},{id:"execucao",label:"Execução",show:counts.execucao>0},{id:"evidencias",label:"Evidências",show:counts.evidencias>0},{id:"obrigacoes",label:"Obrigações",show:counts.obrigacoes>0},{id:"diligencias",label:"Diligências",show:counts.diligencias>0},{id:"riscos",label:"Riscos",show:counts.riscos>0},{id:"historico",label:"Histórico",show:counts.historico>0}].filter(t=>t.show);
  if(!tabs.some(t=>t.id===ACTIVE_DETAIL_TAB)) ACTIVE_DETAIL_TAB="visao";
  return tabs.map(t=>`<button class="detail-tab ${ACTIVE_DETAIL_TAB===t.id?"active":""}" data-detailtab="${t.id}">${t.label}</button>`).join("");
}

function infoRows(rows) {
  return `<div class="info-list">${rows.map(([l,v])=>`<div class="info-row"><div class="label">${esc(l)}</div><div class="value">${v==null||v===""?NI:v}</div></div>`).join("")}</div>`;
}

function detailOverview(p) {
  const sistema=sistemaConfirmadoDoProjeto(p);
  const sugestoes=sistemasSugeridosParaProjeto(p);
  const origem=p.origem||NI;
  return `<div class="info-grid">
    <div class="info-card"><h3>Identificação e acompanhamento</h3>${infoRows([
      ["Órgão / financiador",esc(p.orgaoFinanciador||NI)],
      ["Programa",esc(p.programa||NI)],
      ["Proposta / instrumento",esc(p.numeroProposta||p.codigoInstrumento||NI)],
      ["Fase atual",esc(p.faseAtual||NI)],
      ["Situação administrativa",esc(p.situacaoAdministrativa||NI)],
      ["Área responsável",esc(p.areaResponsavel||NI)],
      ["Início da execução",fmtData(p.dataInicioExecucao)],
      ["Fim previsto",fmtData(p.dataFimExecucao)]
    ])}</div>
    <div class="info-card"><h3>Rastreabilidade e sistema específico</h3>${infoRows([
      ["Origem consolidada",esc(origem)],
      ["Cadastro associado",esc(p._cadastroId||NI)],
      ["Monitoramento associado",esc(p._monitoramentoId||NI)],
      ["Sistema confirmado",sistema?esc(sistema.nome):"Não associado"],
      ["Última atualização",p.ultimaAtualizacao?fmtData(p.ultimaAtualizacao):"Não informada"],
      ["Risco declarado na fonte",esc(p.riscoDeclaradoNaFonte||NI)],
      ["Classificação calculada",esc(p._score.classificacao||NI)]
    ])}
    ${!sistema&&sugestoes.length?`<div class="notice validation" style="margin-top:13px"><strong>Vínculo aguardando validação:</strong> ${sugestoes.map(x=>esc(x.sistema.nome)).join(", ")}. Nenhum acesso foi associado automaticamente a esta ficha.</div>`:""}</div>
  </div>`;
}

function detailExecucao(p) {
  const dados=EXECUCAO_FISICA.filter(x=>x.projetoId===p.id);
  if(!dados.length) return emptyState("Nenhum registro de execução física disponível para esta ficha.");
  return simpleTable(dados,[
    {label:"Indicador",value:d=>esc(d.indicador||d.meta||NI)},
    {label:"Previsto",value:d=>esc(d.quantidadePrevista??NI)},
    {label:"Realizado",value:d=>esc(d.quantidadeRealizada??NI)},
    {label:"Situação",value:d=>esc(d.situacao||NI)},
    {label:"Data prevista",value:d=>fmtData(d.dataPrevista)},
    {label:"Origem",value:d=>esc(d._origem||NI)}
  ]);
}

function detailEvidencias(p) {
  const dados=EVIDENCIAS.filter(x=>x.projetoId===p.id);
  if(!dados.length) return emptyState("Nenhum registro de evidência disponível para esta ficha.");
  return simpleTable(dados,[
    {label:"Entrega",value:d=>esc(d.entrega||NI)},
    {label:"Status original",value:d=>esc(d.statusEvidenciaOriginal||NI)},
    {label:"Status temporal",value:d=>esc(d.statusTemporal||NI)},
    {label:"Status validado",value:d=>esc(d.status||"Não validado")},
    {label:"Origem",value:d=>esc(d._origem||NI)}
  ]);
}

function detailObrigacoes(p) {
  const dados=OBRIGACOES.filter(x=>x.projetoId===p.id);
  if(!dados.length) return emptyState("Nenhuma obrigação disponível para esta ficha.");
  return simpleTable(dados,[
    {label:"Obrigação",value:d=>esc(d.obrigacao||NI)},
    {label:"Prazo",value:d=>fmtData(d.prazo)},
    {label:"Status",value:d=>esc(d.status||NI)},
    {label:"Área responsável",value:d=>esc(d.responsavel||NI)},
    {label:"Comprovação",value:d=>d.protocoloComprovante?esc(d.protocoloComprovante):"Não registrada"},
    {label:"Origem",value:d=>esc(d._origem||d.origemObrigacao||NI)}
  ]);
}

function detailDiligencias(p) {
  const dados=DILIGENCIAS.filter(x=>x.projetoId===p.id);
  if(!dados.length) return emptyState("Nenhuma diligência disponível para esta ficha.");
  return simpleTable(dados,[
    {label:"Ofício / diligência",value:d=>esc(d.numero||d.id||NI)},
    {label:"Prazo",value:d=>fmtData(d.prazo)},
    {label:"Status",value:d=>esc(d.status||NI)},
    {label:"Responsável",value:d=>esc(d.responsavel||NI)}
  ]);
}

function detailRiscos(p) {
  const dados=RISCOS.filter(x=>x.projetoId===p.id);
  if(!dados.length) return emptyState("Nenhum risco ou não conformidade disponível para esta ficha.");
  return simpleTable(dados,[
    {label:"Tipo",value:d=>esc(d.tipo||NI)},
    {label:"Risco declarado",value:d=>esc(d.riscoDeclaradoNaFonte||NI)},
    {label:"Impacto calculado",value:d=>esc(d.impacto||NI)},
    {label:"Criticidade humana",value:d=>esc(d.criticidade||"Não definida")},
    {label:"Situação",value:d=>esc(d.situacao||NI)},
    {label:"Origem",value:d=>esc(d._origem||NI)}
  ]);
}

function detailHistorico(p) {
  const dados=TRILHA_AUDITORIA.filter(x=>x.projetoId===p.id);
  if(!dados.length) return emptyState("Nenhuma alteração registrada na trilha de auditoria para esta ficha.");
  return simpleTable(dados,[
    {label:"Data/hora",value:d=>esc(d.dataHora||d.data||NI)},
    {label:"Campo",value:d=>esc(d.campo||NI)},
    {label:"Valor anterior",value:d=>esc(d.valorAnterior||NI)},
    {label:"Valor novo",value:d=>esc(d.valorNovo||NI)},
    {label:"Origem",value:d=>esc(d.origem||NI)}
  ]);
}

function detailPanel(p) {
  if(ACTIVE_DETAIL_TAB==="execucao") return detailExecucao(p);
  if(ACTIVE_DETAIL_TAB==="evidencias") return detailEvidencias(p);
  if(ACTIVE_DETAIL_TAB==="obrigacoes") return detailObrigacoes(p);
  if(ACTIVE_DETAIL_TAB==="diligencias") return detailDiligencias(p);
  if(ACTIVE_DETAIL_TAB==="riscos") return detailRiscos(p);
  if(ACTIVE_DETAIL_TAB==="historico") return detailHistorico(p);
  return detailOverview(p);
}

function viewProjetoDetalhe(id) {
  const p=projetoPorId(id);
  if(!p || !p._entidadeConfirmada) return `${pageHead("Projeto não localizado","O registro solicitado não está disponível como entidade confirmada no portfólio.")} ${emptyState("Volte à tela Projetos e selecione uma ficha disponível.")}`;
  const sistema=sistemaConfirmadoDoProjeto(p);
  const sugestoes=sistemasSugeridosParaProjeto(p);
  const exec=execucaoDoProjeto(p);
  const obrig=proximaObrigacao(p);
  const ev=evidenciaDoProjeto(p);
  return `
    <div class="detail-hero">
      <div><div class="detail-kicker">Ficha executiva do projeto</div><h2 class="detail-title">${esc(p.nome)}</h2><div class="detail-meta"><span><strong>Situação:</strong> ${esc(p.faseAtual||p.situacaoAdministrativa||NI)}</span><span><strong>Órgão:</strong> ${esc(p.orgaoFinanciador||NI)}</span><span><strong>UF:</strong> ${esc(p.estadoTerritorio||NI)}</span><span><strong>Área:</strong> ${esc(p.areaResponsavel||NI)}</span><span><strong>Atualização:</strong> ${p.ultimaAtualizacao?fmtData(p.ultimaAtualizacao):"não informada"}</span></div></div>
      <div class="detail-actions">${sistema?externalLink(sistema.paginaUrl,"Abrir sistema do projeto"): `<span class="btn btn-outline disabled">Sistema não associado</span>`}<button class="btn btn-secondary" data-go="projetos">← Voltar aos projetos</button>${!sistema&&sugestoes.length?`<div class="detail-actions-note">Há sugestão de vínculo, mas o acesso permanece bloqueado nesta ficha até validação humana.</div>`:""}</div>
    </div>
    <div class="detail-kpis">
      <div class="detail-kpi"><div class="label">Execução física</div><div class="value">${exec==null?NI:fmtPct(exec)}</div></div>
      <div class="detail-kpi"><div class="label">Evidências</div><div class="value">${esc(ev)}</div></div>
      <div class="detail-kpi"><div class="label">Risco calculado</div><div class="value">${riskBadge(p._score)}</div></div>
      <div class="detail-kpi"><div class="label">Próximo prazo monitorado</div><div class="value">${obrig?fmtData(obrig.prazo):NI}</div></div>
    </div>
    <div class="detail-tabs" id="detailTabs">${detailTabs(p)}</div>
    <div class="detail-panel" id="detailPanel">${detailPanel(p)}</div>
  `;
}

// ---------------------------------------------------------------- TABELAS E MÓDULOS

function simpleTable(dados,colunas) {
  if(!dados.length) return emptyState("Nenhum registro disponível.");
  return `<div class="table-shell"><div class="table-scroll"><table><thead><tr>${colunas.map(c=>`<th>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>${dados.map(d=>`<tr>${colunas.map(c=>`<td>${c.value?c.value(d):esc(d[c.key]??NI)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
}

function viewObrigacoes() {
  const dados=OBRIGACOES.map(o=>({...o,_proj:nomeDoProjeto(o.projetoId)}));
  return `${pageHead("Obrigações","Agenda institucional de prazos registrados, sem presumir cumprimento na ausência de protocolo ou comprovante.")}${simpleTable(dados,[
    {label:"Projeto",value:d=>`<button class="table-project-link" data-project="${esc(d.projetoId)}">${esc(d._proj)}</button>`},
    {label:"Obrigação",value:d=>esc(d.obrigacao||NI)},
    {label:"Prazo",value:d=>fmtData(d.prazo)},
    {label:"Status",value:d=>esc(d.status||NI)},
    {label:"Área responsável",value:d=>esc(d.responsavel||NI)},
    {label:"Origem",value:d=>esc(d._origem||d.origemObrigacao||NI)}
  ])}`;
}

function viewDiligencias() {
  return `${pageHead("Diligências","Acompanhamento de questionamentos e prazos formalmente registrados.")}${DILIGENCIAS.length?simpleTable(DILIGENCIAS,[
    {label:"Projeto",value:d=>esc(nomeDoProjeto(d.projetoId))},{label:"Ofício / diligência",value:d=>esc(d.numero||d.id||NI)},{label:"Prazo",value:d=>fmtData(d.prazo)},{label:"Status",value:d=>esc(d.status||NI)},{label:"Responsável",value:d=>esc(d.responsavel||NI)}
  ]):emptyState("Nenhuma diligência cadastrada até o momento. O módulo permanece pronto para registros futuros.")}`;
}

function viewEvidencias() {
  const dados=EVIDENCIAS.map(e=>({...e,_proj:nomeDoProjeto(e.projetoId)}));
  return `${pageHead("Evidências","Leitura separada entre status original, condição temporal e validação humana.")}${simpleTable(dados,[
    {label:"Projeto",value:d=>`<button class="table-project-link" data-project="${esc(d.projetoId)}">${esc(d._proj)}</button>`},{label:"Entrega",value:d=>esc(d.entrega||NI)},{label:"Status original",value:d=>esc(d.statusEvidenciaOriginal||NI)},{label:"Status temporal",value:d=>esc(d.statusTemporal||NI)},{label:"Status validado",value:d=>esc(d.status||"Não validado")},{label:"Origem",value:d=>esc(d._origem||NI)}
  ])}`;
}

function viewRiscos() {
  const dados=RISCOS.map(r=>({...r,_proj:nomeDoProjeto(r.projetoId)}));
  return `${pageHead("Riscos","Risco declarado na fonte e interpretações do SMPC permanecem visualmente separados.")}${simpleTable(dados,[
    {label:"Projeto",value:d=>`<button class="table-project-link" data-project="${esc(d.projetoId)}">${esc(d._proj)}</button>`},{label:"Tipo",value:d=>esc(d.tipo||NI)},{label:"Risco declarado",value:d=>esc(d.riscoDeclaradoNaFonte||NI)},{label:"Impacto calculado",value:d=>esc(d.impacto||NI)},{label:"Criticidade humana",value:d=>esc(d.criticidade||"Não definida")},{label:"Situação",value:d=>esc(d.situacao||NI)},{label:"Origem",value:d=>esc(d._origem||NI)}
  ])}`;
}

function viewRelatorios() {
  return `${pageHead("Relatórios","Visões executivas prontas para impressão ou salvamento em PDF.",`<button class="btn btn-accent" id="printButton">Imprimir / Salvar PDF</button>`)}
    <div class="notice info" style="margin-bottom:14px">Os relatórios refletem apenas os dados disponíveis nesta versão. Informações ausentes permanecem explicitamente identificadas.</div>
    ${simpleTable(ENTIDADES,[
      {label:"Projeto",value:p=>esc(p.nome)},{label:"Situação",value:p=>esc(p.faseAtual||p.situacaoAdministrativa||NI)},{label:"Execução física",value:p=>execucaoDoProjeto(p)==null?NI:fmtPct(execucaoDoProjeto(p))},{label:"Classificação SMPC",value:p=>riskBadge(p._score)},{label:"Risco declarado",value:p=>esc(p.riscoDeclaradoNaFonte||NI)},{label:"Motivo / qualidade do cálculo",value:p=>esc((p._score.motivos||[]).join(" · ")||NI)}
    ])}`;
}

// ---------------------------------------------------------------- MODO AUDITOR

function auditItem(a) {
  const p=projetoPorId(a.projetoId);
  return `<div class="audit-item ${classNivel(a.nivel)}"><div class="audit-level">${esc(a.nivel)}<br>${esc(a.origem)}</div><div class="audit-main"><strong>${esc(a.titulo)}</strong><span>${esc(a.detalhe)}</span></div><div class="audit-ref">${p?esc(p.nome):"Sem projeto associado"}${p?`<br><button class="text-link" data-project="${esc(p.id)}">Abrir ficha →</button>`:""}</div></div>`;
}

function viewModoAuditor() {
  const ordem={"CRÍTICO":0,"REQUER VALIDAÇÃO":1,"ATENÇÃO":2,"RISCO DOCUMENTAL":3,"INFORMAÇÃO INCOMPLETA":4,"INFORMAÇÃO":5};
  const lista=[...TODOS_ALERTAS].sort((a,b)=>(ordem[a.nivel]??9)-(ordem[b.nivel]??9));
  const n=(nivel)=>lista.filter(a=>a.nivel===nivel).length;
  return `${pageHead("Modo Auditor","Visão de inspeção: exceções, origem do dado, prazo e necessidade de validação aparecem antes dos elementos gerenciais.")}
    <div class="audit-summary">
      <div class="audit-summary-card critical"><div class="num">${n("CRÍTICO")}</div><div class="lbl">Exceções críticas</div></div>
      <div class="audit-summary-card validation"><div class="num">${n("REQUER VALIDAÇÃO")}</div><div class="lbl">Divergências entre fontes</div></div>
      <div class="audit-summary-card"><div class="num">${n("ATENÇÃO")+n("RISCO DOCUMENTAL")}</div><div class="lbl">Itens de atenção</div></div>
      <div class="audit-summary-card"><div class="num">${TRILHA_AUDITORIA.length}</div><div class="lbl">Registros na trilha</div></div>
    </div>
    <div class="audit-list">${lista.length?lista.map(auditItem).join(""):emptyState("Nenhuma exceção ou pendência gerada com os dados atuais.")}</div>
    <section class="section"><div class="section-head"><div><div class="section-title">Trilha de Auditoria</div><div class="section-sub">Histórico de alterações relevantes quando houver registro explícito</div></div></div>${TRILHA_AUDITORIA.length?simpleTable(TRILHA_AUDITORIA,[{label:"Data/hora",key:"dataHora"},{label:"Projeto",value:d=>esc(nomeDoProjeto(d.projetoId))},{label:"Campo",key:"campo"},{label:"Anterior",key:"valorAnterior"},{label:"Novo",key:"valorNovo"}]):emptyState("Nenhuma alteração registrada na trilha até o momento.")}</section>`;
}

// ---------------------------------------------------------------- CONCILIAÇÃO

function badgeConciliacao(cls) {
  if(cls==="VINCULO_EXATO") return `<span class="mini-badge exato">Vínculo exato</span>`;
  if(cls==="VINCULO_PROVAVEL") return `<span class="mini-badge provavel">Vínculo provável</span>`;
  if(cls==="AMBIGUO") return `<span class="mini-badge ambiguo">Ambíguo</span>`;
  return `<span class="mini-badge sem">Sem correspondência</span>`;
}

function reconcileTable(rows,type) {
  if(!rows.length) return emptyState("Nenhum registro nesta classificação.");
  if(type==="cad") return simpleTable(rows,[
    {label:"Fonte Cadastro",value:r=>esc(r.cadastroId)},{label:"Fonte Monitoramento",value:r=>r.monitoramentoId?esc(`${r.monitoramentoId} — ${MONITORAMENTO_ATIVO.find(m=>m.id===r.monitoramentoId)?.nomeProjeto||""}`):"—"},{label:"Critério",value:r=>esc(r.criterio||NI)},{label:"Confiança",value:r=>badgeConciliacao(r.classificacao)},{label:"Divergência / ação",value:r=>(r.divergencias||[]).length?(r.divergencias||[]).map(d=>`<strong>${esc(d.aviso)}</strong><br>${esc(d.campo)}: Cadastro “${esc(d.cadastro)}”; Monitoramento “${esc(d.monitoramento)}”`).join("<br><br>"):"Nenhuma divergência registrada"}
  ]);
  return simpleTable(rows,[
    {label:"Sistema",value:r=>esc(SISTEMAS_ATIVOS.find(s=>s.id===r.sistemaId)?.nome||r.sistemaId)},{label:"Candidato(s) em Monitoramento",value:r=>(r.candidatos||[]).map(c=>`${esc(c)} — ${esc(MONITORAMENTO_ATIVO.find(m=>m.id===c)?.nomeProjeto||"")}`).join("<br>")||"—"},{label:"Critério",value:r=>esc(r.criterio||NI)},{label:"Confiança",value:r=>badgeConciliacao(r.classificacao)},{label:"Ação necessária",value:r=>r.classificacao==="SEM_CORRESPONDENCIA"?"Analisar se existe correspondência fora dos dados disponíveis":"Validar humanamente antes de consolidar"}
  ]);
}

function reconcileFeedTable(rows) {
  if (!rows.length) return emptyState("Nenhum registro nesta classificação.");
  return simpleTable(rows,[
    {label:"Fonte A",value:r=>`${esc(r.fonteA||NI)}<br><strong>${esc(r.idA||NI)}</strong>`},
    {label:"Fonte B / candidatos",value:r=>`${esc(r.fonteB||NI)}<br>${esc(r.idBCandidatos||"—")}`},
    {label:"Critério",value:r=>esc(r.criterio||NI)},
    {label:"Classificação",value:r=>badgeConciliacao(r.classificacao)},
    {label:"Validação humana",value:r=>{
      const st=r.statusValidacao||"PENDENTE";
      const cls=st==="CONFIRMADO"?"exato":st==="REJEITADO"?"sem":"provavel";
      return `<span class="mini-badge ${cls}">${esc(st)}</span>${r.idMonitoramentoConfirmado?`<br><small>${esc(r.idMonitoramentoConfirmado)}</small>`:""}`;
    }},
    {label:"Divergência / ação",value:r=>`${r.divergencia?`<strong>${esc(r.divergencia)}</strong><br>`:""}${esc(r.acaoNecessaria||"—")}`}
  ]);
}

function viewConciliacao() {
  if (CONCILIACAO_PLANILHA.length) {
    const confirmados=CONCILIACAO_PLANILHA.filter(r=>r.statusValidacao==="CONFIRMADO");
    const provaveis=CONCILIACAO_PLANILHA.filter(r=>r.statusValidacao!=="CONFIRMADO" && r.classificacao==="VINCULO_PROVAVEL");
    const ambiguos=CONCILIACAO_PLANILHA.filter(r=>r.statusValidacao!=="CONFIRMADO" && (r.classificacao==="AMBIGUO" || /SEM_CORRESPONDENCIA/i.test(r.classificacao||"")));
    const demais=CONCILIACAO_PLANILHA.filter(r=>!confirmados.includes(r)&&!provaveis.includes(r)&&!ambiguos.includes(r));
    return `${pageHead("Conciliação","Tabela institucional de validação atualizada diretamente pela planilha no Google Drive.")}
      <div class="notice validation" style="margin-bottom:18px"><strong>Fonte viva:</strong> a tela abaixo reflete a aba 07_CONCILIACAO. Um sistema só é incorporado ao card do projeto quando STATUS_VALIDACAO = CONFIRMADO e existe um ID mon-XX confirmado.</div>
      <div class="reconcile-group"><div class="reconcile-head"><h3>Confirmados</h3><span class="reconcile-count">${confirmados.length}</span></div>${reconcileFeedTable(confirmados)}</div>
      <div class="reconcile-group"><div class="reconcile-head"><h3>Prováveis — exigem validação</h3><span class="reconcile-count">${provaveis.length}</span></div>${reconcileFeedTable(provaveis)}</div>
      <div class="reconcile-group"><div class="reconcile-head"><h3>Ambíguos / sem correspondência</h3><span class="reconcile-count">${ambiguos.length}</span></div>${reconcileFeedTable(ambiguos)}</div>
      ${demais.length?`<div class="reconcile-group"><div class="reconcile-head"><h3>Outros registros</h3><span class="reconcile-count">${demais.length}</span></div>${reconcileFeedTable(demais)}</div>`:""}`;
  }

  const cad=CONCILIACAO.cadastroXmonitoramento;
  const sis=CONCILIACAO.sistemasXmonitoramento;
  const confirmados=cad.filter(r=>r.classificacao==="VINCULO_EXATO");
  const provaveis=sis.filter(r=>r.classificacao==="VINCULO_PROVAVEL");
  const ambiguos=sis.filter(r=>r.classificacao==="AMBIGUO");
  const semCad=cad.filter(r=>r.classificacao==="SEM_CORRESPONDENCIA");
  const semSis=sis.filter(r=>r.classificacao==="SEM_CORRESPONDENCIA");
  return `${pageHead("Conciliação","Rastreabilidade entre Cadastro, Monitoramento e Sistemas específicos. Nenhum vínculo provável ou ambíguo é confirmado automaticamente.")}
    <div class="notice validation" style="margin-bottom:18px"><strong>Governança:</strong> vínculo provável e vínculo ambíguo são sugestões para análise humana. A interface não utiliza esses resultados para abrir o sistema de um projeto na ficha executiva.</div>
    <div class="reconcile-group"><div class="reconcile-head"><h3>Confirmados</h3><span class="reconcile-count">${confirmados.length}</span></div>${reconcileTable(confirmados,"cad")}</div>
    <div class="reconcile-group"><div class="reconcile-head"><h3>Prováveis — exigem validação</h3><span class="reconcile-count">${provaveis.length}</span></div>${reconcileTable(provaveis,"sis")}</div>
    <div class="reconcile-group"><div class="reconcile-head"><h3>Ambíguos</h3><span class="reconcile-count">${ambiguos.length}</span></div>${reconcileTable(ambiguos,"sis")}</div>
    <div class="reconcile-group"><div class="reconcile-head"><h3>Sem correspondência</h3><span class="reconcile-count">${semCad.length+semSis.length}</span></div>${semCad.length?reconcileTable(semCad,"cad"):""}${semSis.length?`<div style="height:10px"></div>${reconcileTable(semSis,"sis")}`:""}</div>`;
}

// ---------------------------------------------------------------- NAVEGAÇÃO

const VIEWS = {
  visaoGeral:{titulo:"Visão Geral",icon:"home",render:viewVisaoGeral,eyebrow:"SMPC"},
  projetos:{titulo:"Projetos",icon:"projects",render:viewProjetos,eyebrow:"Portfólio"},
  sistemas:{titulo:"Sistemas dos Projetos",icon:"systems",render:viewSistemas,eyebrow:"Acessos"},
  obrigacoes:{titulo:"Obrigações",icon:"calendar",render:viewObrigacoes,eyebrow:"Prazos"},
  diligencias:{titulo:"Diligências",icon:"file",render:viewDiligencias,eyebrow:"Acompanhamento"},
  evidencias:{titulo:"Evidências",icon:"check",render:viewEvidencias,eyebrow:"Rastreabilidade"},
  riscos:{titulo:"Riscos",icon:"shield",render:viewRiscos,eyebrow:"Controle"},
  conciliacao:{titulo:"Conciliação",icon:"reconcile",render:viewConciliacao,eyebrow:"Governança de dados"},
  relatorios:{titulo:"Relatórios",icon:"report",render:viewRelatorios,eyebrow:"Saídas executivas"},
  modoAuditor:{titulo:"Modo Auditor",icon:"audit",render:viewModoAuditor,eyebrow:"Inspeção"}
};

function parseRoute() {
  const raw=(location.hash||"#visaoGeral").slice(1);
  if(raw.startsWith("projeto/")) return {key:"projeto",id:decodeURIComponent(raw.slice(8))};
  return {key:VIEWS[raw]?raw:"visaoGeral",id:null};
}

function activeNavKey(route){return route.key==="projeto"?"projetos":route.key;}

function renderNav() {
  const route=parseRoute(); const atual=activeNavKey(route);
  const nav=document.getElementById("nav");
  nav.innerHTML=Object.entries(VIEWS).map(([key,v])=>`<button class="navbtn ${key==="modoAuditor"?"modo-auditor":""} ${key===atual?"active":""}" data-go="${key}"><span class="nav-icon">${icon(v.icon)}</span><span>${esc(v.titulo)}</span></button>`).join("");
}

function updateHeader(route) {
  const title=document.getElementById("pageTitle"); const eyebrow=document.getElementById("pageEyebrow");
  if(route.key==="projeto") { const p=projetoPorId(route.id); title.textContent=p?.nome||"Ficha do Projeto"; eyebrow.textContent="Projeto · SMPC"; }
  else { title.textContent=VIEWS[route.key].titulo; eyebrow.textContent=VIEWS[route.key].eyebrow; }
  document.getElementById("auditButton")?.classList.toggle("active",route.key==="modoAuditor");
}

function bindProjectLinks(root=document) {
  root.querySelectorAll("[data-project]").forEach(el=>{el.addEventListener("click",()=>{ACTIVE_DETAIL_TAB="visao";navTo(`projeto/${encodeURIComponent(el.dataset.project)}`);});});
}

function bindCommon() {
  document.querySelectorAll("[data-go]").forEach(el=>el.addEventListener("click",()=>navTo(el.dataset.go)));
  bindProjectLinks(document.getElementById("conteudo"));
}

function postRender(route) {
  bindCommon();
  if(route.key==="projetos"){
    ["fBusca","fSituacao","fRisco","fOrgao","fEstado","fArea","fOrdenar"].forEach(id=>{
      const el=document.getElementById(id); if(!el)return; el.addEventListener("input",renderProjectResults);el.addEventListener("change",renderProjectResults);
    });
    document.querySelectorAll("[data-viewmode]").forEach(btn=>btn.addEventListener("click",()=>{PROJECT_VIEW_MODE=btn.dataset.viewmode;document.querySelectorAll("[data-viewmode]").forEach(b=>b.classList.toggle("active",b.dataset.viewmode===PROJECT_VIEW_MODE));renderProjectResults();}));
    renderProjectResults();
  }
  if(route.key==="projeto"){
    document.querySelectorAll("[data-detailtab]").forEach(btn=>btn.addEventListener("click",()=>{ACTIVE_DETAIL_TAB=btn.dataset.detailtab;document.querySelectorAll("[data-detailtab]").forEach(b=>b.classList.toggle("active",b.dataset.detailtab===ACTIVE_DETAIL_TAB));const p=projetoPorId(route.id);document.getElementById("detailPanel").innerHTML=detailPanel(p);bindProjectLinks(document.getElementById("detailPanel"));}));
  }
  if(route.key==="relatorios") document.getElementById("printButton")?.addEventListener("click",()=>window.print());
}

function renderView() {
  const route=parseRoute();
  const host=document.getElementById("conteudo");
  host.innerHTML=route.key==="projeto"?viewProjetoDetalhe(route.id):VIEWS[route.key].render();
  updateHeader(route);renderNav();postRender(route);
  window.scrollTo({top:0,behavior:"instant"});
  if(window.innerWidth<=760) closeSidebar();
}

function openSidebar(){document.getElementById("sidebar")?.classList.add("open");document.getElementById("sidebarBackdrop")?.classList.add("open");}
function closeSidebar(){document.getElementById("sidebar")?.classList.remove("open");document.getElementById("sidebarBackdrop")?.classList.remove("open");}

function iniciar() {
  document.title=`${IDENTIDADE.nome} | ${IDENTIDADE.nomeCompleto}`;
  document.getElementById("menuButton")?.addEventListener("click",openSidebar);
  document.getElementById("sidebarClose")?.addEventListener("click",closeSidebar);
  document.getElementById("sidebarBackdrop")?.addEventListener("click",closeSidebar);
  document.getElementById("auditButton")?.addEventListener("click",()=>navTo("modoAuditor"));
  window.addEventListener("hashchange",renderView);
  renderView();
}

// O módulo aguarda o feed do Apps Script no topo do arquivo. Em conexões rápidas ou
// lentas, o DOMContentLoaded pode ocorrer ANTES de o módulo terminar esse await.
// Se registrássemos apenas o listener aqui, a interface poderia nunca inicializar,
// deixando apenas o shell visível. Inicializa imediatamente quando o DOM já está pronto.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", iniciar, { once: true });
} else {
  iniciar();
}
