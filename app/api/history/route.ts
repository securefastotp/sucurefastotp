import { NextResponse } from "next/server";
import { getHistory } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const history = await getHistory();
    return NextResponse.json(history);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca history order.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
