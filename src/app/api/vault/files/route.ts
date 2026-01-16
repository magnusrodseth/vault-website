import { NextResponse } from "next/server";
import { getAllNotes } from "@/lib/vault/search";

export async function GET() {
  try {
    const notes = await getAllNotes();
    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Error fetching notes:", error);
    return NextResponse.json({ notes: [] });
  }
}
