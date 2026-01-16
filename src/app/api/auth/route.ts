import { NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";
import { sessionOptions, type SessionData } from "@/lib/auth/session";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const { password } = await req.json();

  const passwordHash = process.env.APP_PASSWORD_HASH;
  if (!passwordHash) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  const isValid = await bcrypt.compare(password, passwordHash);

  if (!isValid) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  session.isLoggedIn = true;
  await session.save();

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  session.destroy();
  return NextResponse.json({ success: true });
}

export async function GET() {
  const session = await getIronSession<SessionData>(
    await cookies(),
    sessionOptions
  );
  return NextResponse.json({ isLoggedIn: session.isLoggedIn ?? false });
}
