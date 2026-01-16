"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, type Session, type Message } from "./dexie";
import { nanoid } from "nanoid";

export function useSessions() {
  return useLiveQuery(() =>
    db.sessions.orderBy("updatedAt").reverse().toArray()
  );
}

export function useMessages(sessionId: string | null) {
  return useLiveQuery(
    () =>
      sessionId
        ? db.messages.where("sessionId").equals(sessionId).sortBy("createdAt")
        : [],
    [sessionId]
  );
}

export async function createSession(): Promise<string> {
  const id = nanoid();
  await db.sessions.add({
    id,
    title: "New conversation",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return id;
}

export async function saveMessage(
  sessionId: string,
  message: Omit<Message, "id" | "createdAt" | "sessionId">
) {
  await db.messages.add({
    ...message,
    id: nanoid(),
    sessionId,
    createdAt: new Date(),
  });

  // Update session timestamp & title (from first user message)
  const session = await db.sessions.get(sessionId);
  if (session?.title === "New conversation" && message.role === "user") {
    await db.sessions.update(sessionId, {
      title:
        message.content.slice(0, 50) +
        (message.content.length > 50 ? "..." : ""),
      updatedAt: new Date(),
    });
  } else {
    await db.sessions.update(sessionId, { updatedAt: new Date() });
  }
}

export async function deleteSession(sessionId: string) {
  await db.messages.where("sessionId").equals(sessionId).delete();
  await db.sessions.delete(sessionId);
}

export async function clearAllData() {
  await db.messages.clear();
  await db.sessions.clear();
}
