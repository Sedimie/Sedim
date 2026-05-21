# TOTP Two-Factor Authentication

Add time-based one-time password (TOTP) 2FA to your auth setup.

## Overview

TOTP is the standard used by Google Authenticator, Authy, and 1Password. Sedim implements RFC 6238 with AES-256-GCM encryption for TOTP secrets at rest.

## Requirements

Enable in `sedim.config.ts`:

```typescript
export default {
  auth: {
    providers: ['totp'],
  },
};
```

## User Flow

1. User navigates to account security settings
2. Clicks "Enable 2FA"
3. Scans QR code with authenticator app
4. Enters 6-digit code to verify setup
5. Receives 10 backup codes (one-time use)

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/totp/setup` | POST | Get TOTP URI and backup codes |
| `/auth/totp/verify` | POST | Verify code and enable TOTP |
| `/auth/totp/disable` | POST | Disable TOTP (requires current password) |

## Setup Example

```typescript
// POST /auth/totp/setup
// Response:
{
  "uri": "otpauth://totp/Sedim:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=Sedim",
  "backupCodes": ["a1b2c3d4", "e5f6g7h8", ...]
}
```

## Backup Codes

10 backup codes are generated during TOTP setup. Each code can only be used once. They're stored as bcrypt hashes in the `backup_codes` table.

Store them securely with the user — show once, don't persist in plain text.

## Disabling TOTP

```typescript
// POST /auth/totp/disable
// Body: { password: string }

fetch('/auth/totp/disable', {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ password }),
});
```

Requires the user's current password to prevent account takeover via stolen sessions.