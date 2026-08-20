/**
 * VÍNCULOS CONFIRMADOS MANUALMENTE
 *
 * Este arquivo é o único lugar onde um vínculo classificado como
 * VINCULO_PROVAVEL ou AMBIGUO (ver reconciliation.js) passa a ser
 * consolidado de fato num único card de projeto. Enquanto um vínculo não
 * estiver aqui, ele aparece na view "Conciliação" como pendente — o SMPC
 * nunca funde automaticamente vínculos que não sejam identificador exato.
 *
 * Formato:
 * {
 *   tipo: "sistema-monitoramento",   // único tipo suportado nesta versão
 *   sistemaId: "sis-xxxx",            // id em projects_sistemas.js
 *   monitoramentoId: "mon-N",         // id em monitoring.js
 *   confirmado: true,
 *   confirmadoPor: "nome de quem validou",
 *   confirmadoEm: "AAAA-MM-DD",
 *   observacao: "por que esse vínculo foi considerado correto"
 * }
 *
 * PENDENTES DE VALIDAÇÃO HUMANA (gerados automaticamente pela conciliação,
 * NÃO confirmados — listados aqui apenas como referência de o que falta
 * decidir; para confirmar, copie a linha, preencha os campos e mova para
 * cima como um objeto ativo no array VINCULOS):
 *
 *  - sis-conexoes-criativas       <-> mon-15 "Conexões Criativas"          (VINCULO_PROVAVEL)
 *  - sis-conexoes-empreendedoras  <-> mon-7  "Conexão Empreendedora"       (VINCULO_PROVAVEL)
 *  - sis-cria-hub                 <-> mon-8  "Cria Hub"                    (VINCULO_PROVAVEL)
 *  - sis-jj-rj                    <-> mon-3  "Jogando Juntos RJ"           (VINCULO_PROVAVEL)
 *  - sis-jj-se                    <-> mon-18 "Jogando Juntos SE"           (VINCULO_PROVAVEL)
 *  - sis-nos-em-redes-1           <-> mon-2  "Nós em rede 1.0"             (VINCULO_PROVAVEL)
 *  - sis-nos-em-redes-2           <-> mon-11 "Nós em Rede 2.0"             (VINCULO_PROVAVEL)
 *  - sis-portas-abertas           <-> mon-4  "Portas Abertas"              (VINCULO_PROVAVEL)
 *  - sis-prospera-goias           <-> mon-13 "Prospera GO" OU mon-39       (AMBIGUO — 2 candidatos)
 *  - sis-prospera-nacional        <-> mon-21 OU mon-25                     (AMBIGUO — 2 candidatos)
 *  - sis-prospera-rio             <-> mon-14, mon-20 OU mon-44             (AMBIGUO — 3 candidatos)
 *  - sis-prospera-rs              <-> mon-12 "PROSPERA RS" OU mon-37       (AMBIGUO — 2 candidatos)
 *  - sis-prospera-turismo         <-> mon-44 "Prospera Turismo – RJ"       (VINCULO_PROVAVEL, mas conflita com sis-prospera-rio acima)
 *
 * Nenhum destes foi confirmado ainda. A lista viva computada dinamicamente
 * (para exibir na tela) vem de reconciliation.js — esta lista em comentário
 * é só um guia de leitura rápida para quem for validar.
 */
export const VINCULOS = [
  // Nenhum vínculo confirmado até o momento.
];
