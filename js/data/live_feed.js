/**
 * live_feed.js
 *
 * Carrega o feed sanitizado multi-módulo do Google Sheets via Apps Script.
 * Se o endpoint estiver desativado/indisponível, mantém os dados locais
 * sanitizados como fallback para o SMPC não ficar fora do ar.
 */
import { INTEGRACAO_DADOS } from "../config.js";

export async function carregarDadosSMPC(fallback = {}) {
  const base = {
    projetos: Array.isArray(fallback.projetos) ? fallback.projetos : [],
    obrigacoes: Array.isArray(fallback.obrigacoes) ? fallback.obrigacoes : [],
    evidencias: Array.isArray(fallback.evidencias) ? fallback.evidencias : [],
    diligencias: Array.isArray(fallback.diligencias) ? fallback.diligencias : [],
    riscos: Array.isArray(fallback.riscos) ? fallback.riscos : [],
    sistemas: Array.isArray(fallback.sistemas) ? fallback.sistemas : [],
    conciliacao: Array.isArray(fallback.conciliacao) ? fallback.conciliacao : [],
    origem: "Base local sanitizada",
    online: false,
    atualizadoEm: null,
    versaoFeed: null
  };

  if (!INTEGRACAO_DADOS.usarAppsScript || !INTEGRACAO_DADOS.appsScriptUrl) return base;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INTEGRACAO_DADOS.timeoutMs || 8000);
  try {
    const sep = INTEGRACAO_DADOS.appsScriptUrl.includes("?") ? "&" : "?";
    const url = `${INTEGRACAO_DADOS.appsScriptUrl}${sep}_=${Date.now()}`;
    const resp = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json?.erro) throw new Error(`${json.erro}: ${json.detalhe || "sem detalhe"}`);
    if (!Array.isArray(json?.projetos) || json.projetos.length === 0) throw new Error("Feed sem projetos");

    return {
      projetos: json.projetos,
      obrigacoes: Array.isArray(json.obrigacoes) ? json.obrigacoes : [],
      evidencias: Array.isArray(json.evidencias) ? json.evidencias : [],
      diligencias: Array.isArray(json.diligencias) ? json.diligencias : [],
      riscos: Array.isArray(json.riscos) ? json.riscos : [],
      sistemas: Array.isArray(json.sistemas) ? json.sistemas : base.sistemas,
      conciliacao: Array.isArray(json.conciliacao) ? json.conciliacao : [],
      origem: "Google Sheets · Apps Script",
      online: true,
      atualizadoEm: json?.meta?.atualizadoEm || null,
      versaoFeed: json?.meta?.versaoFeed || null
    };
  } catch (err) {
    console.warn("SMPC: falha no feed do Apps Script; usando base local sanitizada.", err);
    return base;
  } finally {
    clearTimeout(timer);
  }
}

// Compatibilidade com versões anteriores.
export async function carregarMonitoramento(fallback) {
  const data = await carregarDadosSMPC({ projetos: fallback });
  return {
    projetos: data.projetos,
    origem: data.origem,
    online: data.online,
    atualizadoEm: data.atualizadoEm
  };
}
