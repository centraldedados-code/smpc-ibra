# SMPC — arquivos públicos do GitHub

Esta pasta é a que vai para o repositório público do SMPC.

## Antes de enviar
Você precisa ter a URL `/exec` do Apps Script.

Abra `js/config.js` e altere:

- `usarAppsScript: false` → `true`
- `appsScriptUrl: ""` → URL `/exec` copiada do Apps Script

## Estrutura
O `index.html` deve permanecer na raiz do repositório, junto das pastas `assets`, `css` e `js`.

A logomarca está em:
`assets/logo-instituto-br-arte.png`

## Atualização automática
Depois da integração, alterações autorizadas da planilha passam a aparecer ao recarregar o SMPC sem novo commit no GitHub.

## Segurança
Não enviar ao GitHub:
- planilha privada;
- módulo financeiro;
- arquivo do Drive;
- credenciais;
- tokens;
- links internos privados.
