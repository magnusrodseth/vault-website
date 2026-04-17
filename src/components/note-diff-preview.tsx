"use client";

import { createPatch } from "diff";
import { ChevronDownIcon, FileIcon, MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface NoteDiffPreviewProps {
  filename: string;
  before: string | null;
  after: string;
  defaultOpen?: boolean;
}

interface DiffLine {
  id: string;
  type: "add" | "remove" | "context" | "header";
  content: string;
  oldLineNo?: number;
  newLineNo?: number;
}

function parseDiff(patch: string): DiffLine[] {
  const lines = patch.split("\n");
  const result: DiffLine[] = [];

  let oldLineNo = 0;
  let newLineNo = 0;
  let headerCount = 0;
  let addCount = 0;
  let removeCount = 0;
  let contextCount = 0;

  for (const line of lines) {
    if (line.startsWith("---") || line.startsWith("+++")) {
      continue;
    }

    if (line.startsWith("@@")) {
      const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
      if (match) {
        oldLineNo = parseInt(match[1], 10);
        newLineNo = parseInt(match[2], 10);
      }
      result.push({
        id: `header-${headerCount++}`,
        type: "header",
        content: line,
      });
      continue;
    }

    if (line.startsWith("+")) {
      result.push({
        id: `add-${addCount++}-${newLineNo}`,
        type: "add",
        content: line.slice(1),
        newLineNo: newLineNo++,
      });
      continue;
    }

    if (line.startsWith("-")) {
      result.push({
        id: `remove-${removeCount++}-${oldLineNo}`,
        type: "remove",
        content: line.slice(1),
        oldLineNo: oldLineNo++,
      });
      continue;
    }

    if (line.startsWith(" ") || line === "") {
      result.push({
        id: `context-${contextCount++}-${oldLineNo}-${newLineNo}`,
        type: "context",
        content: line.slice(1),
        oldLineNo: oldLineNo++,
        newLineNo: newLineNo++,
      });
    }
  }

  return result;
}

function countChanges(lines: DiffLine[]): {
  additions: number;
  deletions: number;
} {
  let additions = 0;
  let deletions = 0;

  for (const line of lines) {
    if (line.type === "add") additions++;
    if (line.type === "remove") deletions++;
  }

  return { additions, deletions };
}

export function NoteDiffPreview({
  filename,
  before,
  after,
  defaultOpen = true,
}: NoteDiffPreviewProps) {
  const [highlightedLines, setHighlightedLines] = useState<Map<string, string>>(
    new Map(),
  );

  const isNewFile = before === null;
  const beforeContent = before ?? "";

  const patch = useMemo(
    () => createPatch(filename, beforeContent, after, "", "", { context: 3 }),
    [filename, beforeContent, after],
  );

  const diffLines = useMemo(() => parseDiff(patch), [patch]);
  const { additions, deletions } = useMemo(
    () => countChanges(diffLines),
    [diffLines],
  );

  const linesToHighlight = useMemo(() => {
    const uniqueLines = new Map<string, string[]>();
    for (const line of diffLines) {
      if (line.type !== "header") {
        const existing = uniqueLines.get(line.content) || [];
        existing.push(line.id);
        uniqueLines.set(line.content, existing);
      }
    }
    return uniqueLines;
  }, [diffLines]);

  useEffect(() => {
    async function highlight() {
      try {
        const { codeToHtml } = await import("shiki");

        const newHighlighted = new Map<string, string>();

        for (const [content, ids] of linesToHighlight) {
          const html = await codeToHtml(content || " ", {
            lang: "markdown",
            theme: "github-dark",
          });

          const match = html.match(/<code[^>]*>([\s\S]*?)<\/code>/);
          const innerHtml = match ? match[1] : content;

          for (const id of ids) {
            newHighlighted.set(id, innerHtml);
          }
        }

        setHighlightedLines(newHighlighted);
      } catch (error) {
        console.error("Error highlighting diff:", error);
      }
    }

    highlight();
  }, [linesToHighlight]);

  if (diffLines.length === 0 || (additions === 0 && deletions === 0)) {
    return (
      <div className="rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
        No changes detected
      </div>
    );
  }

  return (
    <Collapsible defaultOpen={defaultOpen} className="w-full">
      <CollapsibleTrigger
        aria-label={`Toggle diff for ${filename}`}
        className="flex w-full items-center justify-between rounded-t-md border border-border bg-accent p-2 text-sm hover:bg-accent/80 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <FileIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{filename}</span>
          {isNewFile && (
            <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-xs text-green-400">
              new file
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            {additions > 0 && (
              <span className="flex items-center gap-0.5 text-green-400">
                <PlusIcon className="h-3 w-3" />
                {additions}
              </span>
            )}
            {deletions > 0 && (
              <span className="flex items-center gap-0.5 text-red-400">
                <MinusIcon className="h-3 w-3" />
                {deletions}
              </span>
            )}
          </div>
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="rounded-b-md border border-t-0 border-border bg-[#0d1117] overflow-x-auto">
          <div className="font-mono text-xs">
            {diffLines.map((line) => {
              if (line.type === "header") {
                return (
                  <div
                    key={line.id}
                    className="bg-[#161b22] px-3 py-1 text-[#8b949e] border-y border-[#30363d]"
                  >
                    {line.content}
                  </div>
                );
              }

              const highlighted = highlightedLines.get(line.id);

              return (
                <div
                  key={line.id}
                  className={cn(
                    "flex",
                    line.type === "add" && "bg-[#1a4721]/50",
                    line.type === "remove" && "bg-[#5d2130]/50",
                  )}
                >
                  <div className="flex select-none border-r border-[#30363d]">
                    <span
                      className={cn(
                        "w-10 px-2 py-0.5 text-right text-[#484f58]",
                        line.type === "remove" && "bg-[#5d2130]/30",
                        line.type === "add" && "bg-transparent",
                      )}
                    >
                      {line.type !== "add" ? line.oldLineNo : ""}
                    </span>
                    <span
                      className={cn(
                        "w-10 px-2 py-0.5 text-right text-[#484f58]",
                        line.type === "add" && "bg-[#1a4721]/30",
                        line.type === "remove" && "bg-transparent",
                      )}
                    >
                      {line.type !== "remove" ? line.newLineNo : ""}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "w-5 py-0.5 text-center select-none",
                      line.type === "add" && "text-green-400",
                      line.type === "remove" && "text-red-400",
                    )}
                  >
                    {line.type === "add" && "+"}
                    {line.type === "remove" && "-"}
                  </span>

                  <div
                    className={cn(
                      "flex-1 py-0.5 pr-3 whitespace-pre",
                      line.type === "add" && "text-[#aff5b4]",
                      line.type === "remove" && "text-[#ffa198]",
                      line.type === "context" && "text-[#c9d1d9]",
                    )}
                  >
                    {highlighted ? (
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: Required for Shiki syntax highlighting output
                      <span
                        dangerouslySetInnerHTML={{ __html: highlighted }}
                        className="[&>span]:!bg-transparent"
                      />
                    ) : (
                      line.content || " "
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
