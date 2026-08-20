/**
 * RISCOS E NÃO CONFORMIDADES (item 16 do briefing).
 * Tratados como conceitos DISTINTOS: risco = possibilidade;
 * não conformidade = condição já identificada. Vazio até haver dado real.
 *
 * SCHEMA:
 * {
 *   id: string,
 *   projetoId: string,
 *   tipo: "Risco" | "Não conformidade",
 *   categoria: string,
 *   descricao: string,
 *   causa: string | null,
 *   consequencia: string | null,
 *   probabilidade: "Baixa" | "Média" | "Alta" | null,   // só para tipo=Risco
 *   impacto: "Baixo" | "Médio" | "Alto" | null,
 *   criticidade: "Leve" | "Moderada" | "Grave" | null,
 *   responsavel: string | null,
 *   planoAcao: string | null,
 *   prazo: string | null,
 *   situacao: "Aberta" | "Em tratamento" | "Encerrada",
 *   evidenciaCorrecao: string | null
 * }
 */
export const RISCOS = [];
