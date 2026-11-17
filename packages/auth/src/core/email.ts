// src/core/email.ts
/**
 * @deprecated Consolidated into email-transport.ts.
 * All email functionality is now unified under `email-transport.ts` with support
 * for lazy-imported nodemailer (default SMTP), Resend, Postmark, and AWS SES.
 *
 * Migration Note:
 * For projects importing from `./email` or `@sedim/auth/core/email`:
 * ```ts
 * // Old:
 * import { EmailOptions } from './core/email'
 *
 * // New:
 * import { sendEmail, type EmailOptions, type EmailTransportConfig } from './core/email-transport'
 * ```
 */

export * from './email-transport.js'
