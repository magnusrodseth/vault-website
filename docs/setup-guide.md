# Pensieve Setup Guide

Pensieve is a mobile-friendly AI chat application that provides context from your Obsidian vault.

## Prerequisites

- [Bun](https://bun.sh/) (v1.0+)
- [Node.js](https://nodejs.org/) (v20+)
- A GitHub account with a private Obsidian vault repository
- An Anthropic API key

## Local Development Setup

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd vault-website
bun install
```

### 2. Environment Variables

Copy the example environment file:

```bash
cp .env.example .env.local
```

Configure the following variables in `.env.local`:

#### SESSION_SECRET

A 32+ character random string for encrypting session cookies.

Generate one:

```bash
openssl rand -base64 32
```

#### APP_PASSWORD_HASH

A base64-encoded bcrypt hash of your login password.

Generate one using the provided script:

```bash
./scripts/generate-password-hash.sh your-password
```

This will automatically update your `.env.local` file.

#### ANTHROPIC_API_KEY

Get your API key from [Anthropic Console](https://console.anthropic.com/).

Format: `sk-ant-api03-...`

#### GITHUB_TOKEN

Create a fine-grained personal access token:

1. Go to [GitHub Settings > Developer Settings > Personal Access Tokens > Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click "Generate new token"
3. Set expiration as needed
4. Under "Repository access", select "Only select repositories" and choose your vault repo
5. Under "Permissions > Repository permissions", grant:
   - Contents: Read and write
   - Metadata: Read-only
6. Generate and copy the token

Format: `github_pat_...` or `ghp_...`

#### GITHUB_REPO

Your vault repository in `owner/repo` format.

Example: `magnusrodseth/vault`

#### VAULT_PATH

Local path where the vault will be cloned.

- Local development: Use any path, e.g., `./data/vault` or `/tmp/vault`
- Production (Vercel): Must use `/tmp/vault` (only writable directory)

### 3. Run Development Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) and log in with your password.

## Production Deployment (Vercel)

### 1. Connect Repository

1. Go to [Vercel](https://vercel.com/) and create a new project
2. Import your GitHub repository
3. Vercel will auto-detect Next.js settings

### 2. Configure Environment Variables

In Vercel project settings, add these environment variables:

| Variable | Value | Notes |
|----------|-------|-------|
| `SESSION_SECRET` | Your 32+ char secret | Generate fresh for production |
| `APP_PASSWORD_HASH` | Base64 bcrypt hash | Generate with script, copy the value |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Your Anthropic API key |
| `GITHUB_TOKEN` | `github_pat_...` | Fine-grained token with repo access |
| `GITHUB_REPO` | `owner/repo` | Your vault repository |
| `VAULT_PATH` | `/tmp/vault` | Required - only writable path on Vercel |

### 3. Deploy

Push to your main branch or trigger a manual deployment from Vercel dashboard.

### 4. First Sync

After deployment, the vault will be cloned on first API request. You can manually trigger a sync:

```bash
curl -X POST https://your-domain.vercel.app/api/vault/sync \
  -H "Cookie: pensieve-session=<your-session-cookie>"
```

## Project Structure

```
vault-website/
├── src/
│   ├── app/
│   │   ├── (auth)/login/     # Login page
│   │   ├── (chat)/           # Main chat interface
│   │   └── api/
│   │       ├── auth/         # Login/logout endpoints
│   │       ├── chat/         # AI chat streaming
│   │       └── vault/        # Vault sync and file listing
│   ├── components/
│   │   ├── ai-elements/      # AI chat UI components
│   │   └── ui/               # shadcn/ui components
│   └── lib/
│       ├── auth/             # Session configuration
│       ├── db/               # Dexie IndexedDB (client-side)
│       └── vault/            # Vault sync and search
├── public/
│   └── manifest.json         # PWA manifest
└── docs/
    └── setup-guide.md        # This file
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start development server |
| `bun run build` | Build for production |
| `bun run start` | Start production server |
| `bun run lint` | Run Biome linter |
| `bun run format` | Format code with Biome |

## Troubleshooting

### "Invalid password" on login

Regenerate your password hash:

```bash
./scripts/generate-password-hash.sh your-password
```

Then restart the dev server.

### Vault not syncing

1. Check `GITHUB_TOKEN` has correct permissions (Contents: read/write)
2. Verify `GITHUB_REPO` format is `owner/repo`
3. Check Vercel function logs for errors

### Session not persisting

1. Ensure `SESSION_SECRET` is at least 32 characters
2. In production, verify the domain is using HTTPS (cookies require secure context)

### Build errors with AI SDK

This project uses AI SDK v6. If you see type errors related to `maxSteps`, `parameters`, or `UIMessage.content`, ensure you're using the correct v6 APIs:

- `maxSteps` → `stopWhen: stepCountIs(n)`
- `parameters` → `inputSchema` in tool definitions
- `message.content` → `message.parts` for UI rendering

## Security Notes

- Never commit `.env.local` or expose environment variables
- Use a strong, unique password for the app
- Rotate `GITHUB_TOKEN` periodically
- The app uses HTTP-only, secure cookies for session management
