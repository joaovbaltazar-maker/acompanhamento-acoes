# 📊 Acompanhamento de Ações

Aplicação **single-file** (um único `index.html`) para o acompanhamento das ações da área: responsáveis, prazos, calendário de responsabilidades, entregas e Gantt — com várias visões para escolher, inspirada em OpenProject, Vikunja, Plane e monday.com.

✅ Arquivo único · ✅ Sem build · ✅ Funciona offline (localStorage) · ✅ Sincronização automática com o time — **ninguém precisa de token**

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
- **Membros do time** com cor própria e **email para avisos** (aparece em cards, barras do Gantt e calendário)
- **Colunas de status** personalizáveis (nome, cor, ordem)
- Filtros globais: busca textual, responsável e prioridade
- **Template inicial** “Ações da Área” com 10 ações de exemplo (incluindo sub-itens)
- Exportar/importar **JSON** (backup completo) e **CSV** (com coluna `id_pai`)
- Atalhos: `N` nova ação · `/` buscar · `1`–`4` trocar visão · `Esc` fechar
- Auto-save local a cada alteração + sincronização automática com o time (sem login nem token)

## Como publicar no Vercel (uma vez)

1. Tenha o repositório no GitHub (ex.: `acompanhamento-acoes`, **público**) com o `index.html` na raiz.
2. Acesse [vercel.com](https://vercel.com) → **Log in with GitHub**.
3. **Add New… → Import Git Repository** → escolha o repositório.
4. Em *Framework Preset* deixe **Other** (sem build command, sem output dir) → **Deploy**.
5. **Configure o token do servidor (só o administrador):** crie um PAT em [github.com/settings/tokens/new](https://github.com/settings/tokens/new?scopes=repo&description=Acompanhamento) com escopo **repo** e, em **Project → Settings → Environment Variables**, adicione:

   | Variável | Valor |
   |---|---|
   | `GH_TOKEN` | o token criado acima |
   | `GH_OWNER` | seu usuário do GitHub (ex.: `SEU_USUARIO`) |
   | `GH_REPO` | o repositório (ex.: `acompanhamento-acoes`) |

   Depois vá em **Deployments → ⋯ → Redeploy** (env vars só valem para deploys novos).
6. Pronto: o site fica em `https://SEU_PROJETO.vercel.app` e **todo `git push` para `main` publica sozinho**.

> Para desativar o GitHub Pages antigo: no repositório → **Settings → Pages → Branch: None → Save**.

### Estrutura do deploy

Zero dependências externas, zero build — o Vercel serve o `index.html` da raiz e a função `api/dados.js` (que guarda o token do GitHub como segredo do servidor). Não há `vercel.json` nem etapa de build.

## Como o time sincroniza (grátis, automático)

**Ninguém configura nada.** O token fica no servidor do Vercel (variável `GH_TOKEN`) e o navegador conversa apenas com `/api/dados`:

1. Abra o site — ele baixa os dados ao abrir e envia alterações sozinho (≈3 s após cada edição). O status fica no canto superior direito (**sincronizado** = tudo certo).
2. Pronto. Todos veem as mesmas ações no mesmo `dados.json` do repositório.

> Se duas pessoas editarem ao mesmo tempo, as alterações são **mescladas por data** — nada se perde por “último salvador”, exclusões não ressuscitam e membros/colunas são unidos registro a registro.

### Modo avançado: sincronizar direto com o GitHub

**⚙️ Configurações** aceita, opcionalmente, um token pessoal (usuário + repositório) para falar direto com a API do GitHub, sem passar pelo servidor — útil para desenvolvimento local. Deixe os campos vazio para usar o modo padrão (servidor do site).

### Alternativa sem GitHub
**Configurações → Exportar JSON** e troquem o arquivo entre si; **Importar JSON** carrega os dados. No mínimo, use o export como backup periódico.

## 🔔 Avisos por email (GitHub Actions)

Todo dia às **10h da manhã (Brasília)** um workflow do GitHub Actions lê o `dados.json`, encontra as ações que **vencem hoje** ou já estão **atrasadas** (não concluídas) e envia **um email por responsável** — só as ações dele — via [Resend](https://resend.com).

**1. Cadastre o email dos membros:** em **👥 Membros → Editar**, preencha o campo **Email (para avisos)**. Membro sem email é ignorado no envio.

**2. Configure os secrets do repositório** (GitHub → **Settings → Secrets and variables → Actions → New repository secret**):

| Secret | Valor |
|---|---|
| `GMAIL_USER` | seu email do Gmail (ex.: `joaovbaltazar@gmail.com`) |
| `GMAIL_APP_PASSWORD` | senha de app do Gmail (16 caracteres) — veja abaixo como gerar |
| `SITE_URL` | (opcional) endereço do site, usado no botão do email |

**Como gerar a senha de app do Gmail:**
1. Acesse [myaccount.google.com](https://myaccount.google.com) → **Segurança**
2. Ative a **Verificação em duas etapas** (se ainda não estiver)
3. Volte em **Segurança** → procure **Senhas de app** (ou acesse [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords))
4. Selecione **Email** e **Outro (nome personalizado)** → digite "Acompanhamento" → **Gerar**
5. Copie a senha de 16 caracteres (sem espaços) e cole no secret `GMAIL_APP_PASSWORD`

**3. Ative e teste:** vá em **Actions → Avisos por email → Enable workflow** e clique em **Run workflow** para um disparo manual de teste (o email deve chegar em minutos).

**Agenda:** `0 10 * * 1-5` em America/Sao_Paulo (10h00, seg-sex), definido em `.github/workflows/avisos.yml`. O script de envio fica em `scripts/avisos.js` (mesma lógica do app: vencidas usam progresso efetivo e coluna “Concluído”).

**Como funciona:** cada membro com email cadastrado recebe **um email individual** com suas ações que vencem hoje ou já estão atrasadas. Sem verificação de domínio, sem custo, sem envolver a TI. Limite do Gmail: 500 emails/dia (mais que suficiente para equipes pequenas).

> ⚠️ O GitHub **desativa cron automaticamente após 60 dias sem commits** no repositório — como o app gera commits a cada edição, na prática isso não costuma acontecer; se acontecer, reative em Actions → *Enable workflow*.

## Estrutura

```
.
├── index.html                     # aplicação inteira (HTML + CSS + JS)
├── api/dados.js                   # função do Vercel: proxy do GitHub com o token do servidor
├── scripts/avisos.js              # envio dos avisos diários por email (Resend)
├── .github/workflows/avisos.yml   # cron diário no GitHub Actions (8h de Brasília)
└── README.md
```

Zero dependências externas, zero build — abre direto no navegador.

## Licença

MIT — use e adapte livremente.
