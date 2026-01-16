"use client";

import {
  ExternalLinkIcon,
  FileTextIcon,
  FolderIcon,
  TagIcon,
} from "lucide-react";
import { useCallback, useState } from "react";
import {
  InlineCitation,
  InlineCitationCard,
  InlineCitationCardBody,
  InlineCitationCardTrigger,
  InlineCitationText,
} from "@/components/ai-elements/inline-citation";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface WikiLinkCitationProps {
  title: string;
  path?: string;
}

interface NoteFrontmatter {
  type?: string;
  created?: string;
  tags?: string[];
  [key: string]: unknown;
}

interface NotePreview {
  frontmatter: NoteFrontmatter;
  excerpt: string;
}

function buildGitHubUrl(path: string): string {
  const repo = process.env.NEXT_PUBLIC_GITHUB_REPO || "magnusrodseth/vault";
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  return `https://github.com/${repo}/blob/main/${encodedPath}`;
}

function parseFrontmatter(content: string): {
  frontmatter: NoteFrontmatter;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }

  const [, yaml, body] = match;
  const frontmatter: NoteFrontmatter = {};

  for (const line of yaml.split("\n")) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (key === "tags" && value.startsWith("[")) {
      frontmatter.tags = value
        .slice(1, -1)
        .split(",")
        .map((t) => t.trim());
    } else {
      frontmatter[key] = value;
    }
  }

  return { frontmatter, body };
}

function getExcerpt(body: string, maxLength = 150): string {
  const withoutHeading = body.replace(/^#\s+.*\n+/, "").trim();
  const firstParagraph = withoutHeading.split(/\n\n/)[0] || "";
  const cleaned = firstParagraph.replace(/[*_`#[\]]/g, "").trim();

  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).trim() + "...";
}

const previewCache = new Map<string, NotePreview>();

export function WikiLinkCitation({ title, path }: WikiLinkCitationProps) {
  const [preview, setPreview] = useState<NotePreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const gitHubUrl = path ? buildGitHubUrl(path) : null;
  const folder = path ? path.split("/").slice(0, -1).join("/") || "root" : null;

  const fetchPreview = useCallback(async () => {
    if (!path || preview || isLoading) return;

    const cached = previewCache.get(path);
    if (cached) {
      setPreview(cached);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/vault/note?path=${encodeURIComponent(path)}`,
      );
      if (res.ok) {
        const { content } = await res.json();
        const { frontmatter, body } = parseFrontmatter(content);
        const notePreview = { frontmatter, excerpt: getExcerpt(body) };
        previewCache.set(path, notePreview);
        setPreview(notePreview);
      }
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, [path, preview, isLoading]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      fetchPreview();
    }
  };

  if (!gitHubUrl) {
    return <span className="font-medium text-primary">{title}</span>;
  }

  return (
    <InlineCitation>
      <InlineCitationText className="font-medium text-primary underline decoration-primary/30 underline-offset-2 hover:decoration-primary">
        {title}
      </InlineCitationText>
      <InlineCitationCard onOpenChange={handleOpenChange} open={isOpen}>
        <InlineCitationCardTrigger sources={[gitHubUrl]} />
        <InlineCitationCardBody className="w-80">
          <div className="space-y-3 p-4">
            <div className="flex items-start gap-2">
              <FileTextIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-medium">{title}</h4>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <FolderIcon className="size-3" />
                  <span className="truncate">{folder}/</span>
                </div>
              </div>
            </div>

            {isLoading && (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            )}

            {preview && (
              <>
                {preview.frontmatter.type && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {preview.frontmatter.type}
                    </Badge>
                    {preview.frontmatter.created && (
                      <span className="text-xs text-muted-foreground">
                        {preview.frontmatter.created}
                      </span>
                    )}
                  </div>
                )}

                {preview.frontmatter.tags &&
                  preview.frontmatter.tags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TagIcon className="size-3 text-muted-foreground" />
                      {preview.frontmatter.tags.slice(0, 4).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="px-1.5 py-0 text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {preview.frontmatter.tags.length > 4 && (
                        <span className="text-xs text-muted-foreground">
                          +{preview.frontmatter.tags.length - 4}
                        </span>
                      )}
                    </div>
                  )}

                {preview.excerpt && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {preview.excerpt}
                  </p>
                )}
              </>
            )}

            <a
              href={gitHubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLinkIcon className="size-3.5" />
              View on GitHub
            </a>
          </div>
        </InlineCitationCardBody>
      </InlineCitationCard>
    </InlineCitation>
  );
}
