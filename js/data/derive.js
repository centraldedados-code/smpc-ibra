/**
 * derive.js
 *
 * Transcreve campos da fonte de Monitoramento (dado real e explícito) para os
 * schemas dos módulos do SMPC. Depois de uma auditoria externa (ver changelog
 * no fim do arquivo), este módulo segue um princípio único e não-negociável:
 *
 *   O sistema pode reorganizar e recalcular dados confirmados. NUNCA pode
 *   transformar ausência, atraso, conclusão de fase ou texto genérico em uma
 *   constatação mais grave ou mais favorável do que a fonte efetivamente afirma.
 *
 * Concretamente, isso proíbe:
 *  - Inferir "Prestação de Contas = Cumprida" a partir de "Status Fase = Finalizado".
 *  - Inferir "Evidência = Não recebida" a partir de "Status Evidências = Atrasado"
 *    (atraso é informação temporal, não uma constatação de ausência).
 *  - Marcar uma evidência como crítica (`critico: true`) sem informação humana
 *    específica que justifique isso.
 *  - Apagar a distinção entre "risco declarado pela fonte" e "classificação
 *    calculada pelo SMPC" — as duas ficam sempre visíveis separadamente.
 */

function parsePercentual(s) {
  if (!s) return null;
  const n = parseFloat(s.replace("%", "").replace(",", "."));
  return Number.isNaN(n) ? null : n;
}

/**
 * Mapeamento de "Risco declarado na fonte" (Alto/Médio/Baixo) para uma
 * classificação de impacto calculada pelo SMPC. Isto é uma INTERPRETAÇÃO do
 * SMPC, não um fato da planilha — por isso fica isolado aqui, documentado, e
 * a interface sempre mostra riscoDeclaradoNaFonte ao lado da classificação
 * calculada, nunca um substituindo o outro.
 */
export const TABELA_EQUIVALENCIA_RISCO_DECLARADO = {
  "ALTO": { impacto: "Alto", observacao: "Classificação calculada pelo SMPC a partir do campo 'Risco' da fonte. Não é uma constatação adicional." },
  "MÉDIO": { impacto: "Médio", observacao: "Classificação calculada pelo SMPC a partir do campo 'Risco' da fonte. Não é uma constatação adicional." },
  "MEDIO": { impacto: "Médio", observacao: "Classificação calculada pelo SMPC a partir do campo 'Risco' da fonte. Não é uma constatação adicional." },
  "BAIXO": { impacto: "Baixo", observacao: "Classificação calculada pelo SMPC a partir do campo 'Risco' da fonte. Não é uma constatação adicional." }
};

/**
 * Mapeamento CONSERVADOR de "Status Evidências" original para um status
 * temporal do SMPC. Deliberadamente NÃO usa os estados do schema canônico de
 * evidências ("Não recebida", "Validada", "Inconsistente"...) porque a fonte
 * não afirma isso — só afirma uma condição temporal (atrasado) ou uma
 * autoavaliação textual ("em conformidade"). Valores fora deste mapa são
 * passados adiante sem tradução, marcados como pendentes de padronização.
 */
const MAPA_TEMPORAL_EVIDENCIAS = {
  "ATRASADO": "Atrasada",
  "EM CONFORMIDADE": "Em conformidade"
};

/**
 * Obrigação derivada do campo "Prazo para Prestação de Contas".
 * Só gera registro quando a data está preenchida. NUNCA marca "Cumprida" —
 * a fonte não contém informação de protocolo/comprovação de entrega, então o
 * status fica sempre "Situação não comprovada" até que um dado humano
 * explícito (protocoloComprovante, dataCumprimento) seja cadastrado.
 */
export function derivarObrigacoes(monitoramento, projetoIdPorMonitoramentoId) {
  const out = [];
  monitoramento.forEach(m => {
    const projetoId = projetoIdPorMonitoramentoId(m.id);
    if (!projetoId || !m.prazoPrestacaoContas.valor_normalizado) return;
    out.push({
      id: `deriv-obr-${m.id}`,
      projetoId,
      obrigacao: "Prestação de Contas",
      origemObrigacao: "Campo 'Prazo para Prestação de Contas' — Monitoramento (derivado automaticamente)",
      documentoReferencia: null,
      responsavel: m.areaResponsavel,
      prazo: m.prazoPrestacaoContas.valor_normalizado,
      periodicidade: null,
      antecedenciaAlertaDias: 15,
      // Nunca "Cumprida" por inferência — só dado humano explícito muda isto.
      status: "Situação não comprovada",
      comprovacaoPendente: true,
      dataCumprimento: null,
      protocoloComprovante: null,
      link: null,
      essencial: true,
      observacao: `Prazo original na planilha: "${m.prazoPrestacaoContas.valor_original}". A finalização de fase de execução (quando existir) NÃO implica prestação de contas cumprida — só dado explícito de protocolo/comprovante muda este status.`,
      _origem: "Monitoramento (derivado automaticamente)"
    });
  });
  return out;
}

/**
 * Risco derivado do campo "Risco" (Alto/Médio/Baixo), só quando preenchido.
 * riscoDeclaradoNaFonte é preservado verbatim; impacto/observação vêm da
 * TABELA_EQUIVALENCIA_RISCO_DECLARADO (calculada pelo SMPC, rotulada como tal).
 * "Não conformidade" nunca é derivada aqui — a planilha não distingue risco de
 * não conformidade, e presumir isso seria interpretar o dado.
 * criticidade fica sempre null: só um humano, com base em critério formal,
 * pode elevar um risco a "Grave" — não é feito automaticamente.
 */
export function derivarRiscos(monitoramento, projetoIdPorMonitoramentoId) {
  const out = [];
  monitoramento.forEach(m => {
    const projetoId = projetoIdPorMonitoramentoId(m.id);
    if (!projetoId || !m.riscoDeclaradoNaFonte) return;
    const chave = m.riscoDeclaradoNaFonte.trim().toUpperCase();
    const equivalencia = TABELA_EQUIVALENCIA_RISCO_DECLARADO[chave] || null;
    out.push({
      id: `deriv-risco-${m.id}`,
      projetoId,
      tipo: "Risco",
      categoria: "Execução/Acompanhamento",
      riscoDeclaradoNaFonte: m.riscoDeclaradoNaFonte,
      descricao: `Classificação de risco "${m.riscoDeclaradoNaFonte}" registrada na fonte de Monitoramento` + (m.statusExecucao ? ` — status de execução informado: "${m.statusExecucao}"` : ""),
      causa: null, // texto de justificativa não é publicado nesta versão (ver monitoring.js)
      consequencia: null,
      probabilidade: null,
      impacto: equivalencia ? equivalencia.impacto : null,
      impactoObservacao: equivalencia ? equivalencia.observacao : "Valor de risco não reconhecido na tabela de equivalência — requer padronização humana.",
      criticidade: null, // nunca atribuída automaticamente — requer parametrização humana
      responsavel: m.areaResponsavel,
      planoAcao: null, // encaminhamento semanal não é publicado nesta versão (ver monitoring.js)
      prazo: null,
      situacao: /FINALIZADO/i.test(m.statusFase || "") ? "Encerrada" : "Aberta",
      evidenciaCorrecao: null,
      _origem: "Monitoramento (derivado automaticamente)"
    });
  });
  return out;
}

/**
 * Execução física derivada do campo "% Execução Real". Uma única "meta" por
 * projeto representando o percentual informado na planilha.
 */
export function derivarExecucaoFisica(monitoramento, projetoIdPorMonitoramentoId) {
  const out = [];
  monitoramento.forEach(m => {
    const projetoId = projetoIdPorMonitoramentoId(m.id);
    const pct = parsePercentual(m.percentualExecucaoReal);
    if (!projetoId || pct === null) return;
    out.push({
      id: `deriv-exec-${m.id}`,
      projetoId,
      codigo: `MON-${m.idOriginal}`,
      objetivo: m.programa || "Não informado",
      meta: "Execução real do projeto (consolidada)",
      peso: null,
      indicador: "% Execução Real (Monitoramento)",
      unidadeMedida: "%",
      quantidadePrevista: 100,
      quantidadeRealizada: pct,
      dataPrevista: m.dataFimExecucao.valor_normalizado,
      dataRealizada: null,
      responsavel: m.areaResponsavel,
      situacao: /FINALIZADO/i.test(m.statusFase || "") ? "Concluída" : (m.statusExecucao || "Não informado"),
      justificativa: m.possuiJustificativa ? "Há justificativa registrada na fonte privada (não publicada nesta versão)." : null,
      evidenciaVinculadaId: null,
      _origem: "Monitoramento (derivado automaticamente)"
    });
  });
  return out;
}

/**
 * Evidência derivada do campo "Status Evidências". Segue a regra mais
 * rigorosa desta correção:
 *  - statusEvidenciaOriginal preserva o valor exato da fonte.
 *  - statusTemporal recebe só uma tradução conservadora ("Atrasada" /
 *    "Em conformidade") ou o valor original quando não reconhecido —
 *    NUNCA um estado do schema canônico de evidências (Não recebida,
 *    Validada, Inconsistente etc.).
 *  - status (o campo canônico do schema, usado pelo cálculo de cobertura de
 *    evidências e pela regra de criticidade) fica sempre null aqui — só um
 *    registro humano explícito pode afirmar que uma evidência foi de fato
 *    recebida/validada/está inconsistente.
 *  - critico é sempre false: atraso não é, por si só, motivo para tratar uma
 *    evidência como crítica.
 */
export function derivarEvidencias(monitoramento, projetoIdPorMonitoramentoId) {
  const out = [];
  monitoramento.forEach(m => {
    const projetoId = projetoIdPorMonitoramentoId(m.id);
    if (!projetoId || !m.statusEvidenciaOriginal) return;
    const chave = m.statusEvidenciaOriginal.trim().toUpperCase();
    const statusTemporal = MAPA_TEMPORAL_EVIDENCIAS[chave] || m.statusEvidenciaOriginal;
    out.push({
      id: `deriv-evid-${m.id}`,
      projetoId,
      meta: null, etapa: null, atividade: null,
      entrega: "Evidências de execução (consolidado)",
      evidenciaNecessaria: "Comprovação de atividades/execução",
      tipoEvidencia: "Não especificado na planilha",
      periodo: null,
      quantidadePrevista: null,
      quantidadeEncontrada: null,
      documento: null,
      link: null, // link de detalhamento não é publicado nesta versão (ver monitoring.js)
      data: null,
      responsavelEnvio: null,
      responsavelValidacao: m.areaResponsavel,
      statusEvidenciaOriginal: m.statusEvidenciaOriginal,
      statusTemporal,
      status: null, // canônico — não atribuído automaticamente
      inconsistenciaIdentificada: null,
      acaoCorretiva: null,
      prazoCorrecao: null,
      observacaoTecnica: `Campo original "Status Evidências" = "${m.statusEvidenciaOriginal}". Atraso é informação temporal, não uma constatação de que a evidência não foi recebida.`,
      critico: false, // nunca atribuído automaticamente — requer parametrização humana
      _origem: "Monitoramento (derivado automaticamente)"
    });
  });
  return out;
}

/**
 * CHANGELOG DE GOVERNANÇA
 * - Correção pós-auditoria externa: removidas as inferências
 *   "Atrasado -> Não recebida" (com critico:true) e
 *   "Status Fase = Finalizado -> Prestação de Contas = Cumprida".
 *   Ambas geravam constatações mais graves ou mais favoráveis do que a fonte
 *   efetivamente afirma, e foram a causa principal dos falsos "CRÍTICO" na
 *   versão anterior.
 */
