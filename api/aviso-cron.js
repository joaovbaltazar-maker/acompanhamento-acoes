// Dispara o workflow "Avisos por email" do GitHub Actions.
//
// Chamado pelo Cron da Vercel (ver vercel.json) uma vez por dia, como uma
// terceira camada independente do agendador do GitHub — que atrasa e às vezes
// descarta execuções do `schedule`.
//
// Também pode ser chamado manualmente pelo navegador para testar:
//   https://SEU_PROJETO.vercel.app/api/aviso-cron
//
// Segurança: se a variável CRON_SECRET existir no Vercel, a Vercel envia
// automaticamente o header "Authorization: Bearer <CRON_SECRET>" e este
// endpoint exige que ele bata. Sem a variável, o endpoint fica aberto (mas o
// workflow tem trava de duplicidade, então o pior caso é um email adiantado).
module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ erro: "Método não permitido" });
  }
  res.setHeader("Cache-Control", "no-store");

  const segredo = process.env.CRON_SECRET;
  if (segredo) {
    const auth = String(req.headers.authorization || "");
    if (auth !== "Bearer " + segredo) {
      return res.status(401).json({ ok: false, erro: "não autorizado" });
    }
  }

  const token = process.env.GH_TOKEN;
  const owner = process.env.GH_OWNER;
  const repo = process.env.GH_REPO;
  const workflow = process.env.GH_WORKFLOW || "avisos.yml";
  const ref = process.env.GH_REF || "main";

  if (!token || !owner || !repo) {
    return res.status(500).json({
      ok: false,
      erro: "Variáveis GH_TOKEN, GH_OWNER e GH_REPO não configuradas no Vercel",
    });
  }

  const url =
    "https://api.github.com/repos/" +
    encodeURIComponent(owner) + "/" + encodeURIComponent(repo) +
    "/actions/workflows/" + encodeURIComponent(workflow) + "/dispatches";

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "acompanhamento-acoes",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ ref: ref }),
    });

    if (r.status === 204) {
      return res.status(200).json({
        ok: true,
        disparado: true,
        workflow: workflow,
        ref: ref,
        horario: new Date().toISOString(),
        aviso: segredo ? undefined : "Configure CRON_SECRET no Vercel para proteger este endpoint",
      });
    }

    const detalhe = await r.text().catch(() => "");
    return res.status(502).json({
      ok: false,
      erro: "GitHub respondeu " + r.status,
      detalhe: detalhe.slice(0, 400),
      dica:
        r.status === 403 || r.status === 404
          ? "O GH_TOKEN precisa de permissão para disparar workflows (token clássico: escopo 'repo' e 'workflow'; token fine-grained: Actions = Read and write)."
          : undefined,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, erro: String((e && e.message) || e) });
  }
};
