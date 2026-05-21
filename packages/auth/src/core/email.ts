// src/core/email.ts
// SMTP email sender using nodemailer.
// In production, replace with your preferred email provider (Resend, SendGrid, etc.)
// All email sending is deferred to framework adapters so stamping is not required.

import nodemailer from 'nodemailer'

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}

interface StoredConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
  secure: boolean
}

let transporter: nodemailer.Transporter | null = null
let config: StoredConfig | null = null

function createTransport(): nodemailer.Transporter {
  if (!process.env.SMTP_HOST) throw new Error('SMTP_HOST is not configured')
  if (!process.env.SMTP_USER) throw new Error('SMTP_USER is not configured')
  if (!process.env.SMTP_PASS) throw new Error('SMTP_PASS is not configured')
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587
  const secure = port === 465
  config = { host, port, user: process.env.SMTP_USER, pass: process.env.SMTP_PASS, from: process.env.SMTP_FROM ?? 'Sedim <noreply@sedim.dev>', secure }
  return nodemailer.createTransport({ host, port, secure, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } })
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  if (!transporter) transporter = createTransport()
  await transporter.sendMail({ from: config!.from, ...options })
}

// ── Email templates ────────────────────────────────────────────

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