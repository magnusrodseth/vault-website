import { NextResponse } from "next/server";
import { syncVault } from "@/lib/vault/sync";

export async function POST() {
  try {
    const result = await syncVault();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error syncing vault:", error);
    return NextResponse.json(
      { error: "Failed to sync vault" },
      { status: 500 }
    );
  }
}
