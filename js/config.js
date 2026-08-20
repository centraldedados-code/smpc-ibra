/**
 * SMPC — Sistema de Monitoramento e Prestação de Contas
 * config.js
 *
 * Configuração principal. Nada aqui é definitivo — os pesos, prazos e regras
 * de criticidade devem ser ajustados pela coordenação/monitoramento
 * conforme a realidade de cada financiador.
 *
 * IMPORTANTE: este arquivo NÃO contém nenhum dado financeiro, nenhuma
 * credencial e nenhum segredo. Não adicione tokens, senhas ou chaves aqui —
 * este arquivo é público quando publicado no GitHub Pages.
 */

export const IDENTIDADE = {
  nome: "SMPC",
  nomeCompleto: "Sistema de Monitoramento e Prestação de Contas",
  instituicao: "Instituto BR Arte",
  cores: {
    azulPrincipal: "#092040",
    azulSecundario: "#00B7D7",
    amareloAcento: "#ECC203",
    cinzaNeutro: "#EFF1F3",
    azulEscuro: "#021738",
    branco: "#FFFFFF",
    risco: {
      baixo: "#2E7D32",
      medio: "#ECC203",
      alto: "#E9724C",
      critico: "#C62828"
    }
  }
};

/**
 * PESOS DO SCORE DE CONFORMIDADE
 * Soma deve ser 100. Modelo inicial sugerido — não é definitivo.
 * Nenhum componente financeiro.
 */
export const PESOS_SCORE = {
  execucaoFisica: 30,
  conformidadeDocumental: 25,
  evidenciasRastreabilidade: 25,
  prazosObrigacoes: 20
};

/**
 * FAIXAS DE CLASSIFICAÇÃO DE RISCO A PARTIR DO SCORE
 * (só se aplicam quando NÃO há override crítico — ver REGRAS_CRITICIDADE)
 */
export const FAIXAS_RISCO = [
  { min: 85, max: 100, classificacao: "Baixo risco", cor: "baixo" },
  { min: 65, max: 84.99, classificacao: "Risco médio", cor: "medio" },
  { min: 40, max: 64.99, classificacao: "Risco alto", cor: "alto" },
  { min: 0, max: 39.99, classificacao: "Risco crítico", cor: "critico" }
];

/**
 * REGRAS DE CRITICIDADE (OVERRIDE)
 * Qualquer condição verdadeira aqui classifica o projeto como CRÍTICO
 * independentemente do score numérico. Cada regra deve produzir um motivo
 * legível (nunca apenas "crítico" sem explicação).
 *
 * `avaliar(projeto, contexto)` deve retornar uma string com o motivo,
 * ou null se a condição não se aplica. Isso é lido por scoring.js.
 */
export const REGRAS_CRITICIDADE = [
  {
    id: "diligencia_vencida",
    descricao: "Diligência com prazo de resposta vencido",
    avaliar: (projeto, ctx) => {
      const venc = ctx.diligencias.filter(
        d => d.projetoId === projeto.id && d.status !== "Encerrada" && d.prazo && new Date(d.prazo) < ctx.hoje
      );
      if (venc.length === 0) return null;
      return `${venc.length} diligência(s) vencida(s): ${venc.map(d => d.numero || d.id).join(", ")}`;
    }
  },
  {
    id: "obrigacao_essencial_vencida",
    descricao: "Prazo de obrigação essencial vencido sem comprovação de cumprimento",
    avaliar: (projeto, ctx) => {
      const venc = ctx.obrigacoes.filter(
        o => o.projetoId === projeto.id && o.essencial === true && o.status !== "Cumprida" && o.prazo && new Date(o.prazo) < ctx.hoje
      );
      if (venc.length === 0) return null;
      return `PRAZO VENCIDO — CUMPRIMENTO NÃO COMPROVADO: ${venc.length} obrigação(ões) essencial(is) — ${venc.map(o => o.obrigacao).join(", ")}. Isto não afirma inadimplência; afirma apenas que não há, nesta base, registro de protocolo/comprovante de cumprimento.`;
    }
  },
  {
    id: "documento_obrigatorio_ausente",
    descricao: "Documento obrigatório essencial ausente",
    avaliar: (projeto, ctx) => {
      const ausentes = ctx.evidencias.filter(
        e => e.projetoId === projeto.id && e.critico === true && e.status === "Não recebida"
      );
      if (ausentes.length === 0) return null;
      return `${ausentes.length} evidência(s) crítica(s) não recebida(s): ${ausentes.map(e => e.entrega).join(", ")}`;
    }
  },
  {
    id: "evidencia_critica_inconsistente",
    descricao: "Evidência crítica identificada como inconsistente",
    avaliar: (projeto, ctx) => {
      const inconsist = ctx.evidencias.filter(
        e => e.projetoId === projeto.id && e.critico === true && e.status === "Inconsistente"
      );
      if (inconsist.length === 0) return null;
      return `${inconsist.length} evidência(s) crítica(s) inconsistente(s): ${inconsist.map(e => e.entrega).join(", ")}`;
    }
  },
  {
    id: "nao_conformidade_grave_aberta",
    descricao: "Não conformidade grave em aberto",
    avaliar: (projeto, ctx) => {
      const graves = ctx.riscos.filter(
        r => r.projetoId === projeto.id && r.tipo === "Não conformidade" && r.criticidade === "Grave" && r.situacao !== "Encerrada"
      );
      if (graves.length === 0) return null;
      return `${graves.length} não conformidade(s) grave(s) em aberto: ${graves.map(r => r.descricao).join(", ")}`;
    }
  }
];

/**
 * PRAZOS DE ALERTA (em dias) PARA OBRIGAÇÕES
 */
export const JANELAS_ALERTA = {
  vencidas: true,
  proximos7: 7,
  proximos15: 15,
  proximos30: 30
};

/**
 * DIAS SEM ATUALIZAÇÃO PARA UM PROJETO SER CONSIDERADO "SEM ATUALIZAÇÃO RECENTE"
 */
export const DIAS_SEM_ATUALIZACAO_ALERTA = 21;


/**
 * INTEGRAÇÃO DE DADOS — GOOGLE SHEETS VIA APPS SCRIPT
 *
 * Quando o Web App do Apps Script estiver publicado, preencha `appsScriptUrl`
 * e altere `usarAppsScript` para true. NÃO coloque senha, token ou credencial
 * aqui: este arquivo fica público no GitHub Pages. O endpoint publica SOMENTE
 * campos autorizados por whitelist dos módulos Projetos, Obrigações, Evidências,
 * Diligências, Riscos, Sistemas e Conciliação. O financeiro permanece bloqueado.
 */
export const INTEGRACAO_DADOS = {
  usarAppsScript: true,
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbx0L9NaKH-SzMi3-NaWFtAFMvun-efNCmfo1emqDoVxNI_tIoM-XZlc520qXi_waJk1/exec",
  timeoutMs: 8000
};

/**
 * REGISTRO DE MÓDULOS
 * Reserva técnica para expansão futura. NENHUM módulo financeiro está
 * registrado, ativo ou referenciado por qualquer view atual. Este objeto
 * existe apenas para permitir que uma versão futura registre um módulo
 * sem precisar reestruturar o app. Não adicionar entradas financeiras aqui
 * sem decisão institucional explícita.
 */
export const REGISTRO_MODULOS = {
  ativos: ["visaoGeral", "projetos", "sistemas", "obrigacoes", "diligencias", "evidencias", "riscos", "conciliacao", "relatorios", "modoAuditor"],
  reservados: [] // ex.: módulo financeiro futuro seria registrado aqui, desativado por padrão
};
