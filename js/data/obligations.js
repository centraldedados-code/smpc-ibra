/**
 * OBRIGAÇÕES — agenda institucional por projeto (item 14 do briefing)
 *
 * Nenhuma fonte fornecida até o momento contém obrigações cadastradas.
 * O array abaixo está vazio deliberadamente — o SMPC não infere
 * obrigações a partir do tipo de instrumento sem parametrização
 * explícita (ver item 22: "não inventar exigência jurídica").
 *
 * SCHEMA de cada registro (preencher ao cadastrar):
 * {
 *   id: string,
 *   projetoId: string,            // referencia id em projects_cadastro.js ou projects_sistemas.js
 *   obrigacao: string,
 *   origemObrigacao: string,      // lei, cláusula do termo, ofício, etc.
 *   documentoReferencia: string,
 *   responsavel: string | null,
 *   prazo: string | null,         // ISO 8601
 *   periodicidade: string | null, // "Única" | "Mensal" | "Trimestral" | ...
 *   antecedenciaAlertaDias: number,
 *   status: "Pendente" | "Em andamento" | "Cumprida" | "Vencida",
 *   dataCumprimento: string | null,
 *   protocoloComprovante: string | null,
 *   link: string | null,
 *   essencial: boolean,           // usado na regra de criticidade (config.js)
 *   observacao: string | null
 * }
 */
export const OBRIGACOES = [];
