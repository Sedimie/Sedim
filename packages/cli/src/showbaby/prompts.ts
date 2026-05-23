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
  const result = await clack.select({
    message,
    options: options as Parameters<typeof clack.select>[0]['options'],
  })
  handleCancel(result)
  return result as T
}

export async function multiselect<T extends string>(
  message: string,
  options: Array<{ value: T; label: string; hint?: string }>,
  required = true,
): Promise<T[]> {
  const result = await clack.multiselect({
    message,
    options: options as Parameters<typeof clack.multiselect>[0]['options'],
    required,
  })
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

const OAUTH_SETUP_LINKS_BY_PROVIDER: Record<string, { name: string; url: string }> = {
  google: {
    name: 'Google Cloud Console',
    url: 'https://console.cloud.google.com/apis/credentials',
  },
  github: { name: 'GitHub Developer Settings', url: 'https://github.com/settings/developers' },
  discord: { name: 'Discord Developer Portal', url: 'https://discord.com/developers/applications' },
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

  // oauth — show detailed setup guide before prompting
  if (groups.oauth.length > 0) {
    clack.log.message(chalk.bold('OAuth Providers'))

    // deduplicate by provider to show one guide per provider
    const providerGuides: string[] = []
    for (const v of groups.oauth) {
      if (v.key.startsWith('GOOGLE_')) providerGuides.push('google')
      else if (v.key.startsWith('GITHUB_')) providerGuides.push('github')
      else if (v.key.startsWith('DISCORD_')) providerGuides.push('discord')
    }
    const uniqueProviders = [...new Set(providerGuides)]

    // show inline summary of links
    for (const p of uniqueProviders) {
      const link = OAUTH_SETUP_LINKS_BY_PROVIDER[p]
      if (link) {
        clack.log.info(`${link.name}: ${chalk.cyan(link.url)}`)
      }
    }

    // offer to show detailed step-by-step instructions
    const showGuide = await clack.confirm({
      message: 'Show step-by-step setup instructions for OAuth credentials?',
      initialValue: true,
    })
    handleCancel(showGuide)

    if (showGuide) {
      // import and show the detailed guide
      const { showOAuthSetupGuide } = await import('./oauth-guide.js')
      console.log()
      console.log(`  ${chalk.bgYellow.black(' 📋  OAuth Setup Guide ')}`)
      console.log()
      console.log(
        `  ${chalk.dim('Follow the steps below to get your credentials, then come back here.')}`,
      )
      console.log(
        `  ${chalk.dim('Press Ctrl+C to exit and run `sedim add auth` again when you have them.')}`,
      )
      console.log()

      if (uniqueProviders.includes('google')) showDetailedGoogleGuide()
      if (uniqueProviders.includes('github')) showDetailedGithubGuide()
      if (uniqueProviders.includes('discord')) showDetailedDiscordGuide()

      console.log()
      console.log(`  ${chalk.bgBlue.black(' 💡  Important ')}`)
      console.log()
      console.log(`  ${chalk.dim('Redirect URI for all providers:')}`)
      console.log(`    ${chalk.cyan('http://localhost:3000/api/auth/callback/{provider}')}`)
      console.log(
        `  ${chalk.dim('For production, replace localhost:3000 with your actual domain.')}`,
      )
      console.log()

      // show env var prompt with skip option
      clack.log.message(chalk.bold('Now enter your OAuth credentials:'))
      clack.log.message(
        chalk.dim('Press Enter without typing a value to skip — you can add these to .env later.'),
      )
      console.log()
    }

    for (const v of groups.oauth) {
      await promptEnvVarWithSkip(v, collected)
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

  // All vars are skippable during setup — user can add to .env later
  const result = await clack.text({
    message,
    placeholder,
    validate: val => {
      // only validate if user typed something and it's clearly wrong
      if (val && val.trim() !== '' && val.length < 5 && v.key !== 'SMTP_PORT') {
        return `${v.key} looks too short — did you paste the right value?`
      }
    },
  })

  handleCancel(result)

  const value = (result as string).trim()
  // empty = skip — user will add to .env later
  collected.set(v.key, value || '')
}

// promptEnvVarWithSkip — allows user to skip OAuth vars by pressing enter
async function promptEnvVarWithSkip(
  v: EnvVarPromptConfig,
  collected: Map<string, string>,
): Promise<void> {
  const hint = v.default
    ? chalk.dim(` (default: ${v.default})`)
    : v.example
      ? chalk.dim(` (e.g. ${v.example})`)
      : ''

  const message = `${v.key}${hint}\n  ${chalk.dim(v.description)}`
  const placeholder = v.default ?? v.example ?? ''

  // OAuth vars are optional during setup — user can skip and add later
  const result = await clack.text({
    message,
    placeholder,
    validate: val => {
      // only validate if user typed something
      if (val && val.trim() !== '' && val.length < 10) {
        return `${v.key} looks too short — did you paste the right value?`
      }
    },
  })

  handleCancel(result)

  const value = (result as string).trim()
  // empty = skip — user will add to .env later
  collected.set(v.key, value || '')
}

// ============================================================
// Detailed OAuth setup guides — shown inline during collectEnvValues
// ============================================================

function showDetailedGoogleGuide(): void {
  console.log(`  ${chalk.bgRed.white(' G  Google OAuth ')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 1:')} ${chalk.white('Open Google Cloud Console')}`)
  console.log(`    ${chalk.cyan('https://console.cloud.google.com/apis/credentials')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 2:')} ${chalk.white('Create a new project')}`)
  console.log(`    ${chalk.dim('• Click "Select Project" at the top → "New Project"')}`)
  console.log(`    ${chalk.dim('• Name it (e.g. "My App Auth") → Click "Create"')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 3:')} ${chalk.white('Configure OAuth consent screen')}`)
  console.log(`    ${chalk.dim('• Left sidebar: "APIs & Services" → "OAuth consent screen"')}`)
  console.log(`    ${chalk.dim('• Choose "External" → "Create"')}`)
  console.log(`    ${chalk.dim('• App name: your app name')}`)
  console.log(`    ${chalk.dim('• Support email: your email')}`)
  console.log(`    ${chalk.dim('• Click "Save and Continue" through all screens')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 4:')} ${chalk.white('Create OAuth 2.0 Client ID')}`)
  console.log(`    ${chalk.dim('• "APIs & Services" → "Credentials" → "Create Credentials"')}`)
  console.log(`    ${chalk.dim('• Choose "OAuth client ID"')}`)
  console.log(`    ${chalk.dim('• Application type: "Web application"')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 5:')} ${chalk.white('Add redirect URIs')}`)
  console.log(`    ${chalk.dim('• Add: http://localhost:3000/api/auth/callback/google')}`)
  console.log(
    `    ${chalk.dim('• For production: https://yourdomain.com/api/auth/callback/google')}`,
  )
  console.log(`    ${chalk.dim('• Click "Create"')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 6:')} ${chalk.white('Copy your Client ID and Client Secret')}`)
  console.log(
    `    ${chalk.dim('• Client ID: looks like 123456789-abc123def456.apps.googleusercontent.com')}`,
  )
  console.log(`    ${chalk.dim('• Client Secret: looks like GOCSPX-abcdefghijklmnopqrstuv')}`)
  console.log(
    `    ${chalk.yellow('⚠  The client secret is shown only once — copy it immediately!')}`,
  )
  console.log()
}

function showDetailedGithubGuide(): void {
  console.log(`  ${chalk.bgGray.white(' G  GitHub OAuth ')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 1:')} ${chalk.white('Open GitHub Developer Settings')}`)
  console.log(`    ${chalk.cyan('https://github.com/settings/developers')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 2:')} ${chalk.white('Register a new OAuth App')}`)
  console.log(`    ${chalk.dim('• Click "New OAuth App" (top right)')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 3:')} ${chalk.white('Fill in application details')}`)
  console.log(`    ${chalk.dim('• Application name: your app name (e.g. "My App - Dev")')}`)
  console.log(`    ${chalk.dim('• Homepage URL: http://localhost:3000')}`)
  console.log(`    ${chalk.dim('• Authorization callback URL:')}`)
  console.log(`      ${chalk.cyan('http://localhost:3000/api/auth/callback/github')}`)
  console.log(
    `    ${chalk.dim('• For production: https://yourdomain.com/api/auth/callback/github')}`,
  )
  console.log(`    ${chalk.dim('• Click "Register application"')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 4:')} ${chalk.white('Copy your Client ID and Client Secret')}`)
  console.log(`    ${chalk.dim('• Client ID: shown at the top (starts with Iv1.)')}`)
  console.log(`    ${chalk.dim('• Client Secret: click "Generate a new client secret" if needed')}`)
  console.log(
    `    ${chalk.yellow('⚠  The client secret is shown only once — copy it immediately!')}`,
  )
  console.log()
}

function showDetailedDiscordGuide(): void {
  console.log(`  ${chalk.bgBlue.white(' D  Discord OAuth ')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 1:')} ${chalk.white('Open Discord Developer Portal')}`)
  console.log(`    ${chalk.cyan('https://discord.com/developers/applications')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 2:')} ${chalk.white('Create a new application')}`)
  console.log(`    ${chalk.dim('• Click "New Application" (top right)')}`)
  console.log(`    ${chalk.dim('• Name it your app name → "Create"')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 3:')} ${chalk.white('Copy your Client ID')}`)
  console.log(`    ${chalk.dim('• In the left sidebar: "OAuth2"')}`)
  console.log(`    ${chalk.dim('• Copy the "CLIENT ID" shown at the top')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 4:')} ${chalk.white('Generate a Client Secret')}`)
  console.log(`    ${chalk.dim('• Click "Reset Secret" to create a new one')}`)
  console.log(`    ${chalk.dim('• Copy the secret — it is shown only at generation time')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 5:')} ${chalk.white('Add redirect URIs')}`)
  console.log(`    ${chalk.dim('• In "OAuth2" page, click "Add Redirects"')}`)
  console.log(`    ${chalk.dim('• Add: http://localhost:3000/api/auth/callback/discord')}`)
  console.log(
    `    ${chalk.dim('• For production: https://yourdomain.com/api/auth/callback/discord')}`,
  )
  console.log(`    ${chalk.dim('• Click "Save Changes"')}`)
  console.log()
}
