"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { NoteDiffPreview } from "./note-diff-preview";

interface DiffApprovalPreviewProps {
  path: string;
  newContent: string;
}

export function DiffApprovalPreview({
  path,
  newContent,
}: DiffApprovalPreviewProps) {
  const [existingContent, setExistingContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchExisting() {
      try {
        const res = await fetch(
          `/api/vault/note?path=${encodeURIComponent(path)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setExistingContent(data.content);
        } else {
          setExistingContent(null);
        }
      } catch {
        setError("Failed to fetch existing content");
      } finally {
        setLoading(false);
      }
    }

    fetchExisting();
  }, [path]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
        <Loader2Icon className="h-4 w-4 animate-spin" />
        Loading diff preview...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <NoteDiffPreview
      filename={path}
      before={existingContent}
      after={newContent}
      defaultOpen={true}
    />
  );
}

interface BatchDiffPreviewProps {
  notes: Array<{
    path: string;
    content?: string;
    newContent?: string;
    title?: string;
  }>;
}

export function BatchDiffApprovalPreview({ notes }: BatchDiffPreviewProps) {
  return (
    <div className="space-y-3 max-h-96 overflow-y-auto">
      {notes.map((note) => (
        <DiffApprovalPreview
          key={note.path}
          path={note.path}
          newContent={note.content || note.newContent || ""}
        />
      ))}
    </div>
  );
}
