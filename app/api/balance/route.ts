import { NextResponse } from "next/server";
import { getBalance } from "@/lib/provider";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  try {
    const balance = await getBalance();
    return NextResponse.json({ balance });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca balance.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
