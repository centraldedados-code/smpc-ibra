# Correção de renderização — GitHub Pages

## Sintoma corrigido
A estrutura visual (sidebar/topbar/rodapé) carregava e o badge mostrava **Dados via Google Sheets**, mas o conteúdo da aplicação permanecia vazio.

## Causa
`app.js` possui um `await` de carregamento do Apps Script no topo do módulo. Em GitHub Pages, o evento `DOMContentLoaded` podia ocorrer enquanto esse `await` ainda estava em andamento. Quando o módulo retomava a execução, o listener era registrado tarde demais e `iniciar()` nunca era chamado.

## Correção
A inicialização agora verifica `document.readyState`:
- se o DOM ainda está carregando, registra `DOMContentLoaded`;
- se o DOM já está pronto, executa `iniciar()` imediatamente.

Também foi acrescentado cache-busting no CSS e no `app.js` para forçar o GitHub Pages/navegador a buscar a versão corrigida.

## Integração
A URL do Apps Script e a integração com Google Sheets permanecem ativas. Nenhuma regra de dados, score, conciliação ou sanitização foi alterada.
