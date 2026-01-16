import bcrypt from "bcryptjs";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { type SessionData, sessionOptions } from "@/lib/auth/session";

export async function POST(req: Request) {
  const { password } = await req.json();

  const base64Hash = process.env.APP_PASSWORD_HASH;

  if (!base64Hash) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  const passwordHash = Buffer.from(base64Hash, "base64").toString("utf-8");
  const isValid = await bcrypt.compare(password, passwordHash);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );
  session.destroy();
  return NextResponse.json({ success: true });
}

export async function GET() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions,
  );
  return NextResponse.json({ isLoggedIn: session.isLoggedIn ?? false });
}
