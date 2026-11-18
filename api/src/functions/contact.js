'use strict';

const { app } = require('@azure/functions');
const { EmailClient } = require('@azure/communication-email');

// In-memory rate limit store: Map<ip, { count, resetAt }>
// NOTE: this is per-instance and best-effort; there is no cross-instance coordination.
const rateLimitStore = new Map();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function getClientIp(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

app.http('contact', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'contact',
  handler: async (request, context) => {
    // Parse JSON body
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400, jsonBody: { ok: false, error: 'invalid_json' } };
    }

    const { firstName, lastName, company, email, message, website } = body;

    // Honeypot: silently drop bots
    if (website) {
      return { status: 200, jsonBody: { ok: true } };
    }

    // Validate presence
    if (!firstName?.trim() || !lastName?.trim() || !company?.trim() || !email?.trim() || !message?.trim()) {
      return { status: 400, jsonBody: { ok: false, error: 'missing_fields' } };
    }

    // Validate lengths
    if (firstName.trim().length > 200 || lastName.trim().length > 200 || company.trim().length > 200) {
      return { status: 400, jsonBody: { ok: false, error: 'field_too_long' } };
    }
    if (email.trim().length > 254) {
      return { status: 400, jsonBody: { ok: false, error: 'field_too_long' } };
    }
    if (message.trim().length > 5000) {
      return { status: 400, jsonBody: { ok: false, error: 'field_too_long' } };
    }

    // Validate email format
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(email.trim())) {
      return { status: 400, jsonBody: { ok: false, error: 'invalid_email' } };
    }

    // Read required env vars — never log the connection string
    const connectionString = process.env.ACS_CONNECTION_STRING;
    const toEmail = process.env.CONTACT_TO_EMAIL;
    const fromEmail = process.env.CONTACT_FROM_EMAIL;
    if (!connectionString || !toEmail || !fromEmail) {
      context.warn('Contact form: one or more required env vars are missing (ACS_CONNECTION_STRING, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL)');
      return { status: 503, jsonBody: { ok: false, error: 'not_configured' } };
    }

    // Rate limit by IP
    const ip = getClientIp(request);
    if (!checkRateLimit(ip)) {
      return { status: 429, jsonBody: { ok: false, error: 'rate_limited' } };
    }

    // Trim values used in the email
    const fn  = firstName.trim();
    const ln  = lastName.trim();
    const co  = company.trim();
    const em  = email.trim();
    const msg = message.trim();

    const emailMessage = {
      senderAddress: fromEmail,
      replyTo: [{ address: em, displayName: `${fn} ${ln}` }],
      recipients: { to: [{ address: toEmail }] },
      content: {
        subject: `Website contact: ${fn} ${ln}, ${co}`,
        plainText: `From: ${fn} ${ln}\nCompany: ${co}\nEmail: ${em}\n\n${msg}`,
        html: `<p>
  <strong>From:</strong> ${escapeHtml(fn)} ${escapeHtml(ln)}<br>
  <strong>Company:</strong> ${escapeHtml(co)}<br>
  <strong>Email:</strong> ${escapeHtml(em)}
</p>
<p>${escapeHtml(msg).replace(/\n/g, '<br>')}</p>`,
      },
    };

    try {
      const client = new EmailClient(connectionString);
      const poller = await client.beginSend(emailMessage);
      const result = await poller.pollUntilDone();
      if (result.status === 'Succeeded') {
        return { status: 200, jsonBody: { ok: true } };
      }
      context.warn(`Contact form: email send completed with status "${result.status}"`);
      return { status: 502, jsonBody: { ok: false } };
    } catch (err) {
      context.error('Contact form: email send threw an error:', err.message);
      return { status: 502, jsonBody: { ok: false } };
    }
  },
});
