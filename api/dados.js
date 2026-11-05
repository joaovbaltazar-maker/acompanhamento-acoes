// Sincronização do Acompanhamento de Ações — proxy do GitHub Contents API.
// O token fica SOMENTE aqui (env vars do Vercel): GH_TOKEN, GH_OWNER, GH_REPO (e opcional GH_PATH).
// O navegador conversa com /api/dados sem nenhum token.
module.exports = async (req, res) => {
  const token = process.env.GH_TOKEN;
  const owner = process.env.GH_OWNER;
  const repo = process.env.GH_REPO;
  const caminho = process.env.GH_PATH || "dados.json";

  if (!token || !owner || !repo) {
    return res.status(500).json({ erro: "Variáveis GH_TOKEN, GH_OWNER e GH_REPO não configuradas no Vercel" });
  }
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const url =
    "https://api.github.com/repos/" +
    encodeURIComponent(owner) + "/" + encodeURIComponent(repo) +
    "/contents/" + caminho.split("/").map(encodeURIComponent).join("/");

  const auth = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "User-Agent": "acompanhamento-acoes",
  };

  try {
    if (req.method === "GET") {
      const r = await fetch(url, { headers: auth });
      if (r.status === 404) return res.status(404).json({ mensagem: "dados ainda não publicados" });
      if (!r.ok) return res.status(502).json({ erro: "GitHub respondeu " + r.status });
      const info = await r.json();
      return res.status(200).json({ sha: info.sha, content: info.content });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const { message, content, sha } = body;
    if (typeof message !== "string" || typeof content !== "string" || !content || content.length > 6000000) {
      return res.status(400).json({ erro: "Corpo inválido: envie {message, content, sha?}" });
    }
    const payload = { message: message.slice(0, 200), content };
    if (sha) payload.sha = sha;
    const r = await fetch(url, {
      method: "PUT",
      headers: Object.assign({}, auth, { "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
    const info = await r.json().catch(() => ({}));
    if (!r.ok) {
      return res.status(r.status >= 500 ? 502 : r.status).json({ erro: "GitHub respondeu " + r.status, detalhe: info.message });
    }
    return res.status(200).json({ content: { sha: info.content && info.content.sha } });
  } catch (e) {
    return res.status(500).json({ erro: String((e && e.message) || e) });
  }
};
