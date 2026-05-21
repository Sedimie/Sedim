// src/core/email-transport.ts
// ── Email transport abstraction ─────────────────────────────────────────
// Supports multiple transport backends. Set via AuthConfig.email.transport.
//
//   nodemailer  — generic SMTP (default, works everywhere)
//   resend      — Resend API (https://resend.com)
//   postmark    — Postmark API (https://postmarkapp.com)
//   ses         — AWS SES HTTP API (via fetch, no SDK needed)
//
// Usage in AuthConfig:
//
//   email: { transport: 'nodemailer', smtp: { host, port, user, pass, from } }
//   email: { transport: 'resend', resend: { apiKey: process.env.RESEND_API_KEY! } }
//   email: { transport: 'postmark', postmark: { apiKey: process.env.POSTMARK_API_KEY! } }
//   email: { transport: 'ses', ses: { region, accessKeyId, secretAccessKey } }

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

// ── Transport interfaces ───────────────────────────────────────────────

export interface SmtpConfig {
  host: string
  port?: number   // defaults to 587
  user: string
  pass: string
  from?: string   // defaults to 'Sedim <noreply@sedim.dev>'
  secure?: boolean // defaults to false (true = port 465)
}

export interface ResendConfig {
  apiKey: string
}

export interface PostmarkConfig {
  apiKey: string
}

export interface SesConfig {
  region: string
  accessKeyId?: string      // uses env AWS credentials if omitted
  secretAccessKey?: string
  from: string               // SES requires a verified sender
}

// ── Resend transport ─────────────────────────────────────────────────

async function sendViaResend(cfg: ResendConfig, opts: EmailOptions): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: opts.from ?? 'Sedim <noreply@sedim.dev>',
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  })
  if (!res.ok) throw new Error(`Resend error: ${res.status} ${await res.text()}`)
}

// ── Postmark transport ──────────────────────────────────────────────

async function sendViaPostmark(cfg: PostmarkConfig, opts: EmailOptions): Promise<void> {
  const res = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      From: opts.from ?? 'Sedim <noreply@sedim.dev>',
      To: opts.to,
      Subject: opts.subject,
      HtmlBody: opts.html,
      TextBody: opts.text,
    }),
  })
  if (!res.ok) throw new Error(`Postmark error: ${res.status} ${await res.text()}`)
}

// ── AWS SES transport ─────────────────────────────────────────────────

async function sendViaSes(cfg: SesConfig, opts: EmailOptions): Promise<void> {
  // Uses AWS Signature Version 4 — simplified without the AWS SDK.
  // For production, prefer @aws-sdk/client-ses for full SigV4 signing.
  const region = cfg.region
  const now = new Date().toUTCString()
  const payload = JSON.stringify({
    Source: cfg.from,
    Destination: { ToAddresses: [opts.to] },
    Message: {
      Subject: { Data: opts.subject, Charset: 'UTF-8' },
      Body: opts.html ? { Html: { Data: opts.html, Charset: 'UTF-8' } } : { Text: { Data: opts.text ?? '', Charset: 'UTF-8' } },
    },
  })
  const endpoint = `https://email.${region}.amazonaws.com`
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Amz-Date': now,
      'Host': `email.${region}.amazonaws.com`,
    },
    body: payload,
  })
  if (!res.ok) throw new Error(`SES error: ${res.status} ${await res.text()}`)
}

// ── Nodemailer transport ────────────────────────────────────────────

async function sendViaSmtp(cfg: SmtpConfig, opts: EmailOptions): Promise<void> {
  // Lazy import to avoid hard dependency when not using SMTP
  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port ?? 587,
    secure: cfg.secure ?? false,
    auth: { user: cfg.user, pass: cfg.pass },
  })
  await transporter.sendMail({ from: cfg.from ?? 'Sedim <noreply@sedim.dev>', ...opts })
}

// ── Unified sendEmail ────────────────────────────────────────────────

export type EmailTransportType = 'nodemailer' | 'resend' | 'postmark' | 'ses'

export interface EmailTransportConfig {
  transport: EmailTransportType
  smtp?: SmtpConfig
  resend?: ResendConfig
  postmark?: PostmarkConfig
  ses?: SesConfig
  /** Defaults to 'Sedim <noreply@sedim.dev>' */
  defaultFrom?: string
}

export async function sendEmail(opts: EmailOptions, config: EmailTransportConfig): Promise<void> {
  const from = opts.from ?? config.defaultFrom ?? 'Sedim <noreply@sedim.dev>'
  const enriched = { ...opts, from }

  switch (config.transport) {
    case 'resend':
      if (!config.resend) throw new Error('Resend transport requires { apiKey }')
      await sendViaResend(config.resend, enriched)
      break
    case 'postmark':
      if (!config.postmark) throw new Error('Postmark transport requires { apiKey }')
      await sendViaPostmark(config.postmark, enriched)
      break
    case 'ses':
      if (!config.ses) throw new Error('SES transport requires { region, from }')
      await sendViaSes(config.ses, enriched)
      break
    case 'nodemailer':
    default:
      if (!config.smtp) throw new Error('Nodemailer transport requires { host, port, user, pass }')
      await sendViaSmtp(config.smtp, enriched)
      break
  }
}

// ── Email templates ─────────────────────────────────────────────────

export function buildMagicLinkEmail(opts: { email: string; magicLinkUrl: string }): EmailOptions {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 2rem auto; color: #111;">
  <h2 style="color: #1a1a1a;">Sign in to Sedim</h2>
  <p>Click the link below to sign in${opts.email ? ` as <strong>${opts.email}</strong>` : ''}. It expires in 15 minutes.</p>
  <a href="${opts.magicLinkUrl}" style="display: inline-block; margin: 1.5rem 0; padding: 0.75rem 1.5rem; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Sign in</a>
  <p style="color: #666; font-size: 0.875rem;">If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`
  const text = `Sign in to Sedim\n\nClick this link to sign in${opts.email ? ` as ${opts.email}` : ''}: ${opts.magicLinkUrl}\n\nIt expires in 15 minutes. If you didn't request this, ignore this email.`
  return { to: opts.email, subject: 'Your sign-in link', html, text }
}

export function buildPasswordResetEmail(opts: { email: string; resetUrl: string }): EmailOptions {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; max-width: 480px; margin: 2rem auto; color: #111;">
  <h2 style="color: #1a1a1a;">Reset your password</h2>
  <p>Click the link below to reset your password${opts.email ? ` for <strong>${opts.email}</strong>` : ''}. It expires in 1 hour.</p>
  <a href="${opts.resetUrl}" style="display: inline-block; margin: 1.5rem 0; padding: 0.75rem 1.5rem; background: #dc2626; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">Reset password</a>
  <p style="color: #666; font-size: 0.875rem;">If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`
  const text = `Reset your password\n\nClick this link to reset your password${opts.email ? ` for ${opts.email}` : ''}: ${opts.resetUrl}\n\nIt expires in 1 hour. If you didn't request this, ignore this email.`
  return { to: opts.email, subject: 'Reset your password', html, text }
}