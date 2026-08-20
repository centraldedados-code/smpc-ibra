/**
 * DILIGÊNCIAS (item 15 do briefing). Vazio até haver dado real.
 *
 * SCHEMA:
 * {
 *   id: string,
 *   projetoId: string,
 *   orgao: string,
 *   numero: string,                // nº do ofício/diligência
 *   dataRecebimento: string | null,
 *   prazo: string | null,
 *   itemQuestionado: string,
 *   responsavel: string | null,
 *   documentoSolicitado: string,
 *   documentoLocalizado: boolean | null,
 *   status: "Recebida" | "Em análise" | "Documentação em levantamento" |
 *           "Resposta em elaboração" | "Validação interna" | "Respondida" |
 *           "Complementação solicitada" | "Encerrada",
 *   respostaPreparada: boolean,
 *   dataEnvio: string | null,
 *   protocolo: string | null,
 *   pendenciaRemanescente: string | null,
 *   risco: "Baixo" | "Médio" | "Alto" | "Crítico" | null,
 *   observacao: string | null
 * }
 */
export const DILIGENCIAS = [];
