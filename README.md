# 📊 Acompanhamento de Ações

Aplicação **single-file** (um único `index.html`) para o acompanhamento das ações da área: responsáveis, prazos, calendário de responsabilidades, entregas e Gantt — com várias visões para escolher, inspirada em OpenProject, Vikunja, Plane e monday.com.

✅ Arquivo único · ✅ Sem build · ✅ Funciona offline (localStorage) · ✅ Sincronização automática com o time via GitHub (grátis)

## Visões

| Visão | O que faz |
|---|---|
| **Dashboard** | KPIs (total, atrasadas, em andamento, concluídas, entregas do mês, taxa de conclusão), rosca por status, carga por responsável, listas de atrasadas e próximos 7 dias |
| **Tabela** | Planilha editável: ordenar por qualquer coluna, seleção múltipla com ações em lote, exportar/importar CSV |
| **Kanban** | Colunas de status com drag-and-drop, cores por responsável, prazo e progresso nos cards |
| **Calendário** | Mês ou semana, tarefas ocupando o período início→prazo, marcos especiais, clique no dia para criar, filtro de responsável na barra superior |
| **Gantt** | Escala dia/semana/mês, barras arrastáveis e redimensionáveis, **losangos para entregas/marcos**, setas de dependência, linha do “hoje”, agrupamento por status ou responsável |

## Recursos

- CRUD de **ações** com responsável, status, prioridade, período, progresso, tags, dependências, marcação de entrega e marco
- **Membros do time** com cor própria (aparece em cards, barras do Gantt e calendário)
- **Colunas de status** personalizáveis (nome, cor, ordem)
- Filtros globais: busca textual, responsável e prioridade
- **Template inicial** “Ações da Área” com dados de exemplo
- Exportar/importar **JSON** (backup completo) e **CSV**
- Atalhos: `N` nova ação · `/` buscar · `1`–`5` trocar visão · `Esc` fechar
- Auto-save local a cada alteração + sincronização automática com o GitHub

## Como publicar no GitHub Pages (uma vez)

1. Crie um repositório **público** no GitHub (ex.: `acompanhamento-acoes`).
2. Suba o arquivo `index.html` (e este `README.md`) para o repositório:
   ```bash
   git init
   git add index.html README.md
   git commit -m "Acompanhamento de Ações"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/acompanhamento-acoes.git
   git push -u origin main
   ```
3. No repositório: **Settings → Pages → Build and deployment → Source: Deploy from a branch → branch `main`, pasta `/root` → Save**.
4. Em poucos minutos o site estará em `https://SEU_USUARIO.github.io/acompanhamento-acoes/`.

## Como o time sincroniza (grátis, automático)

Cada integrante faz **uma única configuração** no app:

1. Abra o site e clique em **⚙️ Configurações**.
2. Crie um token em [github.com/settings/tokens/new](https://github.com/settings/tokens/new?scopes=repo&description=Acompanhamento) com o escopo **repo** marcado, copie o código.
3. Cole o token, informe seu **usuário** e o **repositório** (ex.: `acompanhamento-acoes`) e clique em **Salvar configuração**.
4. Pronto: o app baixa os dados ao abrir e envia alterações automaticamente (≈3 s após cada edição). O status fica no canto superior direito.

> O token fica salvo apenas no navegador de cada pessoa. Se duas pessoas editarem ao mesmo tempo, as alterações são **mescladas por data** — nada se perde por “último salvador”, e exclusões não ressuscitam.

### Alternativa sem GitHub
**Configurações → Exportar JSON** e troquem o arquivo entre si; **Importar JSON** carrega os dados. No mínimo, use o export como backup periódico.

## Estrutura

```
.
├── index.html   # aplicação inteira (HTML + CSS + JS)
└── README.md
```

Zero dependências externas, zero build — abre direto no navegador.

## Licença

MIT — use e adapte livremente.
