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
  createOrUpdateFile,
  getMarkdownFiles,
  listDirectory,
  readFileContent,
} from "@/lib/github/api";

export const maxDuration = 30;

const vaultTools = {
  listNotes: tool({
    description:
      "List notes in a folder, or get ALL notes in the vault. Use this to discover what notes exist before reading them.",
    inputSchema: z.object({
      folder: z
        .string()
        .optional()
        .describe(
          'Folder path like "Learning" or "Projects". Omit to list root folders.',
        ),
      recursive: z
        .boolean()
        .optional()
        .describe("If true, lists ALL markdown files in the entire vault"),
    }),
    execute: async ({ folder, recursive }) => {
      if (recursive) {
        const allFiles = await getMarkdownFiles();
        return { total: allFiles.length, files: allFiles };
      }
      const items = await listDirectory(folder);
      return { folder: folder || "root", items };
    },
  }),

  readNote: tool({
    description:
      "Read the full content of a specific note. Use the exact path from listNotes.",
    inputSchema: z.object({
      path: z
        .string()
        .describe('Full path like "Learning/Bounded Autonomy.md"'),
    }),
    execute: async ({ path }) => {
      const content = await readFileContent(path);
      return { path, content };
    },
  }),

  createNote: tool({
    description:
      "Create a new note in the vault with proper Obsidian frontmatter. Commits directly to GitHub.",
    inputSchema: z.object({
      path: z
        .string()
        .describe(
          'Where to create, e.g. "Notes/New Idea.md" (must end in .md)',
        ),
      title: z.string().describe("Note title (used in heading)"),
      content: z
        .string()
        .describe("Note content (body only, frontmatter auto-generated)"),
      type: z
        .enum(["note", "learning", "decision", "brag"])
        .default("note")
        .describe("Note type for frontmatter"),
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

      const result = await createOrUpdateFile(
        path,
        frontmatter,
        `Create note: ${title}`,
      );
      return {
        created: result.path,
        message: `Created note: ${title}`,
        committed: true,
      };
    },
  }),
};

const systemPrompt = `You are Pensieve, a personal AI assistant that helps examine thoughts stored in an Obsidian vault.

Like Dumbledore's Pensieve, you help the user:
- Siphon excess thoughts and spot patterns
- Discover links between ideas that would otherwise stay hidden
- Examine memories and notes at leisure

## Your Tools
- listNotes: Discover what notes exist (use recursive=true to see ALL notes)
- readNote: Read a specific note's full content
- createNote: Create new notes (commits directly to GitHub)

## Agentic Retrieval Strategy
You do NOT have a search/grep tool. Instead, use intelligent retrieval:
1. When asked about a topic, first use listNotes(recursive=true) to see all notes
2. Identify relevant notes by their titles/paths
3. Read those specific notes with readNote
4. Synthesize the information for the user

## Conventions
- Use [[wiki links]] when referencing notes
- Dates: DD.MM.YYYY
- Be concise — the user may be on mobile

## Behavior
1. When the user mentions [[Note Name]], find and read that note
2. When asked about a topic, list all notes first, then read relevant ones
3. Cite sources with [[Note Name]] wiki links
4. Help spot patterns and connections across notes`;

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
