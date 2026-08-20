/**
 * EXECUÇÃO FÍSICA (item 12 do briefing).
 * Objetivo → Meta → Etapa → Atividade → Indicador → Entrega → Evidência.
 * Vazio até haver dado real. Cálculo ponderado (não média simples) quando
 * as metas tiverem pesos distintos — ver scoring.js: calcularExecucaoFisica().
 *
 * SCHEMA:
 * {
 *   id: string,
 *   projetoId: string,
 *   codigo: string,
 *   objetivo: string,
 *   meta: string,
 *   peso: number | null,          // peso relativo da meta, se aplicável
 *   indicador: string,
 *   unidadeMedida: string,
 *   quantidadePrevista: number,
 *   quantidadeRealizada: number | null,
 *   dataPrevista: string | null,
 *   dataRealizada: string | null,
 *   responsavel: string | null,
 *   situacao: "No prazo" | "Atrasada" | "Concluída" | "Não iniciada",
 *   justificativa: string | null,
 *   evidenciaVinculadaId: string | null
 * }
 */
export const EXECUCAO_FISICA = [];
