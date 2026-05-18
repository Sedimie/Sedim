import * as clack from '@clack/prompts'
import chalk from 'chalk'
import { showCancel } from './intro'

// ============================================================
// handleCancel — called after every prompt
// if user hit ctrl+c, bail cleanly
// ============================================================

export function handleCancel(value: unknown): void {
  if (clack.isCancel(value)) showCancel()
}

// ============================================================
// Prompt wrappers — each calls handleCancel internally
// callers never have to think about the cancel pattern
// ============================================================

export async function confirm(message: string, initialValue = false): Promise<boolean> {
  const result = await clack.confirm({ message, initialValue })
  handleCancel(result)
  return result as boolean
}

export async function select<T extends string>(
  message: string,
  options: Array<{ value: T; label: string; hint?: string }>,
): Promise<T> {
  const result = await clack.select({ message, options })
  handleCancel(result)
  return result as T
}

export async function multiselect<T extends string>(
  message: string,
  options: Array<{ value: T; label: string; hint?: string }>,
  required = true,
): Promise<T[]> {
  const result = await clack.multiselect({ message, options, required })
  handleCancel(result)
  return result as T[]
}

export async function text(
  message: string,
  placeholder?: string,
  validate?: (value: string | undefined) => string | Error | undefined,
): Promise<string> {
  const result = await clack.text({ message, placeholder, validate })
  handleCancel(result)
  return result as string
}

// ============================================================
// collectEnvValues — guided prompts for env vars
//
// Groups vars by category, shows descriptions and setup links,
// uses defaults for optional vars when user presses enter.
// Returns a Map<key, value> to pass to updateEnv.
// ============================================================

// OAuth provider setup links shown inline during prompts
const OAUTH_SETUP_LINKS: Record<string, { name: string; url: string }> = {
  GOOGLE_CLIENT_ID: {
    name: 'Google Cloud Console',
    url: 'https://console.cloud.google.com/apis/credentials',
  },
  GOOGLE_CLIENT_SECRET: {
    name: 'Google Cloud Console',
    url: 'https://console.cloud.google.com/apis/credentials',
  },
  GITHUB_CLIENT_ID: {
    name: 'GitHub Developer Settings',
    url: 'https://github.com/settings/developers',
  },
  GITHUB_CLIENT_SECRET: {
    name: 'GitHub Developer Settings',
    url: 'https://github.com/settings/developers',
  },
  DISCORD_CLIENT_ID: {
    name: 'Discord Developer Portal',
    url: 'https://discord.com/developers/applications',
  },
  DISCORD_CLIENT_SECRET: {
    name: 'Discord Developer Portal',
    url: 'https://discord.com/developers/applications',
  },
}

interface EnvVarPromptConfig {
  key: string
  description: string
  example?: string
  default?: string
  required: boolean
}

export async function collectEnvValues(
  envVars: EnvVarPromptConfig[],
): Promise<Map<string, string>> {
  const collected = new Map<string, string>()
  if (envVars.length === 0) return collected

  clack.log.step('Setting up environment variables')

  // group into categories for cleaner UX
  const groups: Record<string, EnvVarPromptConfig[]> = {
    core: [],
    smtp: [],
    oauth: [],
    other: [],
  }

  for (const v of envVars) {
    if (['AUTH_SECRET', 'APP_URL', 'DATABASE_URL'].includes(v.key)) groups.core.push(v)
    else if (v.key.startsWith('SMTP_')) groups.smtp.push(v)
    else if (
      v.key.startsWith('GOOGLE_') ||
      v.key.startsWith('GITHUB_') ||
      v.key.startsWith('DISCORD_')
    )
      groups.oauth.push(v)
    else groups.other.push(v)
  }

  // core vars first
  if (groups.core.length > 0) {
    clack.log.message(chalk.bold('Core'))
    for (const v of groups.core) {
      await promptEnvVar(v, collected)
    }
  }

  // smtp
  if (groups.smtp.length > 0) {
    clack.log.message(chalk.bold('Email / SMTP'))
    clack.log.info('Used for magic links, password reset emails, and verification.')
    clack.log.info('Works with any SMTP provider — Resend, Postmark, SendGrid, etc.')
    for (const v of groups.smtp) {
      await promptEnvVar(v, collected)
    }
  }

  // oauth — show setup links before prompting
  if (groups.oauth.length > 0) {
    clack.log.message(chalk.bold('OAuth Providers'))

    // deduplicate provider links
    const shownLinks = new Set<string>()
    for (const v of groups.oauth) {
      const link = OAUTH_SETUP_LINKS[v.key]
      if (link && !shownLinks.has(link.url)) {
        clack.log.info(`${link.name}: ${chalk.cyan(link.url)}`)
        shownLinks.add(link.url)
      }
    }

    for (const v of groups.oauth) {
      await promptEnvVar(v, collected)
    }
  }

  // anything else
  if (groups.other.length > 0) {
    for (const v of groups.other) {
      await promptEnvVar(v, collected)
    }
  }

  return collected
}

async function promptEnvVar(v: EnvVarPromptConfig, collected: Map<string, string>): Promise<void> {
  // build the prompt message with description and hint
  const hint = v.default
    ? chalk.dim(` (default: ${v.default})`)
    : v.example
      ? chalk.dim(` (e.g. ${v.example})`)
      : ''

  const message = `${v.key}${hint}\n  ${chalk.dim(v.description)}`

  const placeholder = v.default ?? v.example ?? ''

  const result = await clack.text({
    message,
    placeholder,
    validate: val => {
      // required vars with no default must have a value
      if (v.required && !v.default && (!val || val.trim() === '')) {
        return `${v.key} is required`
      }
    },
  })

  handleCancel(result)

  const value = (result as string).trim()
  // use default if user pressed enter with no input
  collected.set(v.key, value || v.default || '')
}
