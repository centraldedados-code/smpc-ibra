/**
 * reconciliation.js
 *
 * Concilia as TRÊS fontes distintas do SMPC:
 *   1. Cadastro   (projects_cadastro.js)   — origem: aba "Cadastradas"
 *   2. Monitoramento (monitoring.js)        — origem: aba "Status Projetos" (fonte
 *                                              principal de acompanhamento, mais detalhada)
 *   3. Sistema específico (projects_sistemas.js) — painel/URL individual do projeto
 *
 * REGRAS (definidas pelo Instituto BR Arte):
 *  - Prioridade de identificadores: proposta > instrumento > emenda > nome normalizado
 *    > órgão/UF (auxiliar).
 *  - Só vínculos por identificador numérico exato (proposta/instrumento/emenda) podem
 *    virar VINCULO_EXATO e ser consolidados automaticamente.
 *  - Vínculo por nome (mesmo idêntico) nunca vira EXATO nesta versão — vira
 *    VINCULO_PROVAVEL — porque a base já demonstra pares de projetos com nomes quase
 *    idênticos e escopos diferentes (ex.: "Prospera GO" vs "Prospera GO 2"), então
 *    similaridade de nome sozinha nunca é uma prova suficiente.
 *  - Quando há mais de um candidato plausível para o mesmo vínculo, o resultado é
 *    AMBIGUO — nenhum dos candidatos é escolhido automaticamente.
 *  - Divergências de conteúdo entre fontes (ex.: situação "assinado" numa fonte e
 *    "aprovado" noutra) são sinalizadas, nunca resolvidas silenciosamente.
 *
 * Nada aqui decide por conta própria qual fonte está "certa" — a função deste módulo
 * é classificar e expor, não resolver.
 */

// Siglas oficiais de UF — dado objetivo (não suposição), usado só para equiparar
// "Goiás" a "GO", "Rio Grande do Sul" a "RS" etc. na comparação de nomes.
const UF_POR_NOME = {
  "GOIAS": "GO", "RIO GRANDE DO SUL": "RS", "SAO PAULO": "SP", "RIO DE JANEIRO": "RJ",
  "SERGIPE": "SE", "MINAS GERAIS": "MG", "BAHIA": "BA", "PARANA": "PR",
  "SANTA CATARINA": "SC", "PERNAMBUCO": "PE", "CEARA": "CE", "ESPIRITO SANTO": "ES"
};

function substituirNomesDeUF(nomeNorm) {
  let resultado = nomeNorm;
  Object.entries(UF_POR_NOME).forEach(([nomeCompleto, sigla]) => {
    if (resultado.includes(nomeCompleto)) resultado = resultado.replace(nomeCompleto, sigla);
  });
  return resultado;
}

function normalizarTexto(s) {
  if (!s) return "";
  return s
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

/** Conciliação Cadastro (fonte 1) x Monitoramento (fonte 2), por identificador forte. */
export function conciliarCadastroComMonitoramento(cadastro, monitoramento) {
  return cadastro.map(c => {
    const propostaNorm = normalizarTexto(c.proposta);
    let match = null;
    let criterio = null;

    if (c.proposta) {
      match = monitoramento.find(m => m.codigoInstrumento && normalizarTexto(m.codigoInstrumento) === propostaNorm);
      if (match) criterio = "proposta idêntica";
    }
    // instrumento/emenda: nesta base o "Código do Pré-Instrumento/Instrumento" de
    // Monitoramento é o mesmo campo que "PROPOSTA" do Cadastro — não há coluna de
    // instrumento separada disponível. Emenda não existe em Monitoramento, então não
    // pode ser usada como critério de comparação nesta fonte.

    if (!match) {
      return { cadastroId: c.id, monitoramentoId: null, classificacao: "SEM_CORRESPONDENCIA", criterio: null, divergencias: [] };
    }

    const divergencias = [];
    const situacaoAssinada = /ASSINAD/i.test(c.situacaoStatusFinal || "");
    const faseIndicaAssinado = /EM ANDAMENTO|FINALIZADO/i.test(match.statusFase || "");
    if (situacaoAssinada && !faseIndicaAssinado) {
      divergencias.push({
        campo: "situação/fase",
        cadastro: c.situacaoStatusFinal,
        monitoramento: match.statusFase,
        aviso: "DADO_DIVERGENTE — REQUER VALIDAÇÃO"
      });
    }
    // Nota de correção: esta verificação NÃO compara "data de assinatura" com
    // "data de cadastro" — são eventos diferentes e essa comparação seria
    // semanticamente inválida (uma pessoa pode cadastrar um projeto em data
    // muito distinta da assinatura do instrumento). O que é sinalizado é
    // apenas: uma fonte afirma que o instrumento foi assinado, e a outra
    // fonte não possui nenhuma data de assinatura registrada — sem inferir
    // qual das duas está correta.
    if (situacaoAssinada && !match.dataAssinatura.valor_normalizado) {
      divergencias.push({
        campo: "comprovação de assinatura",
        cadastro: "situação informa instrumento assinado",
        monitoramento: "data de assinatura não informada",
        aviso: "REQUER VALIDAÇÃO"
      });
    }

    return {
      cadastroId: c.id,
      monitoramentoId: match.id,
      classificacao: "VINCULO_EXATO",
      criterio,
      divergencias
    };
  });
}

/** Conciliação Sistema específico (fonte 3) x Monitoramento (fonte 2), só por nome. */
// palavras sem valor discriminante para associação de projetos — mantemos siglas de
// UF (RJ, SE, GO, RS, SP...) e números de versão (1, 2, 3...), pois são exatamente o
// que distingue projetos com nomes quase idênticos (ex.: "Jogando Juntos RJ" x "SE").
const STOPWORDS = new Set(["DE", "DO", "DA", "DOS", "DAS", "E", "EM", "COM", "PARA", "A", "O"]);

function palavrasSignificativas(nomeNorm) {
  return nomeNorm.split(" ").filter(w => w.length > 0 && !STOPWORDS.has(w));
}

// singularização simples (só para fins de COMPARAÇÃO, nunca para exibição) — trata
// "Redes"/"Rede", "Conexões"/"Conexão" como a mesma palavra, sem apagar siglas de UF
// nem números de versão (que já têm 1-2 caracteres e não são afetados).
function stem(w) {
  if (w.length > 4 && w.endsWith("OES")) return w.slice(0, -3) + "AO"; // Conexões -> Conexao
  if (w.length > 3 && w.endsWith("S")) return w.slice(0, -1);          // Redes -> Rede
  return w;
}
function stemLista(palavras) {
  return palavras.map(stem);
}

export function conciliarSistemasComMonitoramento(sistemas, monitoramento) {
  return sistemas.map(s => {
    const nomeNorm = substituirNomesDeUF(normalizarTexto(s.nome));
    const palavrasS = stemLista(palavrasSignificativas(nomeNorm));
    const candidatos = monitoramento.filter(m => {
      const mn = substituirNomesDeUF(normalizarTexto(m.nomeProjeto));
      if (mn === nomeNorm) return true;
      const palavrasM = stemLista(palavrasSignificativas(mn));
      // exige que TODAS as palavras significativas (após singularização simples) de um
      // nome estejam contidas no outro, nos dois sentidos — incluindo siglas de UF e
      // números de versão, que são exatamente o que distingue projetos com nomes quase
      // idênticos (ex.: "Jogando Juntos RJ" x "...SE", "...Redes 1" x "...Redes 2").
      const contido = palavrasS.length > 0 && palavrasS.every(w => palavrasM.includes(w));
      const inverso = palavrasM.length > 0 && palavrasM.every(w => palavrasS.includes(w));
      return contido || inverso;
    });

    if (candidatos.length === 0) {
      return { sistemaId: s.id, monitoramentoId: null, classificacao: "SEM_CORRESPONDENCIA", criterio: null, candidatos: [] };
    }
    if (candidatos.length === 1) {
      return {
        sistemaId: s.id,
        monitoramentoId: candidatos[0].id,
        classificacao: "VINCULO_PROVAVEL",
        criterio: "nome aproximado, candidato único — requer confirmação humana (nunca EXATO por nome)",
        candidatos: candidatos.map(c => c.id)
      };
    }
    return {
      sistemaId: s.id,
      monitoramentoId: null,
      classificacao: "AMBIGUO",
      criterio: "mais de um candidato por nome — associação não realizada automaticamente",
      candidatos: candidatos.map(c => c.id)
    };
  });
}

/**
 * Monta a tabela de conciliação completa (as três fontes) para revisão humana.
 * Não altera nenhum dado — apenas relata.
 */
export function montarTabelaConciliacao(cadastro, sistemas, monitoramento) {
  const cadastroXmonitoramento = conciliarCadastroComMonitoramento(cadastro, monitoramento);
  const sistemasXmonitoramento = conciliarSistemasComMonitoramento(sistemas, monitoramento);

  const idsMonitoramentoVinculados = new Set(
    cadastroXmonitoramento.filter(r => r.monitoramentoId).map(r => r.monitoramentoId)
  );
  const orfaos = monitoramento.filter(m =>
    !idsMonitoramentoVinculados.has(m.id) &&
    !sistemasXmonitoramento.some(r => r.monitoramentoId === m.id || (r.candidatos || []).includes(m.id))
  );

  return { cadastroXmonitoramento, sistemasXmonitoramento, orfaos };
}
