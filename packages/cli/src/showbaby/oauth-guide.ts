import chalk from 'chalk'

// ============================================================
// OAuth Setup Guide — shown when user declines the plan
// Provides detailed step-by-step instructions to obtain
// client IDs and secrets from each OAuth provider
// ============================================================

export function showOAuthSetupGuide(selectedProviders: string[]): void {
  console.log()
  console.log(
    `  ${chalk.bgYellow.black(' 📋  Setup Guide ')}  ${chalk.dim('Run `sedim add auth` again when you have your credentials')}`,
  )
  console.log()
  console.log(`  ${chalk.dim('Follow the steps below to obtain your OAuth credentials.')}`)
  console.log(`  ${chalk.dim('When done, run `sedim add auth` again and paste the values.')}`)
  console.log()

  if (
    selectedProviders.includes('oauth-google') ||
    selectedProviders.includes('GOOGLE_CLIENT_ID')
  ) {
    showGoogleGuide()
  }
  if (
    selectedProviders.includes('oauth-github') ||
    selectedProviders.includes('GITHUB_CLIENT_ID')
  ) {
    showGithubGuide()
  }
  if (
    selectedProviders.includes('oauth-discord') ||
    selectedProviders.includes('DISCORD_CLIENT_ID')
  ) {
    showDiscordGuide()
  }

  console.log()
  console.log(`  ${chalk.bgBlue.black(' 💡  Tip ')}`)
  console.log()
  console.log(`  ${chalk.dim('All OAuth apps require a Redirect URI. Use:')}`)
  console.log(`    ${chalk.cyan('http://localhost:3000/api/auth/callback/google')}`)
  console.log(`    ${chalk.cyan('http://localhost:3000/api/auth/callback/github')}`)
  console.log(`    ${chalk.cyan('http://localhost:3000/api/auth/callback/discord')}`)
  console.log()
  console.log(`  ${chalk.dim('For production, replace localhost:3000 with your actual domain.')}`)
  console.log()
}

function showGoogleGuide(): void {
  console.log(`  ${chalk.bgRed.white(' G  Google OAuth ')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 1:')} ${chalk.white('Go to Google Cloud Console')}`)
  console.log(`    ${chalk.cyan('https://console.cloud.google.com/apis/credentials')}`)
  console.log()
  console.log(
    `  ${chalk.bold('Step 2:')} ${chalk.white('Create a new project (or select existing)')}`,
  )
  console.log(`    ${chalk.dim('• Click "Select Project" at the top')}`)
  console.log(`    ${chalk.dim('• Click "New Project"')}`)
  console.log(`    ${chalk.dim('• Name it anything (e.g. "My App Auth")')}`)
  console.log(`    ${chalk.dim('• Click "Create"')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 3:')} ${chalk.white('Configure the OAuth consent screen')}`)
  console.log(
    `    ${chalk.dim('• In the left sidebar: "APIs & Services" → "OAuth consent screen"')}`,
  )
  console.log(`    ${chalk.dim('• Choose "External" → Click "Create"')}`)
  console.log(`    ${chalk.dim('• App name: your app name')}`)
  console.log(`    ${chalk.dim('• User support email: your email')}`)
  console.log(`    ${chalk.dim('• Developer contact: your email')}`)
  console.log(`    ${chalk.dim('• Click "Save and Continue" through all screens')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 4:')} ${chalk.white('Create the OAuth 2.0 Client ID')}`)
  console.log(`    ${chalk.dim('• Go to "APIs & Services" → "Credentials"')}`)
  console.log(`    ${chalk.dim('• Click "Create Credentials" → "OAuth client ID"')}`)
  console.log(`    ${chalk.dim('• Application type: "Web application"')}`)
  console.log(`    ${chalk.dim('• Name: "Web client" (or your app name)')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 5:')} ${chalk.white('Add authorized redirect URIs')}`)
  console.log(`    ${chalk.dim('• In "Authorized redirect URIs", click "Add URI"')}`)
  console.log(`    ${chalk.dim('• Add: http://localhost:3000/api/auth/callback/google')}`)
  console.log(
    `    ${chalk.dim('• For production: https://yourdomain.com/api/auth/callback/google')}`,
  )
  console.log(`    ${chalk.dim('• Click "Create"')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 6:')} ${chalk.white('Copy your credentials')}`)
  console.log(`    ${chalk.dim('• A modal appears with your:')}`)
  console.log(
    `    ${chalk.green('  →')} ${chalk.bold('Client ID')}  (looks like: 123456789-abc123def456.apps.googleusercontent.com)`,
  )
  console.log(
    `    ${chalk.green('  →')} ${chalk.bold('Client secret')} (looks like: GOCSPX-abcdefghijklmnopqrstuv)`,
  )
  console.log()
  console.log(`  ${chalk.yellow('⚠  Save both values. The client secret is shown only once.')}`)
  console.log()
}

function showGithubGuide(): void {
  console.log(`  ${chalk.bgGray.white(' G  GitHub OAuth ')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 1:')} ${chalk.white('Go to GitHub Developer Settings')}`)
  console.log(`    ${chalk.cyan('https://github.com/settings/developers')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 2:')} ${chalk.white('Register a new OAuth App')}`)
  console.log(`    ${chalk.dim('• Click "New OAuth App" (top right)')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 3:')} ${chalk.white('Fill in the application details')}`)
  console.log(`    ${chalk.dim('• Application name: your app name (e.g. "My App - Development")')}`)
  console.log(`    ${chalk.dim('• Homepage URL: http://localhost:3000')}`)
  console.log(`    ${chalk.dim('• Description: (optional) Authentication for your app')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 4:')} ${chalk.white('Set the Authorization callback URL')}`)
  console.log(`    ${chalk.dim('• Callback URL: http://localhost:3000/api/auth/callback/github')}`)
  console.log(
    `    ${chalk.dim('• For production: https://yourdomain.com/api/auth/callback/github')}`,
  )
  console.log(`    ${chalk.dim('• Click "Register application"')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 5:')} ${chalk.white('Copy your credentials')}`)
  console.log(`    ${chalk.dim('• On the next screen, under "Client secrets":')}`)
  console.log(
    `    ${chalk.green('  →')} ${chalk.bold('Client ID')}  shown at the top (starts with: Iv1.)`,
  )
  console.log(
    `    ${chalk.green('  →')} ${chalk.bold('Client secret')}  click "Generate a new client secret" if needed`,
  )
  console.log()
  console.log(
    `  ${chalk.yellow('⚠  GitHub will show the client secret only once. Save it immediately.')}`,
  )
  console.log()
}

function showDiscordGuide(): void {
  console.log(`  ${chalk.bgBlue.white(' D  Discord OAuth ')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 1:')} ${chalk.white('Go to Discord Developer Portal')}`)
  console.log(`    ${chalk.cyan('https://discord.com/developers/applications')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 2:')} ${chalk.white('Create a new application')}`)
  console.log(`    ${chalk.dim('• Click "New Application" (top right)')}`)
  console.log(`    ${chalk.dim('• Name it your app name')}`)
  console.log(`    ${chalk.dim('• Click "Create"')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 3:')} ${chalk.white('Go to the OAuth2 settings')}`)
  console.log(`    ${chalk.dim('• In the left sidebar: "OAuth2"')}`)
  console.log(`    ${chalk.dim('• Copy the "CLIENT ID" — shown at the top')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 4:')} ${chalk.white('Reset or copy the Client Secret')}`)
  console.log(`    ${chalk.dim('• Click "Reset Secret" to generate a new one')}`)
  console.log(`    ${chalk.dim('• Copy the secret — it is shown only at generation time')}`)
  console.log()
  console.log(`  ${chalk.bold('Step 5:')} ${chalk.white('Add redirect URIs')}`)
  console.log(`    ${chalk.dim('• In "OAuth2" settings, click "Add Redirects"')}`)
  console.log(`    ${chalk.dim('• Add: http://localhost:3000/api/auth/callback/discord')}`)
  console.log(
    `    ${chalk.dim('• For production: https://yourdomain.com/api/auth/callback/discord')}`,
  )
  console.log(`    ${chalk.dim('• Click "Save Changes"')}`)
  console.log()
  console.log(
    `  ${chalk.green('  →')} ${chalk.bold('Client ID')}  and ${chalk.bold('Client secret')} are in the same OAuth2 page`,
  )
  console.log()
}

// ============================================================
// Summary of all required env vars with quick-reference
// ============================================================

export function showQuickEnvSummary(envVars: Array<{ key: string; description: string }>): void {
  console.log()
  console.log(`  ${chalk.bgMagenta.white(' 📝  Required Environment Variables ')}`)
  console.log()
  for (const e of envVars) {
    const example = getExample(e.key)
    console.log(`    ${chalk.magenta('●')} ${chalk.bold.magenta(e.key)}`)
    console.log(`      ${chalk.dim(e.description)}`)
    if (example) {
      console.log(`      ${chalk.dim('e.g.')} ${chalk.cyan(example)}`)
    }
    console.log()
  }
}

function getExample(key: string): string | undefined {
  const examples: Record<string, string> = {
    AUTH_SECRET: 'openssl rand -hex 32',
    DATABASE_URL: 'postgresql://user:password@localhost:5432/mydb',
    APP_URL: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: '123456789-abc123def456.apps.googleusercontent.com',
    GOOGLE_CLIENT_SECRET: 'GOCSPX-abcdefghijklmnopqrstuv',
    GITHUB_CLIENT_ID: 'Iv1.0123456789abcdef',
    GITHUB_CLIENT_SECRET: '0123456789abcdefghijklmnopqrstuvwxyzABCDEF',
    DISCORD_CLIENT_ID: '123456789012345678',
    DISCORD_CLIENT_SECRET: 'your-discord-client-secret-here',
    SMTP_HOST: 'smtp.resend.com',
    SMTP_PORT: '587',
    SMTP_USER: 'resend_xxxxx',
    SMTP_PASS: 're_xxxxx',
    SMTP_FROM: 'auth@yourdomain.com',
  }
  return examples[key]
}
