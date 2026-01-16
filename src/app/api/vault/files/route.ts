import { NextResponse } from "next/server";
import { getMarkdownFiles } from "@/lib/github/api";

export async function GET() {
  try {
    const notes = await getMarkdownFiles();
    return NextResponse.json({ notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error fetching notes from GitHub:", message);
    return NextResponse.json({ notes: [], error: message });
  }
}
