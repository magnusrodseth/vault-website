# Pensieve - Agent Instructions

AI-powered Obsidian vault assistant. Next.js 15 + AI SDK 6 + Dexie.js.

## Commands

```bash
bun run dev          # Start dev server (localhost:3000)
bun run build        # Production build
bun run lint         # Biome check (lint + format check)
bun run format       # Biome format (auto-fix)
```

No test suite configured. Verify changes with `bun run build`.

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/        # Password login page
│   ├── (chat)/              # Redirect to chat
│   ├── chat/[sessionId]/    # Main chat interface
│   └── api/
│       ├── auth/            # Login/logout
│       ├── chat/            # AI streaming + vault tools
│       └── vault/           # GitHub API + sync
├── components/
│   ├── ai-elements/         # AI SDK chat components
│   ├── ui/                  # shadcn/ui components
│   ├── note-mention-popup.tsx  # @ mention search
│   └── session-sidebar.tsx  # Conversation list
└── lib/
    ├── github/api.ts        # GitHub Contents API
    ├── vault/               # Local vault operations
    └── db/                  # Dexie.js (IndexedDB)
```

## Code Style

### Formatting (Biome)
- 2 spaces indentation
- Double quotes for strings
- Semicolons required
- Max line length: not enforced, but prefer ~100 chars

### Imports
```typescript
// 1. External packages
import { useEffect, useState } from "react";
import { useChat } from "@ai-sdk/react";

// 2. Internal aliases (@/*)
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// 3. Relative imports (same module)
import { Shimmer } from "./shimmer";
```

### TypeScript
- Strict mode enabled
- Prefer `interface` over `type` for object shapes
- Use `type` for unions, intersections, primitives
- No `any` - use `unknown` and narrow types
- No `@ts-ignore` or `@ts-expect-error`

```typescript
// Good
interface Note {
  path: string;
  title: string;
}

type Status = "idle" | "loading" | "error";

// Bad
const data: any = fetchData();
```

### Naming
- Components: PascalCase (`NoteMentionPopup`)
- Files: kebab-case (`note-mention-popup.tsx`)
- Hooks: camelCase with `use` prefix (`useMessages`)
- Constants: SCREAMING_SNAKE_CASE for true constants
- Boolean props: `is`, `has`, `should` prefix

### React Patterns
```typescript
// Client components
"use client";

// Props interface above component
interface ButtonProps {
  variant?: "default" | "ghost";
  children: React.ReactNode;
}

// Destructure props
export function Button({ variant = "default", children }: ButtonProps) {
  return <button className={cn(variants[variant])}>{children}</button>;
}

// Use memo for expensive components
export const ExpensiveList = memo(function ExpensiveList({ items }: Props) {
  return items.map(item => <Item key={item.id} {...item} />);
});
```

### Error Handling
```typescript
// API routes - return structured errors
export async function GET() {
  try {
    const data = await fetchData();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Client - handle with state
const [error, setError] = useState<string | null>(null);
```

## Key Patterns

### AI SDK 6 Chat
```typescript
const { messages, sendMessage, status } = useChat({
  transport: new DefaultChatTransport({ api: "/api/chat" }),
  onFinish: async ({ message }) => {
    await saveMessage(sessionId, message);
  },
});
```

### Vault Tools (API Route)
```typescript
const vaultTools = {
  search: tool({
    description: "Search vault for content",
    inputSchema: z.object({
      query: z.string(),
      folder: z.string().optional(),
    }),
    execute: async ({ query, folder }) => {
      return await searchVault(query, folder);
    },
  }),
};
```

### GitHub API (Notes)
```typescript
// Fetch markdown files from GitHub repo
const notes = await getMarkdownFiles(); // Uses Contents API
```

### Dexie.js (Client Storage)
```typescript
// Hooks for reactive queries
const sessions = useSessions();
const messages = useMessages(sessionId);

// Mutations
await createSession();
await saveMessage(sessionId, { role: "user", content: text });
```

## Component Guidelines

### AI Elements (`src/components/ai-elements/`)
- Pre-built chat UI components from AI SDK
- Use composition pattern (e.g., `Message`, `MessageContent`, `MessageResponse`)
- Customize via className, not by modifying source

### UI Components (`src/components/ui/`)
- shadcn/ui components - copy-paste, fully owned
- Use `cn()` utility for conditional classes
- Extend via variants using `class-variance-authority`

### Custom Components
- Place in `src/components/`
- One component per file
- Export named, not default
- Include TypeScript props interface

## Environment Variables

Required in `.env.local`:
```
SESSION_SECRET=         # 32+ char random string
APP_PASSWORD_HASH=      # bcrypt hash (use scripts/generate-password-hash.sh)
ANTHROPIC_API_KEY=      # sk-ant-...
GITHUB_TOKEN=           # Fine-grained PAT with Contents read
GITHUB_REPO=            # owner/repo format
VAULT_PATH=             # /tmp/vault for Vercel
```

## Dark Mode

App is dark-mode only. Set via `<html class="dark">` in layout.tsx.
CSS variables defined in `globals.css` under `.dark` selector.

## PWA

Icons in `/public/`:
- `icon-192.png`, `icon-512.png` - PWA manifest
- `apple-touch-icon.png` - iOS
- `favicon.ico` - Browser tab (also in `src/app/`)
- `logo.png` - Header branding
