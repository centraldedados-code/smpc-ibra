/**
 * MATRIZ DE EVIDÊNCIAS (item 13 do briefing). Vazio até haver dado real.
 * Existência de um arquivo NÃO equivale a evidência validada — os dois
 * conceitos são tratados por campos separados (documento/link vs. status).
 *
 * SCHEMA:
 * {
 *   id: string,
 *   projetoId: string,
 *   meta: string | null,
 *   etapa: string | null,
 *   atividade: string | null,
 *   entrega: string,
 *   evidenciaNecessaria: string,
 *   tipoEvidencia: string,
 *   periodo: string | null,
 *   quantidadePrevista: number | null,
 *   quantidadeEncontrada: number | null,
 *   documento: string | null,
 *   link: string | null,
 *   data: string | null,
 *   responsavelEnvio: string | null,
 *   responsavelValidacao: string | null,
 *   status: "Não recebida" | "Recebida" | "Em análise" | "Validada" |
 *           "Validada com ressalva" | "Inconsistente" | "Substituição solicitada",
 *   inconsistenciaIdentificada: string | null,
 *   acaoCorretiva: string | null,
 *   prazoCorrecao: string | null,
 *   observacaoTecnica: string | null,
 *   critico: boolean   // usado na regra de criticidade (config.js)
 * }
 */
export const EVIDENCIAS = [];
