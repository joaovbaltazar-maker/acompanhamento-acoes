// Avisos diários por email — executado pelo GitHub Actions (.github/workflows/avisos.yml).
// Envia via Gmail SMTP (nodemailer). Requer os secrets GMAIL_USER e GMAIL_APP_PASSWORD.
// Cada membro com email cadastrado recebe suas ações que vencem hoje ou já estão atrasadas.
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
    const accent = atrasada ? "#dc2626" : "#ea580c";
    const prio = prioLabel[a.prioridade] || a.prioridade || "—";
    const prioC = prioCor[a.prioridade] || "#6b7280";
    const prioB = prioBg[a.prioridade] || "#f3f4f6";
    const st = (colunaPorId(a.status) || {}).nome || "—";
    return '<tr><td style="padding:0 0 8px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">' +
      '<tr>' +
        '<td style="width:4px;background:' + accent + ';padding:0;font-size:0;line-height:0">&nbsp;</td>' +
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



(async () => {
  try {
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) throw new Error("Defina os secrets GMAIL_USER e GMAIL_APP_PASSWORD no repositório");

    const nodemailer = require("nodemailer");
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });

    const site = (process.env.SITE_URL || "").trim();

    const estado = carregarDados();
    const { colunaPorId, concluida } = criarHelpers(estado);
    const hoje = hojeSP();
    const diaSemana = new Date(hoje + "T12:00:00-03:00").getDay();
    if (!process.env.FORCAR && (diaSemana === 0 || diaSemana === 6)) {
      console.log("Fim de semana (" + hoje + ") — envio ignorado. Use FORCAR=1 para forçar.");
      return;
    }

    const avisaveis = estado.acoes.filter(a => emAviso(a, hoje, concluida));
    const porEmail = new Map();
    let semEmail = 0;
    for (const a of avisaveis) {
      const m = estado.membros.find(x => x.id === a.membroId);
      const email = ((m && m.email) || "").trim().toLowerCase();
      if (!email) { semEmail++; continue; }
      if (!porEmail.has(email)) porEmail.set(email, { nome: m.nome, acoes: [] });
      porEmail.get(email).acoes.push(a);
    }

    if (!porEmail.size) {
      console.log("Nada a enviar: " + avisaveis.length + " ação(ões) no radar, " + semEmail + " sem email do responsável.");
      return;
    }

    let enviados = 0;
    const erros = [];
    for (const [email, info] of porEmail) {
      info.acoes.sort((a, b) => a.prazo.localeCompare(b.prazo) || a.titulo.localeCompare(b.titulo, "pt-BR"));
      const { html, texto, assunto } = montarEmail(info.nome, info.acoes, hoje, site, colunaPorId);
      try {
        await transporter.sendMail({
          from: '"Acompanhamento de Ações" <' + user + ">",
          to: email,
          subject: assunto,
          html: html,
          text: texto,
        });
        enviados++;
        console.log("OK  " + email + " (" + info.acoes.length + " ação(ões))");
      } catch (e) {
        erros.push(email + ": " + (e && e.message ? e.message : e));
        console.error("ERRO " + email + ": " + (e && e.message ? e.message : e));
      }
    }
    console.log(JSON.stringify({ hoje, avisaveis: avisaveis.length, enviados, semEmail, erros: erros.length }));
    if (erros.length) process.exitCode = 1;
  } catch (e) {
    console.error(e && e.message ? e.message : e);
    process.exitCode = 1;
  }
})();
