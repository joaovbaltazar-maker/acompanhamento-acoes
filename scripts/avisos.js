// Avisos diários por email — executado pelo GitHub Actions (.github/workflows/avisos.yml).
// Envia via Gmail SMTP (nodemailer). Requer os secrets GMAIL_USER e GMAIL_APP_PASSWORD.
// Cada membro com email cadastrado recebe suas ações que vencem hoje ou já estão atrasadas.
// Se o secret EMAIL_ADMIN estiver definido, envia também uma cópia consolidada para o admin.
"use strict";
const fs = require("fs");
const path = require("path");

const ARQUIVO = path.join(__dirname, "..", "dados.json");
const ROT_PRIO = { Critica: "Crítica", Alta: "Alta", Media: "Média", Baixa: "Baixa" };

function hojeSP() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}
function difDias(a, b) {
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000);
}
function fmtBR(s) {
  const p = s.split("-");
  return p[2] + "/" + p[1] + "/" + p[0];
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function carregarDados() {
  const estado = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
  if (!Array.isArray(estado.acoes)) estado.acoes = [];
  if (!Array.isArray(estado.membros)) estado.membros = [];
  if (!Array.isArray(estado.colunas)) estado.colunas = [];
  return estado;
}

function criarHelpers(estado) {
  const colunaPorId = id => estado.colunas.find(c => c.id === id) || null;
  const filhosDe = id => estado.acoes.filter(x => x.parentId === id);
  const progressoEfetivo = (a, vis) => {
    vis = vis || new Set();
    if (vis.has(a.id)) return a.progresso || 0;
    vis.add(a.id);
    const f = filhosDe(a.id);
    if (!f.length) return a.progresso || 0;
    const s = f.reduce((n, x) => n + progressoEfetivo(x, vis), 0);
    return Math.round(s / f.length);
  };
  const concluida = a => {
    if (progressoEfetivo(a) >= 100) return true;
    const col = colunaPorId(a.status);
    return !!(col && /conclu/i.test(col.nome));
  };
  return { colunaPorId, concluida };
}

function emAviso(a, hoje, concluida) {
  if (!a.prazo) return false;
  if (difDias(a.prazo, hoje) > 0) return false;
  if (concluida(a)) return false;
  return true;
}

function montarEmail(nome, acoes, hoje, site, colunaPorId) {
  const hojeN = acoes.filter(a => a.prazo === hoje).length;
  const atrasN = acoes.length - hojeN;

  const prioCor = { Critica: "#dc2626", Alta: "#ea580c", Media: "#2563eb", Baixa: "#16a34a" };
  const prioBg = { Critica: "#fef2f2", Alta: "#fff7ed", Media: "#eff6ff", Baixa: "#f0fdf4" };
  const prioLabel = { Critica: "Crítica", Alta: "Alta", Media: "Média", Baixa: "Baixa" };

  const preheader = "Você tem " + acoes.length + " ação(ões): " + hojeN + " vencem hoje" +
    (atrasN ? ", " + atrasN + " atrasada(s)" : "") + " — " + fmtBR(hoje);

  function metricCard(label, valor, cor, bg, border) {
    return '<td style="width:33%;padding:0 5px;vertical-align:top">' +
      '<div style="text-align:center;padding:16px 8px;background:' + bg + ';border:1px solid ' + border + ';border-radius:10px">' +
      '<div style="font-size:28px;font-weight:700;color:' + cor + ';line-height:1;margin-bottom:4px">' + valor + '</div>' +
      '<div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.8px;font-weight:600">' + esc(label) + '</div>' +
      '</div></td>';
  }

  function actionCard(a) {
    const d = difDias(a.prazo, hoje);
    const atrasada = d < 0;
    const diasAtraso = Math.abs(d);
    const rot = atrasada ? (diasAtraso === 1 ? "1 dia de atraso" : diasAtraso + " dias de atraso") : "Vence hoje";
    const prio = prioLabel[a.prioridade] || a.prioridade || "—";
    const prioC = prioCor[a.prioridade] || "#6b7280";
    const prioB = prioBg[a.prioridade] || "#f3f4f6";
    const st = (colunaPorId(a.status) || {}).nome || "—";
    return '<tr><td style="padding:0 0 8px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">' +
      '<tr>' +
        '<td style="padding:14px 16px;background:#ffffff">' +
          '<div style="font-size:14px;font-weight:600;color:#111827;margin-bottom:8px;line-height:1.4">' + esc(a.titulo) + '</div>' +
          '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
            '<td style="padding-right:12px;font-size:12px;color:#6b7280">📅 ' + fmtBR(a.prazo) + '</td>' +
            '<td style="padding-right:6px"><span style="display:inline-block;background:' + prioB + ';color:' + prioC + ';padding:3px 10px;border-radius:6px;font-size:11px;font-weight:600">' + esc(prio) + '</span></td>' +
            '<td><span style="display:inline-block;background:#f3f4f6;color:#4b5563;padding:3px 10px;border-radius:6px;font-size:11px">' + esc(st) + '</span></td>' +
          '</tr></table>' +
          (atrasada ? '<div style="font-size:12px;color:#dc2626;font-weight:600;margin-top:8px">⚠ ' + rot + '</div>' : '') +
        '</td>' +
      '</tr></table>' +
      '</td></tr>';
  }

  const vencemHoje = acoes.filter(a => a.prazo === hoje);
  const atrasadas = acoes.filter(a => a.prazo !== hoje);

  function section(titulo, cor, bgHeader, acoesSecao) {
    if (!acoesSecao.length) return "";
    return '<tr><td style="padding:20px 0 10px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="font-size:11px;font-weight:700;color:' + cor + ';text-transform:uppercase;letter-spacing:1px;padding-bottom:8px;border-bottom:2px solid ' + cor + '">' + esc(titulo) + ' (' + acoesSecao.length + ')</td>' +
      '</tr></table>' +
      '</td></tr>' +
      acoesSecao.map(actionCard).join("");
  }

  const html =
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased">' +
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f3f4f6">' + esc(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 0"><tr><td align="center" style="padding:0 16px">' +
    '<table role="presentation" width="580" cellpadding="0" cellspacing="0" style="max-width:580px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb">' +
    // Header
    '<tr><td style="background:#1e40af;padding:28px 32px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td><div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-.5px">Acompanhamento de Ações</div>' +
        '<div style="font-size:13px;color:rgba(255,255,255,.8);margin-top:4px">' + fmtBR(hoje) + '</div></td>' +
        '<td align="right" style="vertical-align:top"><div style="font-size:28px">📋</div></td>' +
      '</tr></table>' +
    '</td></tr>' +
    // Body
    '<tr><td style="padding:28px 32px">' +
      '<p style="font-size:15px;color:#374151;margin:0 0 20px;line-height:1.5">Olá <b style="color:#111827">' + esc(nome) + '</b>, aqui está seu resumo do dia.</p>' +
      // Metric cards
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px"><tr>' +
        metricCard("Total", acoes.length, "#111827", "#f9fafb", "#e5e7eb") +
        metricCard("Vencem hoje", hojeN, "#ea580c", "#fff7ed", "#fed7aa") +
        metricCard("Atrasadas", atrasN, "#dc2626", "#fef2f2", "#fecaca") +
      '</tr></table>' +
      // Sections
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
        section("Vencem hoje", "#ea580c", null, vencemHoje) +
        section("Atrasadas", "#dc2626", null, atrasadas) +
      '</table>' +
      // CTA
      (site ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center">' +
        '<a href="' + esc(site) + '" style="display:inline-block;background:#1e40af;color:#ffffff;padding:14px 36px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">Abrir o acompanhamento →</a>' +
        '</td></tr></table>' : '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td align="center" style="font-size:12px;color:#9ca3af">Configure o secret <b>SITE_URL</b> no GitHub para ativar o botão de acesso.</td></tr></table>') +
    '</td></tr>' +
    // Footer
    '<tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">' +
      '<p style="font-size:12px;color:#9ca3af;margin:0;line-height:1.6">' +
        'Gerado automaticamente em ' + fmtBR(hoje) + '.<br>' +
        'Para deixar de receber, remova seu email em <b style="color:#6b7280">Membros do time</b>.' +
      '</p>' +
    '</td></tr>' +
    '</table>' +
    '<p style="font-size:11px;color:#9ca3af;margin:16px 0 0;text-align:center">Acompanhamento de Ações · Rumo</p>' +
    '</td></tr></table></body></html>';

  const texto =
    "Acompanhamento de ações — " + fmtBR(hoje) + "\n\n" +
    "Olá " + nome + ", aqui está seu resumo do dia.\n\n" +
    "Total: " + acoes.length + " | Vencem hoje: " + hojeN + " | Atrasadas: " + atrasN + "\n\n" +
    (vencemHoje.length ? "=== VENCEM HOJE ===\n" + vencemHoje.map(a =>
      "- " + a.titulo + " | prazo " + fmtBR(a.prazo) + " | " + (prioLabel[a.prioridade] || a.prioridade) + " | " + ((colunaPorId(a.status) || {}).nome || "—")
    ).join("\n") + "\n\n" : "") +
    (atrasadas.length ? "=== ATRASADAS ===\n" + atrasadas.map(a =>
      "- " + a.titulo + " | prazo " + fmtBR(a.prazo) + " (" + Math.abs(difDias(a.prazo, hoje)) + " dias) | " + (prioLabel[a.prioridade] || a.prioridade) + " | " + ((colunaPorId(a.status) || {}).nome || "—")
    ).join("\n") + "\n\n" : "") +
    (site ? "Abrir: " + site + "\n" : "") +
    "\nEmail automático do Acompanhamento de Ações.";

  const emoji = atrasN > 0 ? "⚠️ " : "📋 ";
  const assunto = emoji + "Acompanhamento: " + acoes.length + " ação(ões) — " +
    (hojeN ? hojeN + " vencem hoje" : "") +
    (hojeN && atrasN ? ", " : "") +
    (atrasN ? atrasN + " atrasada(s)" : "") +
    " (" + fmtBR(hoje) + ")";

  return { html, texto, assunto };
}

// ---------------------------------------------------------------------------
// Execução
//
// Variáveis de ambiente:
//   GMAIL_USER / GMAIL_APP_PASSWORD  (obrigatórias) credenciais do Gmail
//   SITE_URL                         (opcional) botão para abrir o site
//   EMAIL_ADMIN                      (opcional) recebe uma cópia consolidada
//   FORCAR=1                         ignora fim de semana e o histórico do dia
//   DRY_RUN=1                        não envia nada, só mostra o que faria
//   HISTORICO                        caminho do arquivo que evita envio duplicado
//   GITHUB_STEP_SUMMARY / GITHUB_OUTPUT  (preenchidos pelo GitHub Actions)
// ---------------------------------------------------------------------------

function textoErro(e) {
  return e && e.message ? e.message : String(e);
}

function escreverResumo(linhas) {
  const arq = process.env.GITHUB_STEP_SUMMARY;
  if (!arq) return;
  try {
    fs.appendFileSync(arq, linhas.join("\n") + "\n");
  } catch (e) {
    // resumo é opcional: nunca deve derrubar o envio
  }
}

function saida(nome, valor) {
  const arq = process.env.GITHUB_OUTPUT;
  if (!arq) return;
  try {
    fs.appendFileSync(arq, nome + "=" + valor + "\n");
  } catch (e) {
    // idem
  }
}

const HISTORICO = (process.env.HISTORICO || "").trim();

// O histórico garante "no máximo um email por pessoa por dia", mesmo que o
// workflow rode várias vezes (tentativas do cron, push, disparo manual...).
function lerHistorico(hoje) {
  if (!HISTORICO) return new Set();
  try {
    const h = JSON.parse(fs.readFileSync(HISTORICO, "utf8"));
    if (h && h.data === hoje && Array.isArray(h.enviados)) {
      return new Set(h.enviados.map(e => String(e).trim().toLowerCase()));
    }
  } catch (e) {
    // arquivo ainda não existe — primeira execução do dia
  }
  return new Set();
}

function gravarHistorico(hoje, enviados) {
  if (!HISTORICO) return;
  try {
    fs.mkdirSync(path.dirname(HISTORICO), { recursive: true });
    fs.writeFileSync(HISTORICO, JSON.stringify({ data: hoje, enviados: Array.from(enviados) }));
  } catch (e) {
    console.error("Aviso: não foi possível gravar o histórico: " + textoErro(e));
  }
}

(async () => {
  const linhas = [];
  const anotar = m => {
    console.log(m);
    linhas.push(m);
  };
  let codigo = 0;

  try {
    const user = (process.env.GMAIL_USER || "").trim();
    const pass = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
    const site = (process.env.SITE_URL || "").trim();
    const admin = (process.env.EMAIL_ADMIN || "").trim().toLowerCase();
    const forcar = /^(1|true|sim)$/i.test(process.env.FORCAR || "");
    const simular = /^(1|true|sim)$/i.test(process.env.DRY_RUN || "");

    if (!user || !pass) {
      throw new Error(
        "Secrets ausentes: configure GMAIL_USER e GMAIL_APP_PASSWORD em " +
        "Settings → Secrets and variables → Actions."
      );
    }

    const estado = carregarDados();
    const { colunaPorId, concluida } = criarHelpers(estado);
    const hoje = hojeSP();
    const diaSemana = new Date(hoje + "T12:00:00Z").getUTCDay();

    anotar("Data de referência (America/Sao_Paulo): " + hoje);

    if (!forcar && (diaSemana === 0 || diaSemana === 6)) {
      anotar("Fim de semana — envio ignorado (use FORCAR=1 para forçar).");
      escreverResumo(["## Avisos por email — " + hoje, "", "- Fim de semana: nada enviado."]);
      saida("enviado", "false");
      return;
    }

    const avisaveis = estado.acoes.filter(a => emAviso(a, hoje, concluida));
    const semMembro = [];
    const semEmail = [];
    const porEmail = new Map();

    for (const a of avisaveis) {
      const m = estado.membros.find(x => x.id === a.membroId);
      if (!m) {
        semMembro.push(a.titulo);
        continue;
      }
      const email = String(m.email || "").trim().toLowerCase();
      if (!email) {
        semEmail.push(m.nome + " — " + a.titulo);
        continue;
      }
      if (!porEmail.has(email)) porEmail.set(email, { nome: m.nome, acoes: [] });
      porEmail.get(email).acoes.push(a);
    }

    anotar(
      "Ações vencendo hoje ou atrasadas: " + avisaveis.length +
      " · destinatários com email: " + porEmail.size +
      (semEmail.length ? " · responsáveis sem email: " + semEmail.length : "") +
      (semMembro.length ? " · ações sem responsável: " + semMembro.length : "")
    );
    semEmail.forEach(x => anotar("Sem email (ignorado): " + x));
    semMembro.forEach(x => anotar("Sem responsável (ignorado): " + x));

    // Filtra quem já recebeu hoje (retentativas do mesmo dia não duplicam email).
    const historico = lerHistorico(hoje);
    const pendentes = new Map();
    const jaEnviados = [];
    for (const [email, info] of porEmail) {
      if (!forcar && historico.has(email)) jaEnviados.push(email);
      else pendentes.set(email, info);
    }
    if (jaEnviados.length) {
      anotar("Já receberam hoje (não repete): " + jaEnviados.join(", "));
    }

    if (simular) {
      for (const [email, info] of pendentes) {
        anotar("SIMULAÇÃO: enviaria " + info.acoes.length + " ação(ões) para " + email);
      }
      if (!pendentes.size) anotar("SIMULAÇÃO: nenhum destinatário pendente.");
      escreverResumo(["## Avisos por email — " + hoje + " (simulação)", ""].concat(linhas.map(l => "- " + l)));
      saida("enviado", "false");
      return;
    }

    if (!pendentes.size) {
      anotar("Nada a enviar: nenhum destinatário pendente.");
      escreverResumo(["## Avisos por email — " + hoje, ""].concat(linhas.map(l => "- " + l)));
      saida("enviado", jaEnviados.length ? "true" : "false");
      return;
    }

    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 45000,
    });

    try {
      await transporter.verify();
      anotar("Conexão SMTP autenticada como " + user + ".");
    } catch (e) {
      throw new Error(
        "Falha ao conectar/autenticar no Gmail: " + textoErro(e) + ". " +
        "Confira se GMAIL_APP_PASSWORD é uma senha de app de 16 caracteres válida " +
        "(verificação em 2 etapas ativa) e se a conta não bloqueou o acesso."
      );
    }

    const ordenar = arr => arr.slice().sort((a, b) =>
      a.prazo.localeCompare(b.prazo) || a.titulo.localeCompare(b.titulo, "pt-BR"));

    let enviados = 0;
    const erros = [];

    async function enviar(to, nome, acoes, prefixo) {
      const { html, texto, assunto } = montarEmail(nome, ordenar(acoes), hoje, site, colunaPorId);
      let ultimoErro = null;
      for (let tentativa = 1; tentativa <= 2; tentativa++) {
        try {
          const info = await transporter.sendMail({
            from: '"Acompanhamento de Ações" <' + user + ">",
            to: to,
            replyTo: user,
            subject: (prefixo || "") + assunto,
            html: html,
            text: texto,
            headers: { "X-Auto-Response-Suppress": "All" },
          });
          enviados++;
          historico.add(to.toLowerCase());
          gravarHistorico(hoje, historico);
          const aceitos = ((info && info.accepted) || []).join(", ") || to;
          anotar("Enviado para " + to + " (" + acoes.length + " ação(ões); aceito pelo servidor: " + aceitos + ")");
          console.log("OK  " + to + " (" + acoes.length + " ação(ões)" + (prefixo ? ", cópia admin" : "") + ")");
          return;
        } catch (e) {
          ultimoErro = e;
          // Uma segunda tentativa resolve a maioria dos erros passageiros
          // (limite de conexão do Gmail, greylisting etc.).
          if (tentativa === 1) await new Promise(r => setTimeout(r, 3000));
        }
      }
      // Falhou duas vezes: registra o erro e não insiste de novo hoje para não
      // transformar um endereço inválido em 8 execuções vermelhas no Actions.
      erros.push(to + ": " + textoErro(ultimoErro));
      historico.add(to.toLowerCase());
      gravarHistorico(hoje, historico);
      console.error("ERRO " + to + ": " + textoErro(ultimoErro));
    }

    for (const [email, info] of pendentes) {
      await enviar(email, info.nome, info.acoes);
    }

    if (admin && avisaveis.length && !porEmail.has(admin) && (forcar || !historico.has(admin))) {
      await enviar(admin, "Admin", avisaveis, "[Cópia admin] ");
    }

    anotar("Resultado: " + enviados + " email(s) enviado(s), " + erros.length + " erro(s).");
    erros.forEach(e => anotar("Erro: " + e));

    escreverResumo(
      ["## Avisos por email — " + hoje, ""].concat(linhas.map(l => "- " + l))
    );

    console.log(JSON.stringify({
      hoje: hoje,
      avisaveis: avisaveis.length,
      destinatarios: porEmail.size,
      enviados: enviados,
      jaEnviadosHoje: jaEnviados.length,
      semEmail: semEmail.length,
      semMembro: semMembro.length,
      erros: erros.length,
    }));

    saida("enviado", enviados > 0 ? "true" : "false");
    if (erros.length) codigo = 1;
  } catch (e) {
    const m = textoErro(e);
    console.error(m);
    anotar("ERRO: " + m);
    escreverResumo(["## Avisos por email — falhou", "", "```", m, "```"]);
    saida("enviado", "false");
    codigo = 1;
  }

  process.exitCode = codigo;
})();
