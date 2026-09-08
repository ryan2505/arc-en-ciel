/**
 * Arc en Ciel — réception automatique des demandes de proposition.
 *
 * Fonction serverless Vercel (dossier /api détecté automatiquement, runtime Node).
 * Déployée à l'URL  /api/lead  — appelée en POST par le formulaire de contact.html.
 *
 * À l'envoi du formulaire, cette fonction transmet le brief :
 *   1. par e-mail  → boîte professionnelle de la Maison (avec les photos en pièces jointes)
 *   2. par WhatsApp → numéro de la Maison (résumé court)
 *
 * ────────────────────────────────────────────────────────────────────────────
 *  VARIABLES D'ENVIRONNEMENT À DÉFINIR DANS VERCEL  (Project → Settings → Environment Variables)
 * ────────────────────────────────────────────────────────────────────────────
 *  E-MAIL (via Resend — https://resend.com, offre gratuite) :
 *    RESEND_API_KEY      clé API Resend (obligatoire pour l'e-mail)
 *    LEAD_TO_EMAIL       destinataire      (défaut : arcenciel.event.groupe@gmail.com)
 *    LEAD_FROM_EMAIL     expéditeur        (défaut : "Arc en Ciel <onboarding@resend.dev>")
 *                        ⚠ en production, utiliser une adresse d'un domaine vérifié dans Resend.
 *
 *  WHATSAPP — choisir UNE des deux options :
 *
 *   Option A · Twilio (recommandé en production — https://twilio.com) :
 *    TWILIO_ACCOUNT_SID
 *    TWILIO_AUTH_TOKEN
 *    TWILIO_WHATSAPP_FROM   ex. +14155238886 (numéro/sandbox WhatsApp Twilio)
 *    LEAD_WHATSAPP_TO       ex. +237653267335 (numéro de la Maison, format E.164)
 *
 *   Option B · CallMeBot (gratuit, mise en place en 2 min — https://www.callmebot.com/blog/free-api-whatsapp-messages/) :
 *    CALLMEBOT_PHONE       ex. +237653267335
 *    CALLMEBOT_APIKEY      clé obtenue en envoyant un message WhatsApp à CallMeBot
 *
 *  Si aucune variable WhatsApp n'est définie, seul l'e-mail part (sans erreur).
 *  Si RESEND_API_KEY n'est pas défini, la fonction renvoie 501 et le formulaire
 *  bascule automatiquement sur l'ouverture du client mail (mailto), comme avant.
 * ────────────────────────────────────────────────────────────────────────────
 */

const TO_EMAIL = process.env.LEAD_TO_EMAIL || "arcenciel.event.groupe@gmail.com";
const FROM_EMAIL = process.env.LEAD_FROM_EMAIL || "Arc en Ciel <onboarding@resend.dev>";
const MAX_ATTACH_BYTES = 3.2 * 1024 * 1024; // marge sous la limite de corps Vercel (4,5 Mo)

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

function buildText(data) {
  const lines = ["NOUVEAU PROJET REÇU — ARC EN CIEL", ""];
  for (const [k, v] of Object.entries(data || {})) {
    if (v && String(v).trim() && v !== "—") lines.push(k + " : " + v);
  }
  lines.push("", "— Envoyé automatiquement depuis le formulaire du site.");
  return lines.join("\n");
}

function buildHtml(data) {
  const rows = Object.entries(data || {})
    .filter(([, v]) => v && String(v).trim() && v !== "—")
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 14px;border-bottom:1px solid #eee;color:#8f7350;font:12px/1.4 Arial,sans-serif;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;vertical-align:top">${esc(k)}</td>` +
        `<td style="padding:8px 14px;border-bottom:1px solid #eee;color:#1a1815;font:14px/1.5 Arial,sans-serif">${esc(v).replace(/\n/g, "<br>")}</td></tr>`
    )
    .join("");
  return (
    `<div style="max-width:640px;margin:0 auto;font-family:Arial,sans-serif;color:#1a1815">` +
    `<p style="font:600 13px/1 Arial;letter-spacing:.22em;text-transform:uppercase;color:#8f7350">Arc en Ciel</p>` +
    `<h1 style="font-size:22px;margin:6px 0 18px">Nouveau projet reçu</h1>` +
    `<table style="border-collapse:collapse;width:100%;border:1px solid #eee">${rows}</table>` +
    `<p style="margin-top:18px;font-size:12px;color:#6e6a62">Envoyé automatiquement depuis le formulaire du site.</p>` +
    `</div>`
  );
}

function buildWhatsApp(data) {
  const g = (k) => (data && data[k] ? String(data[k]).trim() : "");
  const parts = [
    "🔔 *Nouveau projet — Arc en Ciel*",
    g("Type d'événement") && "Événement : " + g("Type d'événement"),
    g("Date") && "Date : " + g("Date"),
    (g("Ville") || g("Pays")) && "Lieu : " + [g("Ville"), g("Pays")].filter(Boolean).join(", "),
    g("Invités") && "Invités : " + g("Invités"),
    g("Budget") && "Budget : " + g("Budget"),
    g("Prestation") && "Prestation : " + g("Prestation"),
    "",
    g("Nom & prénom") && g("Nom & prénom"),
    g("Téléphone") && "Tél : " + g("Téléphone"),
    g("E-mail") && "Mail : " + g("E-mail"),
    "",
    "Détails complets envoyés par e-mail.",
  ].filter((x) => x !== undefined && x !== null && x !== false);
  return parts.join("\n");
}

async function sendEmail(data, images) {
  if (!process.env.RESEND_API_KEY) return { status: "disabled" };

  const attachments = [];
  let total = 0;
  for (const img of Array.isArray(images) ? images : []) {
    if (!img || !img.content || !img.filename) continue;
    const size = Math.ceil((img.content.length * 3) / 4);
    if (total + size > MAX_ATTACH_BYTES || attachments.length >= 5) break;
    total += size;
    attachments.push({ filename: String(img.filename).slice(0, 80), content: img.content });
  }

  const subject =
    "Nouveau projet — " +
    (data["Type d'événement"] || "Événement") +
    (data["Nom & prénom"] ? " — " + data["Nom & prénom"] : "");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + process.env.RESEND_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      reply_to: data["E-mail"] || undefined,
      subject,
      text: buildText(data),
      html: buildHtml(data),
      attachments: attachments.length ? attachments : undefined,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return { status: "error", detail: detail.slice(0, 300) };
  }
  return { status: "sent", attachments: attachments.length };
}

async function sendWhatsApp(data) {
  const body = buildWhatsApp(data);

  // Option A — Twilio
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM && process.env.LEAD_WHATSAPP_TO) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const auth = Buffer.from(sid + ":" + process.env.TWILIO_AUTH_TOKEN).toString("base64");
    const form = new URLSearchParams({
      From: "whatsapp:" + process.env.TWILIO_WHATSAPP_FROM,
      To: "whatsapp:" + process.env.LEAD_WHATSAPP_TO,
      Body: body.slice(0, 1500),
    });
    const res = await fetch("https://api.twilio.com/2010-04-01/Accounts/" + sid + "/Messages.json", {
      method: "POST",
      headers: { Authorization: "Basic " + auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: form,
    });
    if (!res.ok) return { status: "error", detail: (await res.text().catch(() => "")).slice(0, 300) };
    return { status: "sent", provider: "twilio" };
  }

  // Option B — CallMeBot
  if (process.env.CALLMEBOT_PHONE && process.env.CALLMEBOT_APIKEY) {
    const url =
      "https://api.callmebot.com/whatsapp.php?phone=" +
      encodeURIComponent(process.env.CALLMEBOT_PHONE) +
      "&apikey=" +
      encodeURIComponent(process.env.CALLMEBOT_APIKEY) +
      "&text=" +
      encodeURIComponent(body.slice(0, 900));
    const res = await fetch(url);
    if (!res.ok) return { status: "error", detail: (await res.text().catch(() => "")).slice(0, 300) };
    return { status: "sent", provider: "callmebot" };
  }

  return { status: "disabled" };
}

export default async function handler(req, res) {
  // CORS same-origin (formulaire servi depuis le même domaine)
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method_not_allowed" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  // Anti-bot : honeypot + délai minimal de remplissage
  if (body.company_website && String(body.company_website).trim() !== "") {
    return res.status(200).json({ ok: true, skipped: "bot" });
  }
  if (typeof body.elapsed === "number" && body.elapsed >= 0 && body.elapsed < 3000) {
    return res.status(200).json({ ok: true, skipped: "too_fast" });
  }

  const data = body.data && typeof body.data === "object" ? body.data : {};
  if (!data["E-mail"] && !data["Téléphone"] && !data["Nom & prénom"]) {
    return res.status(400).json({ ok: false, error: "empty_payload" });
  }

  if (!process.env.RESEND_API_KEY) {
    // Aucun canal e-mail configuré → le client bascule sur mailto.
    return res.status(501).json({ ok: false, error: "email_not_configured" });
  }

  const [email, whatsapp] = await Promise.all([
    sendEmail(data, body.images).catch((e) => ({ status: "error", detail: String(e).slice(0, 200) })),
    sendWhatsApp(data).catch((e) => ({ status: "error", detail: String(e).slice(0, 200) })),
  ]);

  const ok = email.status === "sent";
  return res.status(ok ? 200 : 502).json({ ok, email, whatsapp });
}
