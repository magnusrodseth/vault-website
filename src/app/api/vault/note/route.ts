import { NextResponse } from "next/server";
import { readFileContent } from "@/lib/github/api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const path = searchParams.get("path");

  if (!path) {
    return NextResponse.json(
      { error: "Missing path parameter" },
      { status: 400 },
    );
  }

  try {
    const content = await readFileContent(path);
    return NextResponse.json({ path, content });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch note";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
