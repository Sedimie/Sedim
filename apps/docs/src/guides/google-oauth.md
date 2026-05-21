# Google OAuth Setup

Configure Google OAuth for your Sedim auth integration.

## Prerequisites

- A Google Cloud project at [console.cloud.google.com](https://console.cloud.google.com)
- OAuth consent screen configured
- Credentials created (OAuth 2.0 Client ID)

## Setup Steps

### 1. Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Application type: **Web application**
4. Add authorized redirect URI:
   ```
   http://localhost:3000/auth/oauth/google/callback
   ```
   For production, use your actual domain.

### 2. Get Your Client ID and Secret

From the credentials page, copy:
- **Client ID** → `OAUTH_GOOGLE_ID`
- **Client secret** → `OAUTH_GOOGLE_SECRET`

### 3. Add to Environment

```env
OAUTH_GOOGLE_ID=your-client-id.apps.googleusercontent.com
OAUTH_GOOGLE_SECRET=your-client-secret
```

### 4. Enable in sedim.config.ts

```typescript
export default {
  auth: {
    providers: ['google-oauth'],
  },
};
```

## Production Checklist

Before going live:

- [ ] Set `OAUTH_GOOGLE_ID` and `OAUTH_GOOGLE_SECRET` in production env
- [ ] Add production callback URL in Google Cloud Console (e.g., `https://yourdomain.com/auth/oauth/google/callback`)
- [ ] Verify your app domain in Google OAuth consent screen
- [ ] Publish the OAuth consent screen (or it stays in "testing" mode with limited users)

## Testing Locally

The local callback `http://localhost:3000/auth/oauth/google/callback` works out of the box with default configuration. Users will be redirected to Google, then back after authorization.

## Scopes Requested

Sedim requests the following Google OAuth scopes:
- `openid`
- `email`
- `profile`

No additional scopes are requested. The email and basic profile info are stored in the `oauth_accounts` table on first login, and the user is created automatically.