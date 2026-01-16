# Pensieve — Technical Specification

> *"One simply siphons the excess thoughts from one's mind, pours them into the basin, and examines them at one's leisure. It becomes easier to spot patterns and links, you understand, when they are in this form."*
> — Albus Dumbledore

---

## Overview

| Attribute | Value |
|-----------|-------|
| **Repo** | `magnusrodseth/vault-website` |
| **Product Name** | Pensieve |
| **Domain** | `vault.magnusrodseth.com` |
| **Host** | Vercel |
| **Database** | None (Dexie.js / IndexedDB client-side) |

A self-hosted, mobile-friendly AI chat that gives you context from your Obsidian vault on the go.

---

## Core Concept

```
┌─────────────────────────────────────────────────────────────────────┐
│                          PENSIEVE                                    │
│                                                                      │
│     "One simply siphons the excess thoughts from one's mind,        │
│      pours them into the basin, and examines them at one's          │
│      leisure."                                                       │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  🪄 What patterns connect EdTech and @Norwegian Market...   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                              │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  AI Elements Chat UI                                        │    │
│  │  ┌─────────────────────────────────────────────────────┐   │    │
│  │  │ "What did I write about @EdTech..."                 │   │    │
│  │  │            ┌─────────────────────┐                  │   │    │
│  │  │            │ 📄 EdTech Market    │ ← Fuzzy search   │   │    │
│  │  │            │ 📄 EdTech Lærer...  │   autocomplete   │   │    │
│  │  │            └─────────────────────┘                  │   │    │
│  │  └─────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│  ┌───────────────────────────▼───────────────────────────────┐     │
│  │  Dexie.js (IndexedDB)                                      │     │
│  │  ├─ sessions: { id, title, createdAt, updatedAt }         │     │
│  │  └─ messages: { id, sessionId, role, content, parts, ts } │     │
│  └────────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SERVER (Vercel Edge)                             │
│                                                                      │
│   ┌──────────┐    ┌──────────────┐    ┌─────────────────────┐      │
│   │  Auth    │───▶│  AI + Tools  │───▶│  GitHub Vault Sync  │      │
│   │ (simple) │    │  (Claude)    │    │  (on-demand clone)  │      │
│   └──────────┘    └──────────────┘    └─────────────────────┘      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| **Framework** | Next.js 15 (App Router) | SSR, API routes, edge |
| **UI** | **AI Elements** + shadcn/ui | Production-ready chat components |
| **AI** | Vercel AI SDK 6 | `useChat`, streaming, tool calling |
| **LLM** | Claude via AI Gateway | $5/mo free tier |
| **Auth** | iron-session + password | "Only me" pattern |
| **Sessions** | **Dexie.js** (IndexedDB) | No backend DB needed |
| **Vault** | GitHub API + simple-git | Clone on-demand |
| **Autocomplete** | **cmdk** + fuse.js | `@` trigger fuzzy search |
| **Deploy** | Vercel → `vault.magnusrodseth.com` | Custom domain |

---

## File Structure

```
vault-website/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx              # Password form
│   ├── (chat)/
│   │   ├── page.tsx                  # Main chat (AI Elements)
│   │   └── [sessionId]/
│   │       └── page.tsx              # Load specific session
│   ├── api/
│   │   ├── chat/route.ts             # AI streaming + tools
│   │   ├── vault/
│   │   │   ├── sync/route.ts         # Pull latest
│   │   │   ├── search/route.ts       # Grep vault
│   │   │   ├── files/route.ts        # List files (for @autocomplete)
│   │   │   └── read/route.ts         # Read file
│   │   └── auth/route.ts
│   └── layout.tsx
├── components/
│   ├── ai-elements/                  # Installed via `npx ai-elements`
│   │   ├── conversation.tsx
│   │   ├── message.tsx
│   │   ├── prompt-input.tsx
│   │   ├── reasoning.tsx
│   │   ├── sources.tsx
│   │   └── loader.tsx
│   ├── mention-autocomplete.tsx      # @-trigger fuzzy search
│   └── session-sidebar.tsx           # List of past sessions
├── lib/
│   ├── ai/
│   │   ├── tools.ts                  # Vault tools
│   │   └── system-prompt.ts
│   ├── vault/
│   │   ├── sync.ts
│   │   ├── search.ts
│   │   └── files.ts
│   ├── db/
│   │   └── dexie.ts                  # IndexedDB schema
│   └── auth/
│       └── session.ts
├── middleware.ts
└── .env.local
```

---

## Component Implementations

### 1. Dexie.js — Local Session Storage

```typescript
// lib/db/dexie.ts
import Dexie, { type EntityTable } from 'dexie';

interface Session {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  parts?: any[];  // For reasoning, sources, tool calls
  createdAt: Date;
}

const db = new Dexie('Pensieve') as Dexie & {
  sessions: EntityTable<Session, 'id'>;
  messages: EntityTable<Message, 'id'>;
};

db.version(1).stores({
  sessions: 'id, createdAt, updatedAt',
  messages: 'id, sessionId, createdAt',
});

export { db };
export type { Session, Message };
```

```typescript
// lib/db/hooks.ts
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Session, type Message } from './dexie';
import { nanoid } from 'nanoid';

export function useSessions() {
  return useLiveQuery(
    () => db.sessions.orderBy('updatedAt').reverse().toArray()
  );
}

export function useMessages(sessionId: string) {
  return useLiveQuery(
    () => db.messages.where('sessionId').equals(sessionId).sortBy('createdAt'),
    [sessionId]
  );
}

export async function createSession(): Promise<string> {
  const id = nanoid();
  await db.sessions.add({
    id,
    title: 'New conversation',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function saveMessage(sessionId: string, message: Omit<Message, 'id' | 'createdAt'>) {
  await db.messages.add({
    ...message,
    id: nanoid(),
    sessionId,
    createdAt: new Date(),
  });
  
  // Update session timestamp & title (from first user message)
  const session = await db.sessions.get(sessionId);
  if (session?.title === 'New conversation' && message.role === 'user') {
    await db.sessions.update(sessionId, {
      title: message.content.slice(0, 50) + (message.content.length > 50 ? '...' : ''),
      updatedAt: new Date(),
    });
  } else {
    await db.sessions.update(sessionId, { updatedAt: new Date() });
  }
}

export async function deleteSession(sessionId: string) {
  await db.messages.where('sessionId').equals(sessionId).delete();
  await db.sessions.delete(sessionId);
}
```

---

### 2. `@` Mention Autocomplete (Fuzzy Note Search)

```typescript
// components/mention-autocomplete.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/popover';
import Fuse from 'fuse.js';
import { FileTextIcon } from 'lucide-react';

interface Note {
  path: string;
  title: string;
}

interface MentionAutocompleteProps {
  notes: Note[];
  onSelect: (note: Note) => void;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  text: string;
  cursorPosition: number;
}

export function MentionAutocomplete({ 
  notes, 
  onSelect, 
  inputRef, 
  text, 
  cursorPosition 
}: MentionAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Detect @ trigger
  useEffect(() => {
    const textBeforeCursor = text.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/@([^\s@]*)$/);
    
    if (match) {
      setQuery(match[1]);
      setOpen(true);
      
      // Calculate popup position (simplified)
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        setPosition({ top: rect.bottom + 4, left: rect.left });
      }
    } else {
      setOpen(false);
    }
  }, [text, cursorPosition]);

  // Fuzzy search
  const fuse = new Fuse(notes, {
    keys: ['title', 'path'],
    threshold: 0.4,
    includeScore: true,
  });

  const results = query 
    ? fuse.search(query).slice(0, 8).map(r => r.item)
    : notes.slice(0, 8);

  const handleSelect = (note: Note) => {
    onSelect(note);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <span style={{ position: 'absolute', top: position.top, left: position.left }} />
      </PopoverAnchor>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search notes..." value={query} />
          <CommandList>
            <CommandEmpty>No notes found</CommandEmpty>
            <CommandGroup heading="Notes">
              {results.map((note) => (
                <CommandItem
                  key={note.path}
                  value={note.path}
                  onSelect={() => handleSelect(note)}
                >
                  <FileTextIcon className="mr-2 h-4 w-4" />
                  <span>{note.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground truncate max-w-32">
                    {note.path}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

```typescript
// API endpoint to fetch note list for autocomplete
// app/api/vault/files/route.ts
import { NextResponse } from 'next/server';
import { glob } from 'glob';
import path from 'path';

const VAULT_PATH = process.env.VAULT_PATH || '/tmp/vault';

export async function GET() {
  const files = await glob('**/*.md', { 
    cwd: VAULT_PATH,
    ignore: ['node_modules/**', '.git/**', '.obsidian/**']
  });

  const notes = files.map(file => ({
    path: file,
    title: path.basename(file, '.md'),
  }));

  return NextResponse.json({ notes });
}
```

---

### 3. Chat Page with AI Elements

```tsx
// app/(chat)/page.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { nanoid } from 'nanoid';
import { useRouter } from 'next/navigation';

// AI Elements
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation';
import {
  Message,
  MessageContent,
  MessageResponse,
  MessageActions,
  MessageAction,
} from '@/components/ai-elements/message';
import {
  PromptInput,
  PromptInputBody,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';
import { Loader } from '@/components/ai-elements/loader';

// Custom components
import { MentionAutocomplete } from '@/components/mention-autocomplete';
import { SessionSidebar } from '@/components/session-sidebar';

// Dexie
import { useSessions, createSession, saveMessage } from '@/lib/db/hooks';

import { CopyIcon, RefreshCcwIcon, PlusIcon, MenuIcon } from 'lucide-react';

export default function ChatPage() {
  const router = useRouter();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [notes, setNotes] = useState<{ path: string; title: string }[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sessions = useSessions();

  // Fetch note list for @autocomplete
  useEffect(() => {
    fetch('/api/vault/files')
      .then(r => r.json())
      .then(data => setNotes(data.notes));
  }, []);

  // Create new session on mount if none
  useEffect(() => {
    if (!sessionId) {
      createSession().then(id => setSessionId(id));
    }
  }, [sessionId]);

  const { messages, sendMessage, status, regenerate, setMessages } = useChat({
    api: '/api/chat',
    id: sessionId || undefined,
    onFinish: async (message) => {
      if (sessionId) {
        await saveMessage(sessionId, {
          sessionId,
          role: message.role,
          content: message.content,
          parts: message.parts,
        });
      }
    },
  });

  const handleSubmit = async (message: PromptInputMessage) => {
    if (!message.text?.trim()) return;

    // Save user message
    if (sessionId) {
      await saveMessage(sessionId, {
        sessionId,
        role: 'user',
        content: message.text,
      });
    }

    sendMessage({ text: message.text });
    setInput('');
  };

  const handleMentionSelect = (note: { path: string; title: string }) => {
    // Replace @query with [[Note Name]]
    const beforeCursor = input.slice(0, cursorPosition);
    const afterCursor = input.slice(cursorPosition);
    const match = beforeCursor.match(/@([^\s@]*)$/);
    
    if (match) {
      const newBefore = beforeCursor.slice(0, -match[0].length) + `[[${note.title}]]`;
      setInput(newBefore + afterCursor);
    }
  };

  const handleNewSession = async () => {
    const id = await createSession();
    setSessionId(id);
    setMessages([]);
    setInput('');
  };

  return (
    <div className="flex h-dvh">
      {/* Sidebar (mobile: drawer, desktop: always visible) */}
      <SessionSidebar 
        sessions={sessions || []}
        currentSessionId={sessionId}
        onSelectSession={setSessionId}
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {/* Header */}
        <header className="flex items-center gap-2 p-4 border-b">
          <button onClick={() => setSidebarOpen(true)} className="md:hidden">
            <MenuIcon className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold flex-1">🪄 Pensieve</h1>
          <button onClick={handleNewSession} className="p-2 hover:bg-muted rounded">
            <PlusIcon className="h-5 w-5" />
          </button>
        </header>

        {/* Conversation */}
        <Conversation className="flex-1">
          <ConversationContent>
            {messages.map((message) => (
              <div key={message.id}>
                {/* Sources */}
                {message.role === 'assistant' && 
                  message.parts?.filter(p => p.type === 'source-url').length > 0 && (
                  <Sources>
                    <SourcesTrigger count={message.parts.filter(p => p.type === 'source-url').length} />
                    <SourcesContent>
                      {message.parts
                        .filter(p => p.type === 'source-url')
                        .map((part, i) => (
                          <Source key={i} href={part.url} title={part.url} />
                        ))}
                    </SourcesContent>
                  </Sources>
                )}

                {/* Message parts */}
                {message.parts?.map((part, i) => {
                  switch (part.type) {
                    case 'text':
                      return (
                        <Message key={`${message.id}-${i}`} from={message.role}>
                          <MessageContent>
                            <MessageResponse>{part.text}</MessageResponse>
                          </MessageContent>
                          {message.role === 'assistant' && (
                            <MessageActions>
                              <MessageAction onClick={() => regenerate()} label="Retry">
                                <RefreshCcwIcon className="size-3" />
                              </MessageAction>
                              <MessageAction 
                                onClick={() => navigator.clipboard.writeText(part.text)} 
                                label="Copy"
                              >
                                <CopyIcon className="size-3" />
                              </MessageAction>
                            </MessageActions>
                          )}
                        </Message>
                      );
                    case 'reasoning':
                      return (
                        <Reasoning key={`${message.id}-${i}`} isStreaming={status === 'streaming'}>
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    default:
                      return null;
                  }
                }) || (
                  // Fallback for simple content
                  <Message key={message.id} from={message.role}>
                    <MessageContent>
                      <MessageResponse>{message.content}</MessageResponse>
                    </MessageContent>
                  </Message>
                )}
              </div>
            ))}
            {status === 'submitted' && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        {/* Input with @mention */}
        <div className="relative">
          <MentionAutocomplete
            notes={notes}
            onSelect={handleMentionSelect}
            inputRef={textareaRef}
            text={input}
            cursorPosition={cursorPosition}
          />
          
          <PromptInput onSubmit={handleSubmit} className="border-t">
            <PromptInputBody>
              <PromptInputTextarea
                ref={textareaRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setCursorPosition(e.target.selectionStart);
                }}
                onSelect={(e) => setCursorPosition(e.currentTarget.selectionStart)}
                placeholder="Ask about your vault... (@ to search notes)"
              />
            </PromptInputBody>
            <PromptInputFooter>
              <PromptInputTools>
                <span className="text-xs text-muted-foreground">
                  Type @ to search notes
                </span>
              </PromptInputTools>
              <PromptInputButton disabled={!input.trim()} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
```

---

### 4. Server: Chat API with Tools

```typescript
// app/api/chat/route.ts
import { streamText, UIMessage, convertToModelMessages, tool } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { z } from 'zod';
import { searchVault, readFile, listFiles, writeFile } from '@/lib/vault';

export const maxDuration = 30;

const vaultTools = {
  search: tool({
    description: 'Search the Obsidian vault for content matching a query',
    parameters: z.object({
      query: z.string().describe('Search query (grep-style regex)'),
      folder: z.string().optional().describe('Limit to folder like "Projects"'),
    }),
    execute: async ({ query, folder }) => {
      const results = await searchVault(query, folder);
      return { matches: results.slice(0, 15) };
    },
  }),

  readNote: tool({
    description: 'Read the full content of a specific note by path',
    parameters: z.object({
      path: z.string().describe('Path like "Projects/EdTech.md"'),
    }),
    execute: async ({ path }) => {
      const content = await readFile(path);
      return { path, content };
    },
  }),

  listNotes: tool({
    description: 'List all notes in a folder',
    parameters: z.object({
      folder: z.string().describe('Folder like "Learning" or "Notes/Research"'),
    }),
    execute: async ({ folder }) => {
      const files = await listFiles(folder);
      return { folder, files };
    },
  }),

  createNote: tool({
    description: 'Create a new note with proper frontmatter',
    parameters: z.object({
      path: z.string().describe('Where to create, e.g. "Notes/New Idea.md"'),
      title: z.string().describe('Note title'),
      content: z.string().describe('Note content (body only, frontmatter auto-added)'),
      type: z.enum(['note', 'learning', 'decision', 'brag']).default('note'),
      tags: z.array(z.string()).optional(),
    }),
    execute: async ({ path, title, content, type, tags }) => {
      const frontmatter = `---
type: ${type}
created: ${new Date().toLocaleDateString('en-GB').replace(/\//g, '.')}
tags: [${(tags || []).join(', ')}]
---

# ${title}

${content}`;
      
      await writeFile(path, frontmatter);
      return { created: path, message: `Created note: ${title}` };
    },
  }),
};

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const systemPrompt = `You are Pensieve, a personal AI assistant that helps examine thoughts stored in an Obsidian vault.

Like Dumbledore's Pensieve, you help the user:
- Siphon excess thoughts and spot patterns
- Discover links between ideas that would otherwise stay hidden
- Examine memories and notes at leisure

## Your Tools
- search: Find content across all notes
- readNote: Read a specific note's full content  
- listNotes: See what notes exist in a folder
- createNote: Create new notes with proper frontmatter

## Conventions
- Use [[wiki links]] when referencing notes
- Dates: DD.MM.YYYY
- Be concise — the user may be on mobile

## Behavior
1. When asked about something, SEARCH first
2. Cite sources with [[Note Name]] wiki links
3. Help spot patterns and connections
4. If creating notes, follow the vault's frontmatter standard`;

  const result = streamText({
    model: anthropic('claude-sonnet-4-20250514'),
    system: systemPrompt,
    messages: convertToModelMessages(messages),
    tools: vaultTools,
    maxSteps: 5,
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
  });
}
```

---

### 5. Authentication (Simple Password)

```typescript
// lib/auth/session.ts
import { getIronSession } from 'iron-session';

export interface SessionData {
  isLoggedIn: boolean;
}

export const sessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: 'pensieve-session',
  cookieOptions: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
  },
};

export async function getSession(req: Request) {
  return getIronSession<SessionData>(req, sessionOptions);
}
```

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, SessionData } from '@/lib/auth/session';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  const session = await getIronSession<SessionData>(request, response, sessionOptions);

  // Allow login page
  if (request.nextUrl.pathname.startsWith('/login')) {
    return response;
  }

  // Allow API auth route
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    return response;
  }

  // Protect everything else
  if (!session.isLoggedIn) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

```typescript
// app/api/auth/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import bcrypt from 'bcryptjs';

export async function POST(req: Request) {
  const { password } = await req.json();
  
  const isValid = await bcrypt.compare(password, process.env.APP_PASSWORD_HASH!);
  
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const session = await getSession(req);
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await getSession(req);
  session.destroy();
  return NextResponse.json({ success: true });
}
```

---

### 6. Vault Sync

```typescript
// lib/vault/sync.ts
import simpleGit from 'simple-git';
import { existsSync } from 'fs';

const VAULT_PATH = process.env.VAULT_PATH || '/tmp/vault';
const REPO_URL = `https://${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPO}.git`;

export async function syncVault() {
  const git = simpleGit();
  
  if (existsSync(VAULT_PATH)) {
    await git.cwd(VAULT_PATH).pull();
  } else {
    await git.clone(REPO_URL, VAULT_PATH, ['--depth', '1']);
  }
}

export async function pushChanges(message: string) {
  const git = simpleGit(VAULT_PATH);
  await git.add('.');
  await git.commit(message);
  await git.push();
}
```

```typescript
// lib/vault/search.ts
import { readFile as fsReadFile, readdir, stat } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';

const VAULT_PATH = process.env.VAULT_PATH || '/tmp/vault';

export async function searchVault(query: string, folder?: string) {
  const pattern = folder ? `${folder}/**/*.md` : '**/*.md';
  const files = await glob(pattern, { 
    cwd: VAULT_PATH,
    ignore: ['node_modules/**', '.git/**', '.obsidian/**']
  });

  const results: { path: string; matches: string[] }[] = [];
  const regex = new RegExp(query, 'gi');

  for (const file of files) {
    const content = await fsReadFile(join(VAULT_PATH, file), 'utf-8');
    const lines = content.split('\n');
    const matches = lines.filter(line => regex.test(line));
    
    if (matches.length > 0) {
      results.push({ path: file, matches: matches.slice(0, 3) });
    }
  }

  return results;
}

export async function readFile(path: string) {
  return fsReadFile(join(VAULT_PATH, path), 'utf-8');
}

export async function listFiles(folder: string) {
  const files = await glob('**/*.md', { 
    cwd: join(VAULT_PATH, folder),
    ignore: ['.obsidian/**']
  });
  return files;
}

export async function writeFile(path: string, content: string) {
  const { writeFile: fsWriteFile, mkdir } = await import('fs/promises');
  const { dirname } = await import('path');
  
  const fullPath = join(VAULT_PATH, path);
  await mkdir(dirname(fullPath), { recursive: true });
  await fsWriteFile(fullPath, content, 'utf-8');
}
```

---

## Environment Variables

```env
# .env.local

# Auth
SESSION_SECRET=your-32-character-random-string-here
APP_PASSWORD_HASH=$2b$10$...  # bcrypt hash of your password

# AI (pick one)
AI_GATEWAY_API_KEY=...       # Vercel AI Gateway ($5/mo free)
# OR
ANTHROPIC_API_KEY=sk-ant-...

# GitHub (for vault sync)
GITHUB_TOKEN=ghp_...         # Fine-grained: repo read/write
GITHUB_REPO=magnusrodseth/vault

# Vault path (Vercel uses /tmp, Railway can persist)
VAULT_PATH=/tmp/vault
```

---

## Metadata & PWA

```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Pensieve',
  description: 'Your AI-powered second brain. Examine your thoughts at leisure.',
  manifest: '/manifest.json',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```json
// public/manifest.json
{
  "name": "Pensieve",
  "short_name": "Pensieve",
  "description": "Your AI-powered second brain. Examine your thoughts at leisure.",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0a0a0a",
  "theme_color": "#7C3AED",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

---

## Deployment

```bash
# 1. Create project
npx create-next-app@latest vault-website --typescript --tailwind --app

# 2. Install AI Elements
cd vault-website
npx ai-elements@latest

# 3. Install deps
npm i ai @ai-sdk/react @ai-sdk/anthropic dexie dexie-react-hooks \
      iron-session bcryptjs fuse.js simple-git glob nanoid zod

npm i -D @types/bcryptjs

# 4. Generate password hash (run once)
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('your-password', 10))"

# 5. Deploy to Vercel
vercel

# 6. Add custom domain
# In Vercel dashboard: Settings → Domains → vault.magnusrodseth.com
```

---

## Feature Summary

| Feature | Implementation |
|---------|----------------|
| **UI** | AI Elements (Conversation, Message, PromptInput) |
| **Session storage** | Dexie.js (IndexedDB, client-side, no backend DB) |
| **Note search** | `@` trigger → fuzzy search with fuse.js + cmdk |
| **Auth** | iron-session + bcrypt password |
| **AI** | Vercel AI SDK + Claude with tool calling |
| **Vault access** | GitHub clone + grep/read/write tools |
| **Domain** | `vault.magnusrodseth.com` on Vercel |
| **PWA** | manifest.json for "Add to Home Screen" |

---

## MVP Scope (v0.1)

| Feature | Included |
|---------|----------|
| Password auth | ✅ |
| Chat UI (AI Elements) | ✅ |
| Search vault | ✅ |
| Read notes | ✅ |
| Create notes | ✅ |
| `@` autocomplete | ✅ |
| Session persistence (Dexie) | ✅ |
| PWA | ✅ |
| Voice input | ❌ (use phone keyboard) |
| Offline mode | ❌ (needs server) |

---

## Future Enhancements (v0.2+)

1. **Quick capture mode** — One-tap to append to `Notes/Inbox.md`
2. **Daily note integration** — "Add this to today's note"
3. **Whisper transcription** — Voice → text → note
4. **Scheduled sync** — Cron job to pull vault hourly
5. **Tool call visualization** — Show when AI is searching/reading
6. **Export sessions** — Download conversation as markdown

---

## Background Research

### Alternatives Considered

| Tool | Verdict |
|------|---------|
| **Khoj** | Good but overkill — requires server always running |
| **MemGPT/Letta** | Too complex for this use case |
| **AnythingLLM** | More suited for document Q&A, less mobile |

### Why Build Custom?

- Full control over UX and branding
- No extra infrastructure (Dexie = no DB)
- Tailored to Obsidian vault conventions
- AI Elements provides production-ready chat UI
- Can extend with vault-specific tools

---

*Last updated: January 2025*
