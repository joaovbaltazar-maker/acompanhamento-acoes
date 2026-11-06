// Avisos diários por email — executado pelo GitHub Actions (.github/workflows/avisos.yml).
// Lê dados.json do repositório, calcula as ações que vencem HOJE ou já estão ATRASADAS
// (fuso America/Sao_Paulo) e envia 1 email por membro com email cadastrado, via Resend.
"use strict";
const fs = require("fs");
const path = require("path");

const ARQUIVO = path.join(__dirname, "..", "dados.json");
const API_RESEND = "https://api.resend.com/emails";
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

function montarEmail(nome, acoes, hoje, site, colunaPorId, nota) {
  const item = a => {
    const d = difDias(a.prazo, hoje);
    const rot = d < 0 ? "atrasada" : "vence hoje";
    const cor = d < 0 ? "#c62828" : "#e65100";
    const prio = ROT_PRIO[a.prioridade] || a.prioridade || "—";
    const st = (colunaPorId(a.status) || {}).nome || "—";
    return '<li style="margin:0 0 8px"><b>' + esc(a.titulo) + '</b><br>' +
      '<span style="color:' + cor + ';font-size:13px">Prazo: ' + fmtBR(a.prazo) + ' (' + rot + ')</span>' +
      ' <span style="font-size:12px;color:#666">· ' + esc(prio) + ' · ' + esc(st) + '</span></li>';
  };
  const hojeN = acoes.filter(a => a.prazo === hoje).length;
  const atrasN = acoes.length - hojeN;
  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">' +
    '<h2 style="font-size:18px;margin:0 0 8px">📋 Acompanhamento de ações</h2>' +
    '<p style="font-size:14px">Olá ' + esc(nome) + ', você tem <b>' + acoes.length + ' ação(ões)</b>' +
    (hojeN ? ' · <b>' + hojeN + '</b> vencem hoje' : '') +
    (atrasN ? ' · <b style="color:#c62828">' + atrasN + '</b> atrasada(s)' : '') +
    ':</p>' +
    (nota ? '<p style="font-size:13px;background:#fff7e6;border:1px solid #ffd591;padding:8px 12px;border-radius:8px">' + esc(nota) + '</p>' : "") +
    '<ul style="padding-left:18px;font-size:14px">' + acoes.map(item).join("") + '</ul>' +
    (site ? '<p style="margin:16px 0"><a href="' + esc(site) + '" style="background:#0071e3;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-size:14px">Abrir o acompanhamento</a></p>' : "") +
    '<p style="font-size:12px;color:#888">Email automático do Acompanhamento de Ações.</p></div>';
  const texto =
    "Acompanhamento de ações — " + fmtBR(hoje) + "\n\n" +
    "Olá " + nome + ", você tem " + acoes.length + " ação(ões):\n\n" +
    acoes.map(a => "- " + a.titulo + " | prazo " + fmtBR(a.prazo) +
      (difDias(a.prazo, hoje) < 0 ? " (atrasada)" : " (vence hoje)")).join("\n") +
    (site ? "\n\nAbrir: " + site : "");
  const assunto = "Acompanhamento: " + acoes.length + " ação(ões) — " +
    (hojeN ? hojeN + " vencem hoje" : "") +
    (hojeN && atrasN ? ", " : "") +
    (atrasN ? atrasN + " atrasada(s)" : "") +
    " (" + fmtBR(hoje) + ")";
  return { html, texto, assunto };
}

async function enviarPara(email, key, from, assunto, html, texto) {
  const r = await fetch(API_RESEND, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
    body: JSON.stringify({ from, to: [email], subject: assunto, html, text: texto }),
  });
  if (!r.ok) {
    const corpo = await r.text().catch(() => "");
    throw new Error("Resend " + r.status + ": " + corpo.slice(0, 300));
  }
}

(async () => {
  try {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;
    if (!key || !from) throw new Error("Defina os secrets RESEND_API_KEY e EMAIL_FROM no repositório");
    const site = (process.env.SITE_URL || "").trim();
    const admin = (process.env.EMAIL_ADMIN || "").trim().toLowerCase();
    const consolidado = !!admin;

    const estado = carregarDados();
    const { colunaPorId, concluida } = criarHelpers(estado);
    const hoje = hojeSP();

    const avisaveis = estado.acoes.filter(a => emAviso(a, hoje, concluida));

    let enviados = 0;
    const erros = [];
    let semEmail = 0;

    if (consolidado) {
      // Modo consolidado: 1 email para o admin com todas as ações agrupadas por responsável.
      // Funciona com onboarding@resend.dev (sem verificação de domínio).
      const grupos = new Map();
      for (const a of avisaveis) {
        const m = estado.membros.find(x => x.id === a.membroId);
        const nome = m ? m.nome : "(sem responsável)";
        if (!grupos.has(nome)) grupos.set(nome, []);
        grupos.get(nome).push(a);
      }
      const linhas = [];
      for (const [nome, acoes] of grupos) {
        acoes.sort((a, b) => a.prazo.localeCompare(b.prazo) || a.titulo.localeCompare(b.titulo, "pt-BR"));
        linhas.push('<h3 style="font-size:15px;margin:14px 0 6px;color:#0071e3">' + esc(nome) + ' (' + acoes.length + ')</h3><ul style="padding-left:18px;font-size:14px;margin:0">' +
          acoes.map(a => {
            const d = difDias(a.prazo, hoje);
            const rot = d < 0 ? "atrasada" : "vence hoje";
            const cor = d < 0 ? "#c62828" : "#e65100";
            const prio = ROT_PRIO[a.prioridade] || a.prioridade || "—";
            const st = (colunaPorId(a.status) || {}).nome || "—";
            return '<li style="margin:0 0 8px"><b>' + esc(a.titulo) + '</b><br>' +
              '<span style="color:' + cor + ';font-size:13px">Prazo: ' + fmtBR(a.prazo) + ' (' + rot + ')</span>' +
              ' <span style="font-size:12px;color:#666">· ' + esc(prio) + ' · ' + esc(st) + '</span></li>';
          }).join("") + '</ul>');
      }
      const total = avisaveis.length;
      const atrasN = avisaveis.filter(a => difDias(a.prazo, hoje) < 0).length;
      const hojeN = total - atrasN;
      const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1a1a1a">' +
        '<h2 style="font-size:18px;margin:0 0 8px">📋 Acompanhamento de ações</h2>' +
        '<p style="font-size:14px">Resumo do dia <b>' + fmtBR(hoje) + '</b>: <b>' + total + ' ação(ões)</b>' +
        (hojeN ? ' · <b>' + hojeN + '</b> vencem hoje' : '') +
        (atrasN ? ' · <b style="color:#c62828">' + atrasN + '</b> atrasada(s)' : '') +
        '</p>' + linhas.join("") +
        (site ? '<p style="margin:16px 0"><a href="' + esc(site) + '" style="background:#0071e3;color:#fff;padding:9px 16px;border-radius:8px;text-decoration:none;font-size:14px">Abrir o acompanhamento</a></p>' : "") +
        '<p style="font-size:12px;color:#888">Email automático do Acompanhamento de Ações.</p></div>';
      const texto = "Acompanhamento de ações — " + fmtBR(hoje) + "\n\nTotal: " + total + " ação(ões)\n\n" +
        Array.from(grupos).map(([nome, acoes]) => nome + ":\n" + acoes.map(a => "  - " + a.titulo + " | prazo " + fmtBR(a.prazo) + (difDias(a.prazo, hoje) < 0 ? " (atrasada)" : " (vence hoje)")).join("\n")).join("\n\n") +
        (site ? "\n\nAbrir: " + site : "");
      const assunto = "Acompanhamento: " + total + " ação(ões) — " +
        (hojeN ? hojeN + " vencem hoje" : "") +
        (hojeN && atrasN ? ", " : "") +
        (atrasN ? atrasN + " atrasada(s)" : "") +
        " (" + fmtBR(hoje) + ")";
      try {
        await enviarPara(admin, key, from, assunto, html, texto);
        enviados = 1;
        console.log("OK  " + admin + " (" + total + " ação(ões) consolidadas)");
      } catch (e) {
        erros.push(admin + ": " + e.message);
        console.error("ERRO " + admin + ": " + e.message);
      }
    } else {
      // Modo per-responsável (requer domínio verificado no Resend)
      const porEmail = new Map();
      for (const a of avisaveis) {
        const m = estado.membros.find(x => x.id === a.membroId);
        const email = ((m && m.email) || "").trim().toLowerCase();
        if (!email) { semEmail++; continue; }
        if (!porEmail.has(email)) porEmail.set(email, { nome: m.nome, acoes: [] });
        porEmail.get(email).acoes.push(a);
      }
      if (!porEmail.size) {
        console.log("Nada a enviar: " + avisaveis.length + " ação(ões) no radar, " + semEmail + " sem email do responsável. Defina EMAIL_ADMIN para receber um resumo consolidado.");
        return;
      }
      for (const [email, info] of porEmail) {
        info.acoes.sort((a, b) => a.prazo.localeCompare(b.prazo) || a.titulo.localeCompare(b.titulo, "pt-BR"));
        const { html, texto, assunto } = montarEmail(info.nome, info.acoes, hoje, site, colunaPorId, "");
        try {
          await enviarPara(email, key, from, assunto, html, texto);
          enviados++;
          console.log("OK  " + email + " (" + info.acoes.length + " ação(ões))");
        } catch (e) {
          erros.push(email + ": " + e.message);
          console.error("ERRO " + email + ": " + e.message);
        }
      }
    }

    console.log(JSON.stringify({ hoje, avisaveis: avisaveis.length, enviados, semEmail, consolidado, erros: erros.length }));
    if (erros.length) process.exitCode = 1;
  } catch (e) {
    console.error(e && e.message ? e.message : e);
    process.exitCode = 1;
  }
})();
