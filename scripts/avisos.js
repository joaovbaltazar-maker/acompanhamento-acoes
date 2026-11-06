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

  const prioCor = { Critica: "#c62828", Alta: "#e65100", Media: "#1565c0", Baixa: "#2e7d32" };
  const prioBg = { Critica: "#fce4e4", Alta: "#fff3e0", Media: "#e3f2fd", Baixa: "#e8f5e9" };

  const preheader = "Você tem " + acoes.length + " ação(ões): " + hojeN + " vencem hoje" +
    (atrasN ? ", " + atrasN + " atrasada(s)" : "") + " — " + fmtBR(hoje);

  function metricCard(label, valor, cor, bg) {
    return '<td style="text-align:center;padding:12px 6px;background:' + bg + ';border-radius:8px">' +
      '<div style="font-size:26px;font-weight:700;color:' + cor + ';line-height:1">' + valor + '</div>' +
      '<div style="font-size:10px;color:#666;margin-top:4px;text-transform:uppercase;letter-spacing:.6px">' + esc(label) + '</div></td>';
  }

  function actionCard(a) {
    const d = difDias(a.prazo, hoje);
    const atrasada = d < 0;
    const diasAtraso = Math.abs(d);
    const rot = atrasada ? (diasAtraso === 1 ? "1 dia de atraso" : diasAtraso + " dias de atraso") : "Vence hoje";
    const cor = atrasada ? "#c62828" : "#e65100";
    const prio = ROT_PRIO[a.prioridade] || a.prioridade || "—";
    const prioC = prioCor[a.prioridade] || "#555";
    const prioB = prioBg[a.prioridade] || "#f0f0f0";
    const st = (colunaPorId(a.status) || {}).nome || "—";
    return '<tr><td style="padding:0 0 10px"><div style="border-left:4px solid ' + cor + ';background:#fafafa;border-radius:0 8px 8px 0;padding:12px 14px">' +
      '<div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-bottom:6px;line-height:1.3">' + esc(a.titulo) + '</div>' +
      '<div style="font-size:12px;color:#555">' +
        '<span>📅 ' + fmtBR(a.prazo) + '</span>' +
        ' <span style="background:' + prioB + ';color:' + prioC + ';padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600;margin-left:6px">' + esc(prio) + '</span>' +
        ' <span style="background:#e8e8e8;color:#555;padding:2px 8px;border-radius:4px;font-size:11px;margin-left:4px">' + esc(st) + '</span>' +
      '</div>' +
      (atrasada ? '<div style="font-size:12px;color:#c62828;font-weight:600;margin-top:6px">⚠ ' + rot + '</div>' : '') +
      '</div></td></tr>';
  }

  const vencemHoje = acoes.filter(a => a.prazo === hoje);
  const atrasadas = acoes.filter(a => a.prazo !== hoje);

  function section(titulo, cor, acoesSecao) {
    if (!acoesSecao.length) return "";
    return '<tr><td style="padding:18px 0 8px"><div style="font-size:12px;font-weight:700;color:' + cor +
      ';text-transform:uppercase;letter-spacing:.6px;border-bottom:2px solid ' + cor +
      ';padding-bottom:6px">' + esc(titulo) + ' (' + acoesSecao.length + ')</div></td></tr>' +
      acoesSecao.map(actionCard).join("");
  }

  const html =
    '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#f0f2f5;font-family:Arial,Helvetica,sans-serif;-webkit-font-smoothing:antialiased">' +
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f0f2f5">' + esc(preheader) + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f2f5;padding:24px 0"><tr><td align="center">' +
    '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08)">' +
    '<tr><td style="background:linear-gradient(135deg,#0071e3,#005bb5);padding:24px 28px">' +
      '<div style="font-size:20px;font-weight:700;color:#fff;letter-spacing:-.3px">📋 Acompanhamento de Ações</div>' +
      '<div style="font-size:13px;color:rgba(255,255,255,.85);margin-top:4px">' + fmtBR(hoje) + '</div>' +
    '</td></tr>' +
    '<tr><td style="padding:24px 28px">' +
      '<p style="font-size:15px;color:#1a1a1a;margin:0 0 18px;line-height:1.4">Olá <b>' + esc(nome) + '</b>, aqui está seu resumo do dia.</p>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:22px"><tr>' +
        metricCard("Total", acoes.length, "#1a1a1a", "#f0f0f0") +
        '<td style="width:10px"></td>' +
        metricCard("Vencem hoje", hojeN, "#e65100", "#fff3e0") +
        '<td style="width:10px"></td>' +
        metricCard("Atrasadas", atrasN, "#c62828", "#fce4e4") +
      '</tr></table>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
        section("Vencem hoje", "#e65100", vencemHoje) +
        section("Atrasadas", "#c62828", atrasadas) +
      '</table>' +
      (site ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td align="center">' +
        '<a href="' + esc(site) + '" style="display:inline-block;background:#0071e3;color:#fff;padding:13px 32px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;box-shadow:0 2px 6px rgba(0,113,227,.35)">Abrir o acompanhamento →</a>' +
        '</td></tr></table>' : '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:22px"><tr><td align="center" style="font-size:12px;color:#999">Configure o secret <b>SITE_URL</b> no GitHub para ativar o botão de acesso.</td></tr></table>') +
    '</td></tr>' +
    '<tr><td style="padding:16px 28px;background:#f9fafb;border-top:1px solid #eee">' +
      '<p style="font-size:11px;color:#999;margin:0;line-height:1.6">' +
        'Gerado automaticamente em ' + fmtBR(hoje) + '.<br>' +
        'Para deixar de receber, remova seu email em <b>Membros do time</b>.' +
      '</p>' +
    '</td></tr>' +
    '</table></td></tr></table></body></html>';

  const texto =
    "Acompanhamento de ações — " + fmtBR(hoje) + "\n\n" +
    "Olá " + nome + ", aqui está seu resumo do dia.\n\n" +
    "Total: " + acoes.length + " | Vencem hoje: " + hojeN + " | Atrasadas: " + atrasN + "\n\n" +
    (vencemHoje.length ? "=== VENCEM HOJE ===\n" + vencemHoje.map(a =>
      "- " + a.titulo + " | prazo " + fmtBR(a.prazo) + " | " + (ROT_PRIO[a.prioridade] || a.prioridade) + " | " + ((colunaPorId(a.status) || {}).nome || "—")
    ).join("\n") + "\n\n" : "") +
    (atrasadas.length ? "=== ATRASADAS ===\n" + atrasadas.map(a =>
      "- " + a.titulo + " | prazo " + fmtBR(a.prazo) + " (" + Math.abs(difDias(a.prazo, hoje)) + " dias) | " + (ROT_PRIO[a.prioridade] || a.prioridade) + " | " + ((colunaPorId(a.status) || {}).nome || "—")
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
