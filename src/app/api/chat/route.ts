import { anthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import { z } from "zod";
import {
  listFiles,
  readFile,
  searchVault,
  writeFile,
} from "@/lib/vault/search";

export const maxDuration = 30;

const vaultTools = {
  search: tool({
    description: "Search the Obsidian vault for content matching a query",
    inputSchema: z.object({
      query: z.string().describe("Search query (grep-style regex)"),
      folder: z.string().optional().describe('Limit to folder like "Projects"'),
    }),
    execute: async ({ query, folder }) => {
      const results = await searchVault(query, folder);
      return { matches: results.slice(0, 15) };
    },
  }),

  readNote: tool({
    description: "Read the full content of a specific note by path",
    inputSchema: z.object({
      path: z.string().describe('Path like "Projects/EdTech.md"'),
    }),
    execute: async ({ path }) => {
      const content = await readFile(path);
      return { path, content };
    },
  }),

  listNotes: tool({
    description: "List all notes in a folder",
    inputSchema: z.object({
      folder: z
        .string()
        .optional()
        .describe('Folder like "Learning" or "Notes/Research"'),
    }),
    execute: async ({ folder }) => {
      const files = await listFiles(folder);
      return { folder: folder || "root", files };
    },
  }),

  createNote: tool({
    description: "Create a new note with proper frontmatter",
    inputSchema: z.object({
      path: z.string().describe('Where to create, e.g. "Notes/New Idea.md"'),
      title: z.string().describe("Note title"),
      content: z
        .string()
        .describe("Note content (body only, frontmatter auto-added)"),
      type: z
        .enum(["note", "learning", "decision", "brag"])
        .default("note")
        .describe("Type of note"),
      tags: z.array(z.string()).optional().describe("Tags for the note"),
    }),
    execute: async ({ path, title, content, type, tags }) => {
      const frontmatter = `---
type: ${type}
created: ${new Date().toLocaleDateString("en-GB").replace(/\//g, ".")}
tags: [${(tags || []).join(", ")}]
---

# ${title}

${content}`;

      await writeFile(path, frontmatter);
      return { created: path, message: `Created note: ${title}` };
    },
  }),
};

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

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: vaultTools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
  });
}
