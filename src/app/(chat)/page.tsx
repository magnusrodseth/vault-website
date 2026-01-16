"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createSession, useSessions } from "@/lib/db/hooks";

export default function RootRedirect() {
  const router = useRouter();
  const sessions = useSessions();

  useEffect(() => {
    if (sessions === undefined) return;

    if (sessions.length > 0) {
      router.replace(`/chat/${sessions[0].id}`);
    } else {
      createSession().then((id) => router.replace(`/chat/${id}`));
    }
  }, [sessions, router]);

  return (
    <div className="flex h-dvh items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Loading...</div>
    </div>
  );
}
