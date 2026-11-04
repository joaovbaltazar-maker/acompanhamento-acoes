# 📊 Acompanhamento de Ações

Aplicação **single-file** (um único `index.html`) para o acompanhamento das ações da área: responsáveis, prazos, calendário de responsabilidades, entregas e Gantt — com várias visões para escolher, inspirada em OpenProject, Vikunja, Plane e monday.com.

✅ Arquivo único · ✅ Sem build · ✅ Funciona offline (localStorage) · ✅ Sincronização automática com o time via GitHub (grátis)

## Visões

| Visão | O que faz |
|---|---|
| **Tabela** | Planilha editável com **árvore de sub-ações** (recolher/expandir, botão **＋ ao lado do nome**), ordenar por qualquer coluna, seleção múltipla com ações em lote, exportar/importar CSV |
| **Kanban** | Colunas de status com drag-and-drop, cores por responsável, prazo e progresso nos cards |
| **Calendário** | Mês ou semana mostrando as ações **no dia do prazo**, clique no dia para criar e painel **“Próximas entregas por responsável”** |
| **Gantt** | Escala dia/semana/mês, barras arrastáveis e redimensionáveis, linha do “hoje”, agrupamento por status ou responsável |

## Recursos

- CRUD de **ações** com responsável, status, prioridade, período e progresso
- **Sub-ações**: clique no botão **＋ à direita do nome** da ação (na Tabela) — abre o mesmo formulário de uma ação comum já vinculada ao pai; elas ficam agrupadas (recolher/expandir) e o **progresso do pai é calculado** a partir dos filhos; excluir o pai promove os filhos a itens principais
- **Membros do time** com cor própria (aparece em cards, barras do Gantt e calendário)
- **Colunas de status** personalizáveis (nome, cor, ordem)
- Filtros globais: busca textual, responsável e prioridade
- **Template inicial** “Ações da Área” com 10 ações de exemplo (incluindo sub-itens)
- Exportar/importar **JSON** (backup completo) e **CSV** (com coluna `id_pai`)
- Atalhos: `N` nova ação · `/` buscar · `1`–`4` trocar visão · `Esc` fechar
- Auto-save local a cada alteração + sincronização automática com o GitHub

## Como publicar no Vercel (uma vez)

1. Tenha o repositório no GitHub (ex.: `acompanhamento-acoes`, **público**) com o `index.html` na raiz.
2. Acesse [vercel.com](https://vercel.com) → **Log in with GitHub**.
3. **Add New… → Import Git Repository** → escolha o repositório.
4. Em *Framework Preset* deixe **Other** (sem build command, sem output dir) → **Deploy**.
5. Pronto: o site fica em `https://SEU_PROJETO.vercel.app` e **todo `git push` para `main` publica sozinho**.

> Para desativar o GitHub Pages antigo: no repositório → **Settings → Pages → Branch: None → Save**.

### Estrutura do deploy

Zero dependências externas, zero build — o Vercel serve o `index.html` direto da raiz. Não há `vercel.json` nem etapa de build.

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
