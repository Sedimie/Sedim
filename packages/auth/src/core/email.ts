// src/core/email.ts
// DEPRECATED — use email-transport.ts instead
// This file is kept for backwards compatibility with older stamped projects.
// All email sending goes through email-transport.ts which uses lazy imports.

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text?: string
}