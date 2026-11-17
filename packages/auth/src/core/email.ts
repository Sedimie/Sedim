// src/core/email.ts
// @deprecated Consolidated into email-transport.ts.
//
// MIGRATION NOTE FOR EXISTING PROJECTS:
// The legacy email.ts module has been consolidated into email-transport.ts.
// To migrate:
//   Replace: import { ... } from './core/email' (or '@sedim/auth/core/email')
//   With:    import { ... } from './core/email-transport' (or '@sedim/auth')
//
// This file re-exports all email functionality to preserve backwards compatibility
// with older stamped projects without breaking imports.

export type {
  EmailOptions,
  EmailTransport,
  EmailTransportConfig,
  PostmarkConfig,
  ResendConfig,
  SesConfig,
  SmtpConfig,
} from './email-transport.js'

export {
  buildMagicLinkEmail,
  buildPasswordResetEmail,
  sendEmail,
} from './email-transport.js'
