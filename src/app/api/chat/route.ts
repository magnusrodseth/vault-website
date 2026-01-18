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
  deleteFile,
  getMarkdownFiles,
  listDirectory,
  readFileContent,
} from "@/lib/github/api";

export const maxDuration = 60;

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*")
    .replace(/\?/g, ".");
  return new RegExp(escaped, "i");
}

async function safeReadFileContent(path: string): Promise<string | null> {
  try {
    return await readFileContent(path);
  } catch {
    return null;
  }
}

const noteTypeSchema = z.enum([
  "note",
  "project",
  "meeting",
  "daily",
  "resource",
  "person",
  "decision",
  "learning",
  "how-to-guide",
  "brag",
]);

function buildNoteContent(
  title: string,
  content: string,
  type: string,
  tags: string[] | undefined,
  date: string,
): string {
  return `---
type: ${type}
created: ${date}
tags: [${(tags || []).join(", ")}]
---

# ${title}

${content}`;
}

const vaultTools = {
  listNotes: tool({
    description:
      "List notes in a folder, search by pattern, or get ALL notes. Use this to discover what notes exist before reading them.",
    inputSchema: z.object({
      folder: z
        .string()
        .optional()
        .describe(
          'Folder path like "Learning" or "Projects". Omit to list root folders.',
        ),
      pattern: z
        .string()
        .optional()
        .describe(
          'Glob pattern to filter notes by title/path. Examples: "*autonomy*", "Learning/*", "*agent*". Case-insensitive.',
        ),
      recursive: z
        .boolean()
        .optional()
        .describe(
          "If true, lists ALL markdown files (required when using pattern)",
        ),
    }),
    execute: async ({ folder, pattern, recursive }) => {
      if (recursive || pattern) {
        let files = await getMarkdownFiles();
        if (pattern) {
          const regex = globToRegex(pattern);
          files = files.filter(
            (f) => regex.test(f.path) || regex.test(f.title),
          );
        }
        return { total: files.length, pattern: pattern || null, files };
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
      "Create a new note in the vault with proper Obsidian frontmatter. Commits directly to GitHub. Requires user approval. Shows diff if overwriting existing note.",
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
      type: noteTypeSchema
        .default("note")
        .describe("Note type for frontmatter"),
      tags: z.array(z.string()).optional().describe("Tags for the note"),
    }),
    needsApproval: true,
    execute: async ({ path, title, content, type, tags }) => {
      const date = new Date().toLocaleDateString("en-GB").replace(/\//g, ".");
      const newContent = buildNoteContent(title, content, type, tags, date);
      const existingContent = await safeReadFileContent(path);

      const result = await createOrUpdateFile(
        path,
        newContent,
        existingContent ? `Update note: ${title}` : `Create note: ${title}`,
      );

      return {
        path: result.path,
        existingContent,
        newContent,
        isOverwrite: existingContent !== null,
        message: existingContent
          ? `Updated note: ${title}`
          : `Created note: ${title}`,
        committed: true,
      };
    },
  }),

  updateNote: tool({
    description:
      "Update an existing note with new content. Shows diff preview before committing. Use this when modifying existing notes. Requires user approval.",
    inputSchema: z.object({
      path: z
        .string()
        .describe('Full path to the existing note, e.g. "Learning/Topic.md"'),
      content: z
        .string()
        .describe(
          "New full content for the note (including frontmatter if needed)",
        ),
    }),
    needsApproval: true,
    execute: async ({ path, content }) => {
      const existingContent = await safeReadFileContent(path);

      if (existingContent === null) {
        throw new Error(`Note not found: ${path}. Use createNote instead.`);
      }

      const title = path.split("/").pop()?.replace(/\.md$/, "") || path;
      await createOrUpdateFile(path, content, `Update note: ${title}`);

      return {
        path,
        existingContent,
        newContent: content,
        isOverwrite: true,
        message: `Updated note: ${title}`,
        committed: true,
      };
    },
  }),

  updateNotes: tool({
    description:
      "Update multiple existing notes at once with a single approval. Shows diff preview for each note. Use when batch-updating related notes.",
    inputSchema: z.object({
      notes: z
        .array(
          z.object({
            path: z.string().describe("Full path to the existing note"),
            content: z.string().describe("New full content for the note"),
          }),
        )
        .describe("Array of notes to update"),
    }),
    needsApproval: true,
    execute: async ({ notes }) => {
      const results = [];

      for (const note of notes) {
        const existingContent = await safeReadFileContent(note.path);

        if (existingContent === null) {
          results.push({
            path: note.path,
            error: `Note not found: ${note.path}`,
            skipped: true,
          });
          continue;
        }

        const title =
          note.path.split("/").pop()?.replace(/\.md$/, "") || note.path;
        await createOrUpdateFile(
          note.path,
          note.content,
          `Update note: ${title}`,
        );

        results.push({
          path: note.path,
          existingContent,
          newContent: note.content,
          updated: true,
        });
      }

      const updated = results.filter((r) => r.updated).length;
      const skipped = results.filter((r) => r.skipped).length;

      return {
        updated,
        skipped,
        notes: results,
        message: `Updated ${updated} notes${skipped > 0 ? `, skipped ${skipped}` : ""}`,
        committed: true,
      };
    },
  }),

  deleteNote: tool({
    description:
      "Delete a note from the vault. Commits directly to GitHub. Requires user approval. Use with caution - this action is irreversible.",
    inputSchema: z.object({
      path: z
        .string()
        .describe('Full path to the note, e.g. "Notes/Old Idea.md"'),
    }),
    needsApproval: true,
    execute: async ({ path }) => {
      const title = path.split("/").pop()?.replace(/\.md$/, "") || path;
      await deleteFile(path, `Delete note: ${title}`);
      return {
        deleted: path,
        message: `Deleted note: ${title}`,
        committed: true,
      };
    },
  }),

  createNotes: tool({
    description:
      "Create multiple notes at once with a single approval. Use when generating a series of related notes (e.g., book chapters, learning series, decomposed concepts). Shows diff for any overwrites.",
    inputSchema: z.object({
      notes: z
        .array(
          z.object({
            path: z
              .string()
              .describe('Where to create, e.g. "Learning/Chapter 1.md"'),
            title: z.string().describe("Note title"),
            content: z.string().describe("Note content (body only)"),
            type: noteTypeSchema.default("note"),
            tags: z.array(z.string()).optional(),
          }),
        )
        .describe("Array of notes to create"),
    }),
    needsApproval: true,
    execute: async ({ notes }) => {
      const results = [];
      const date = new Date().toLocaleDateString("en-GB").replace(/\//g, ".");

      for (const note of notes) {
        const newContent = buildNoteContent(
          note.title,
          note.content,
          note.type,
          note.tags,
          date,
        );
        const existingContent = await safeReadFileContent(note.path);

        const result = await createOrUpdateFile(
          note.path,
          newContent,
          existingContent
            ? `Update note: ${note.title}`
            : `Create note: ${note.title}`,
        );

        results.push({
          path: result.path,
          title: note.title,
          existingContent,
          newContent,
          isOverwrite: existingContent !== null,
        });
      }

      const created = results.filter((r) => !r.isOverwrite).length;
      const updated = results.filter((r) => r.isOverwrite).length;

      return {
        created,
        updated,
        notes: results,
        message: `Created ${created} notes${updated > 0 ? `, updated ${updated}` : ""}`,
        committed: true,
      };
    },
  }),

  deleteNotes: tool({
    description:
      "Delete multiple notes at once with a single approval. Use when cleaning up a series of notes (e.g., test notes, outdated content). More efficient than multiple deleteNote calls. CAUTION: This action is irreversible.",
    inputSchema: z.object({
      paths: z
        .array(z.string())
        .describe(
          'Array of full paths to delete, e.g. ["Notes/Old1.md", "Notes/Old2.md"]',
        ),
    }),
    needsApproval: true,
    execute: async ({ paths }) => {
      const results = [];

      for (const path of paths) {
        const title = path.split("/").pop()?.replace(/\.md$/, "") || path;
        await deleteFile(path, `Delete note: ${title}`);
        results.push({ deleted: path, title });
      }

      return {
        deleted: results.length,
        notes: results,
        message: `Deleted ${results.length} notes`,
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
- listNotes: Discover notes. Supports glob patterns like "*agent*", "Learning/*"
- readNote: Read a specific note's full content
- createNote: Create a single note (requires user approval, shows diff if overwriting)
- createNotes: Create multiple notes at once with ONE approval (use for series/batches)
- updateNote: Update an existing note's content (requires user approval, shows diff)
- updateNotes: Update multiple notes at once with ONE approval (shows diff for each)
- deleteNote: Delete a single note (requires user approval)
- deleteNotes: Delete multiple notes at once with ONE approval (use for batch cleanup)

## Vault Structure
\`\`\`
Personal/       # Personal notes and journal
  People/       # People (interests, how you met, gift ideas)
Projects/       # Project documentation
Meetings/       # Meeting notes
Learning/       # Book summaries, course notes, article takeaways
Reference/      # Glossary, how-to-guides, reusable knowledge
Notes/          # Quick atomic notes and ideas
Templates/      # Note templates (don't create here)
Attachments/    # Images, PDFs (don't create here)
\`\`\`

## Note Types
When creating notes, use the appropriate type:
- \`note\`: General atomic knowledge note (one idea per note)
- \`project\`: Active project with tasks/deadlines
- \`meeting\`: Meeting notes with attendees/action items
- \`daily\`: Daily note with tasks/journal
- \`resource\`: Reference material
- \`person\`: Individual profiles (interests, how you met, gift ideas)
- \`decision\`: Decision journal (what, why, options considered)
- \`learning\`: Book/course/video summaries in own words
- \`how-to-guide\`: Standard operating procedures
- \`brag\`: Work achievements, complex bugs solved, wins

## Tag Conventions
Use hierarchical tags for cross-cutting concerns:
- Status: status/todo, status/in-progress, status/done, status/waiting
- Source: source/book, source/article, source/video, source/podcast
- Areas: area/work, area/health, area/finance

IMPORTANT: In frontmatter YAML, tags must NOT have # prefix (# is YAML comment).
- Correct: tags: [area/work, source/project]
- Wrong: tags: [#area/work, #source/project]

Philosophy: Tags answer "what kind?" — Links answer "what relates?"

## Agentic Retrieval Strategy
Use pattern matching to efficiently find relevant notes:
1. When asked about a topic, use listNotes(pattern="*topic*") to find matching notes
2. Read the most relevant notes with readNote
3. Synthesize the information for the user

### Bilingual Search (Norwegian/English)
The vault contains notes in both Norwegian and English. When searching:
- If user asks in Norwegian, also search English equivalents
- If user asks in English, also search Norwegian equivalents
- Common translations to try:
  - kontor/office, pult/skrivebord/desk, møte/meeting
  - prosjekt/project, læring/learning, notat/note
  - utstyr/equipment, referanse/reference
- Run multiple listNotes calls with different language variants

Example patterns:
- "*autonomy*" → finds "Bounded Autonomy", "Agent Autonomy Levels"
- "Learning/*" → all notes in Learning folder
- "*agent*loop*" → finds "Agent Loop", "OODA Loop for Agents"

## Discovery Before Creation (CRITICAL)
Before creating any note:
1. Search for existing notes on the topic with listNotes(pattern="*keyword*")
2. Check synonyms and related terms
3. If similar note exists, use updateNote to modify it instead
4. Only create if truly new information

## Update vs Create
- Use updateNote/updateNotes when modifying existing notes
- Use createNote/createNotes for new notes (will warn if overwriting)
- User will see a diff preview before approving any changes

## Conventions
- ALWAYS use [[wiki links]] for internal references
- Use [[Note Name|Display Text]] for custom display
- Link liberally to build the knowledge graph
- Dates: DD.MM.YYYY
- File names: Human Readable Name.md (title case with spaces)
- Be concise — the user may be on mobile

## Markdown Formatting
- Header hierarchy: # (title) → ## (sections) → ### (subsections). Never skip levels.
- No trailing colons on headers (use "## Role" not "## Role:")
- Break long paragraphs for readability (one idea per paragraph)
- Use bullet lists for scannable content (especially in brag/CV notes)
- Bold key terms in lists for emphasis: "- **Next.js 15** for server components"

## Atomic Notes (Zettelkasten)
- One idea per note — makes linking powerful
- Short, focused notes over long documents
- Let complexity emerge through links, not length
- If a note has multiple ideas → suggest splitting

## Behavior
1. When the user mentions [[Note Name]], find and read that note
2. When asked about a topic, search first, then read relevant notes
3. Cite sources with [[Note Name]] wiki links
4. Help spot patterns and connections across notes
5. When creating notes, place in the right folder based on type
6. Suggest links to existing related notes
7. When updating notes, show clear diff of what changed`;

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools: vaultTools,
    stopWhen: stepCountIs(15),
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
  });
}
