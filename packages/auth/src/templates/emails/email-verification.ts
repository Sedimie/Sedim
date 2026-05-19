// src/sedim/auth/templates/emails/email-verification.ts
// ── Email verification email template ─────────────────────────
// Sends the magic link / email verification email.
// This is a template — copy it into your project and wire it to your SMTP transport.
//
// Usage in operations.ts or a separate mailer:
//
//   import { sendVerificationEmail } from './emails/email-verification'
//   const link = `${APP_URL}/verify-email?token=${token}`
//   await sendVerificationEmail({
//     to: user.email,
//     email,
//     link,
//     smtp: { host, port, user, pass, from },
//   })

export interface EmailVerificationParams {
  to: string
  /** The magic link URL the user clicks */
  link: string
  /** Sender name e.g. 'Acme <auth@acme.com>' */
  from?: string
  /** Optional base URL for email logo/brand — defaults to APP_URL */
  baseUrl?: string
}

// ── HTML email template ─────────────────────────────────────────

function buildHtml(params: EmailVerificationParams): string {
  const { link, to } = params
  const brand = params.baseUrl ?? 'https://yourapp.com'
  const logoText = 'Your App'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Verify your email</title>
</head>
<body style="margin: 0; padding: 0; background: #f9fafb; font-family: system-ui, -apple-system, sans-serif;">
  <div style="max-width: 480px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background: #111827; padding: 32px 40px;">
      <h1 style="margin: 0; font-size: 1.25rem; font-weight: 600; color: #ffffff; letter-spacing: -0.01em;">
        ${logoText}
      </h1>
    </div>

    <!-- Body -->
    <div style="padding: 40px;">
      <h2 style="margin: 0 0 12px; font-size: 1.375rem; font-weight: 600; color: #111827;">
        Check your inbox
      </h2>
      <p style="margin: 0 0 24px; font-size: 0.9375rem; color: #374151; line-height: 1.6;">
        We sent a sign-in link to <strong style="color: #111827;">${to}</strong>.
        Click the button below to sign in to your account.
      </p>

      <!-- CTA Button -->
      <a href="${link}"
         style="display: inline-block; width: 100%; box-sizing: border-box;
                background: #111827; color: #ffffff; text-decoration: none;
                font-size: 0.9375rem; font-weight: 500; text-align: center;
                padding: 14px 24px; border-radius: 8px;">
        Sign in to my account
      </a>

      <!-- Fallback link -->
      <p style="margin: 20px 0 0; font-size: 0.8125rem; color: #6b7280; line-height: 1.5;">
        Or copy and paste this link into your browser:<br />
        <a href="${link}" style="color: #4f46e5; word-break: break-all;">${link}</a>
      </p>

      <!-- Expiry notice -->
      <p style="margin: 24px 0 0; font-size: 0.8125rem; color: #9ca3af;">
        This link expires in 15 minutes and can only be used once.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 40px; border-top: 1px solid #e5e7eb; background: #f9fafb;">
      <p style="margin: 0; font-size: 0.75rem; color: #9ca3af; line-height: 1.5;">
        You received this because a sign-in was requested for your account.
        If you didn&apos;t request this, you can safely ignore this email.
      </p>
    </div>
  </div>
</body>
</html>`
}

function buildPlainText(params: EmailVerificationParams): string {
  const { link, to } = params
  return `Check your inbox

We sent a sign-in link to ${to}. Click the link below to sign in:

${link}

This link expires in 15 minutes and can only be used once.

If you didn't request this, you can safely ignore this email.`
}

// ── SMTP sender ─────────────────────────────────────────────────
// The caller wires this to their SMTP transport.
// The template produces the HTML/text — transport is an injectable dependency.

export interface SmtpConfig {
  host: string
  port: number
  user: string
  pass: string
  from: string
}

export interface SendEmailParams {
  to: string
  subject: string
  html: string
  text: string
}

export interface EmailSender {
  send(params: SendEmailParams): Promise<void>
}

/**
 * Send an email via SMTP (nodemailer-compatible transport).
 * For production, replace with Resend, Postmark, SES, etc.
 */
export async function sendViaSmtp(
  config: SmtpConfig,
  params: SendEmailParams,
): Promise<void> {
  // Lazy-import nodemailer to avoid a hard dependency
  const nodemailer = await import('nodemailer')
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    auth: { user: config.user, pass: config.pass },
  })

  await transporter.sendMail({
    from: config.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    text: params.text,
  })
}

/**
 * Full email sending function — builds content and sends via SMTP.
 * Call this after creating the magic link token.
 *
 * @param params  — { to, link }
 * @param smtp    — SMTP config from env vars
 */
export async function sendVerificationEmail(
  params: EmailVerificationParams,
  smtp: SmtpConfig,
): Promise<void> {
  const html = buildHtml(params)
  const text = buildPlainText(params)

  await sendViaSmtp(smtp, {
    to: params.to,
    subject: 'Your sign-in link',
    html,
    text,
  })
}