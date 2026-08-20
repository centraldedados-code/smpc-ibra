/**
 * PROJETOS CADASTRADOS — origem: Controle e Status Projetos - 140826 (Cadastradas).csv
 *
 * Regra seguida na migração (item 26 do briefing):
 *  - Nenhuma linha foi excluída, mesmo incompleta (ver registro id 6).
 *  - Nenhum campo foi preenchido por adivinhação.
 *  - Todo campo que sofreu qualquer normalização mantém valor_original.
 *  - Campos vazios no CSV são representados como null, e a camada de
 *    apresentação (app.js) é responsável por exibir "Não informado".
 *
 * Normalizações aplicadas:
 *  - dataCadastro: formato original "DD/MM/AAAA" (string) preservado em
 *    valor_original; valor_normalizado convertido para ISO 8601 (AAAA-MM-DD)
 *    para permitir ordenação/cálculo de datas.
 */

function normalizarDataBR(dataBR) {
  if (!dataBR) return null;
  const [d, m, a] = dataBR.split("/");
  if (!d || !m || !a) return null;
  return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

const BRUTO = [
  { id: 1, emenda: "19600019", proposta: "8312/2026", estado: "RS", projeto: "PRS", dataCadastro: "11/03/2026", situacaoStatusFinal: "TERMO DE FOMENTO ASSINADO" },
  { id: 2, emenda: "19970023", proposta: "8316/2026", estado: "SP", projeto: "PSP", dataCadastro: "11/03/2026", situacaoStatusFinal: "TERMO DE FOMENTO ASSINADO" },
  { id: 3, emenda: "43530012", proposta: "8311/2026", estado: "GO", projeto: "PGO", dataCadastro: "11/03/2026", situacaoStatusFinal: "TERMO DE FOMENTO ASSINADO" },
  { id: 4, emenda: "32730012", proposta: "8320/2026", estado: "FUNARTE", projeto: "DIVERCIDADE", dataCadastro: "11/03/2026", situacaoStatusFinal: "TERMO DE FOMENTO ASSINADO" },
  { id: 5, emenda: "32730011", proposta: "8302/2026", estado: "MINC", projeto: "REDECINE", dataCadastro: "11/03/2026", situacaoStatusFinal: "PROPOSTA EM COMPLEMENTAÇÃO" },
  { id: 6, emenda: null, proposta: null, estado: "MDES", projeto: "PREFEITURA DE PORTO ALEGRE", dataCadastro: null, situacaoStatusFinal: "PROPOSTA APROVADA" }
];

export const PROJETOS_CADASTRO = BRUTO.map(r => ({
  id: `cad-${r.id}`,
  emenda: r.emenda,
  proposta: r.proposta,
  // "ESTADO" no CSV mistura UF (RS, SP, GO) com sigla de financiador
  // (FUNARTE, MINC, MDES). Preservado exatamente como está — não separado
  // em dois campos por decisão minha, pois isso seria interpretar o dado
  // original. Recomenda-se ao Instituto revisar essa coluna na origem.
  estadoOuFinanciador: { valor_original: r.estado, valor_normalizado: r.estado },
  nomeProjeto: r.projeto,
  dataCadastro: {
    valor_original: r.dataCadastro,
    valor_normalizado: normalizarDataBR(r.dataCadastro)
  },
  situacaoStatusFinal: r.situacaoStatusFinal
}));
