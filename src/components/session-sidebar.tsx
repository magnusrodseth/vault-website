"use client";

import { MessageSquareIcon, TrashIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Session } from "@/lib/db/dexie";
import { deleteSession } from "@/lib/db/hooks";
import { cn } from "@/lib/utils";

interface SessionSidebarProps {
  sessions: Session[];
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionSidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onDeleteSession,
  open,
  onOpenChange,
}: SessionSidebarProps) {
  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await onDeleteSession(sessionId);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const d = new Date(date);
    const diffDays = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString();
  };

  const SessionList = () => (
    <div className="flex flex-col gap-1">
      {sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground px-2 py-4">
          No conversations yet
        </p>
      ) : (
        sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              "group flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer hover:bg-muted",
              currentSessionId === session.id && "bg-muted",
            )}
            onClick={() => {
              onSelectSession(session.id);
              onOpenChange(false);
            }}
          >
            <MessageSquareIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate">{session.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatDate(session.updatedAt)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100"
              onClick={(e) => handleDelete(e, session.id)}
            >
              <TrashIcon className="h-3 w-3" />
            </Button>
          </div>
        ))
      )}
    </div>
  );

  return (
    <>
      {/* Mobile: Sheet drawer */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-72 p-4">
          <SheetHeader>
            <SheetTitle>Conversations</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <SessionList />
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop: Always visible sidebar */}
      <aside className="hidden md:flex w-64 border-r flex-col p-4">
        <h2 className="font-semibold mb-4">Conversations</h2>
        <SessionList />
      </aside>
    </>
  );
}
