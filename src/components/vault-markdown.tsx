"use client";

import type { ComponentProps, ReactNode } from "react";
import { useMemo } from "react";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { WikiLinkCitation } from "./wiki-link-citation";

interface Note {
  path: string;
  title: string;
}

interface VaultMarkdownProps
  extends Omit<ComponentProps<typeof Streamdown>, "children"> {
  children: string;
  notes?: Note[];
}

const WIKI_LINK_REGEX = /\[\[([^\]]+)\]\]/g;

interface ParsedPart {
  type: "text" | "wikilink";
  content?: string;
  title?: string;
  path?: string;
  id: string;
}

function parseWikiLinks(text: string, notes: Note[]): ParsedPart[] {
  const parts: ParsedPart[] = [];
  let lastIndex = 0;
  let partId = 0;

  const matches = text.matchAll(WIKI_LINK_REGEX);

  for (const match of matches) {
    const [fullMatch, title] = match;
    const startIndex = match.index!;

    if (startIndex > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex, startIndex),
        id: `text-${partId++}`,
      });
    }

    const note = notes.find(
      (n) => n.title.toLowerCase() === title.toLowerCase(),
    );

    parts.push({
      type: "wikilink",
      title,
      path: note?.path,
      id: `wikilink-${partId++}`,
    });

    lastIndex = startIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex),
      id: `text-${partId++}`,
    });
  }

  return parts;
}

export function VaultMarkdown({
  children,
  notes = [],
  className,
  ...props
}: VaultMarkdownProps) {
  const parts = useMemo(
    () => parseWikiLinks(children, notes),
    [children, notes],
  );

  const hasWikiLinks = parts.some((p) => p.type === "wikilink");

  if (!hasWikiLinks) {
    return (
      <Streamdown
        className={cn(
          "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
          className,
        )}
        {...props}
      >
        {children}
      </Streamdown>
    );
  }

  const renderParts = (): ReactNode[] => {
    return parts.map((part) => {
      if (part.type === "wikilink") {
        return (
          <WikiLinkCitation
            key={part.id}
            title={part.title!}
            path={part.path}
          />
        );
      }

      return (
        <Streamdown
          key={part.id}
          className={cn(
            "inline [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:inline",
            className,
          )}
          {...props}
        >
          {part.content}
        </Streamdown>
      );
    });
  };

  return (
    <div
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className,
      )}
    >
      {renderParts()}
    </div>
  );
}
