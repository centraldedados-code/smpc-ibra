# SMPC — Sistema de Monitoramento e Prestação de Contas
## Instituto BR Arte

Versão executiva premium com integração ao Google Sheets via Apps Script.

## Arquitetura

`Google Sheets privado → Apps Script sanitizado → SMPC no GitHub Pages`

O front-end continua com fallback local sanitizado caso o endpoint esteja temporariamente indisponível.

## Módulos alimentados pela planilha

- Projetos
- Obrigações
- Evidências
- Diligências
- Riscos
- Sistemas dos Projetos
- Conciliação

O módulo financeiro permanece exclusivamente no Google Drive e não integra o payload do Apps Script.

## Acesso aos sistemas

1. **Projetos → ficha executiva → Abrir sistema do projeto**: aparece quando o vínculo estiver confirmado na planilha.
2. **Sistemas dos Projetos → Acessar sistema**: mantém o catálogo dos sistemas ativos.

## Estrutura pública

```text
index.html
assets/
  logo-instituto-br-arte.png
css/
  style.css
js/
  app.js
  config.js
  scoring.js
  alerts.js
  filters.js
  reports.js
  data/
    live_feed.js
    monitoring.js
    projects.js
    projects_cadastro.js
    projects_sistemas.js
    reconciliation.js
    vinculos.js
    derive.js
    obligations.js
    diligences.js
    evidences.js
    risks.js
    physical_execution.js
    audit_log.js
```

## Antes de publicar

Leia `LEIA_PARA_IMPLANTAR.md`. Depois de implantar o Apps Script, cole a URL `/exec` em `js/config.js` e ative `usarAppsScript: true`.

## Segurança

Não coloque no repositório:

- planilha privada;
- arquivo financeiro;
- credenciais, senhas ou tokens;
- links internos privados;
- base operacional bruta.

A logomarca oficial está em `assets/logo-instituto-br-arte.png`.
