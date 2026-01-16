# Pensieve

> *"One simply siphons the excess thoughts from one's mind, pours them into the basin, and examines them at one's leisure."*
> — Albus Dumbledore

A mobile-first AI chat that connects to your Obsidian vault. Search, read, create, and delete notes through natural conversation — all from your phone.

## Features

- **AI-Powered Chat** — Claude understands your vault structure and helps you find connections
- **Full CRUD** — Create, read, and delete notes with user approval for destructive actions
- **@ Mentions** — Type `@` to fuzzy-search and reference notes with `[[wiki links]]`
- **Mobile-First** — PWA-ready with responsive drawer/popup for note search
- **No Backend DB** — Sessions stored in IndexedDB (Dexie.js), vault synced via GitHub API
- **Dark Mode** — Because light mode is for people who hate their eyes

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 15 (App Router) |
| AI | Vercel AI SDK 6 + Claude Sonnet 4 |
| UI | AI Elements + shadcn/ui + Tailwind |
| Auth | iron-session + bcrypt password |
| Storage | Dexie.js (IndexedDB) |
| Vault | GitHub Contents API (Octokit) |

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- An Obsidian vault backed up to GitHub
- Anthropic API key

### Installation

```bash
# Clone the repo
git clone https://github.com/magnusrodseth/vault-website.git
cd vault-website

# Install dependencies
bun install

# Copy environment template
cp .env.example .env.local
```

### Environment Variables

```env
# Auth
SESSION_SECRET=your-32-character-random-string-here
APP_PASSWORD_HASH=$2b$10$...  # bcrypt hash of your password

# AI
ANTHROPIC_API_KEY=sk-ant-...

# GitHub (for vault access)
GITHUB_TOKEN=ghp_...         # Fine-grained PAT with Contents read/write
GITHUB_REPO=your-username/your-vault-repo

# Vault path (for Vercel, use /tmp/vault)
VAULT_PATH=/tmp/vault
```

Generate a password hash:

```bash
./scripts/generate-password-hash.sh your-password
```

### Development

```bash
bun run dev     # Start dev server at localhost:3000
bun run build   # Production build
bun run lint    # Biome lint check
bun run format  # Biome format
```

## Vault Tools

The AI has access to these tools for interacting with your vault:

| Tool | Description |
|------|-------------|
| `listNotes` | Search notes with glob patterns (`*agent*`, `Learning/*`) |
| `readNote` | Read full content of a note |
| `createNote` | Create a single note (requires approval) |
| `createNotes` | Batch create multiple notes (single approval) |
| `deleteNote` | Delete a single note (requires approval) |
| `deleteNotes` | Batch delete notes (single approval) |

All write operations commit directly to GitHub.

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/        # Password login
│   ├── chat/[sessionId]/    # Main chat interface
│   └── api/
│       ├── auth/            # Login/logout
│       ├── chat/            # AI streaming + vault tools
│       └── vault/           # GitHub API endpoints
├── components/
│   ├── ai-elements/         # AI SDK chat components
│   ├── ui/                  # shadcn/ui components
│   └── note-mention-popup.tsx
└── lib/
    ├── github/api.ts        # Octokit wrapper
    └── db/                  # Dexie.js schema + hooks
```

## Deployment

Deploy to Vercel:

```bash
vercel
```

Set environment variables in Vercel dashboard, then add your custom domain.

## PWA

Pensieve is PWA-ready. Add to home screen on iOS/Android for a native app experience.

Lighthouse scores:
- Performance: 96
- Accessibility: 92
- Best Practices: 100
- SEO: 100

## License

MIT
