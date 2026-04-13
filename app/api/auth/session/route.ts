import { NextResponse } from "next/server";
import { getAuthState } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await getAuthState();
    return NextResponse.json(auth);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca session akun.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
