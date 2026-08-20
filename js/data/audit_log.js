/**
 * TRILHA DE AUDITORIA (item 18 do briefing). Vazio nesta versão — nenhuma
 * alteração ainda foi registrada por este sistema. A partir do momento em
 * que o SMPC estiver conectado a uma camada de escrita (planilha, banco,
 * formulário), cada alteração relevante deve gerar um registro aqui.
 *
 * SCHEMA:
 * {
 *   id: string,
 *   projetoId: string,
 *   dataHora: string,        // ISO 8601
 *   usuario: string,
 *   registroAlterado: string, // ex.: "Obrigação #12"
 *   campo: string,
 *   valorAnterior: string | null,
 *   valorNovo: string,
 *   justificativa: string | null,
 *   origem: string            // ex.: "Formulário", "Importação CSV", "Ajuste manual"
 * }
 */
export const TRILHA_AUDITORIA = [];
