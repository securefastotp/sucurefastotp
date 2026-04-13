import { NextResponse } from "next/server";
import { logoutAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    await logoutAccount();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal logout.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
