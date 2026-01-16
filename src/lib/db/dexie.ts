import Dexie, { type EntityTable } from "dexie";

export interface Session {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  parts?: unknown[];
  createdAt: Date;
}

const db = new Dexie("Pensieve") as Dexie & {
  sessions: EntityTable<Session, "id">;
  messages: EntityTable<Message, "id">;
};

db.version(1).stores({
  sessions: "id, createdAt, updatedAt",
  messages: "id, sessionId, createdAt",
});

export { db };
