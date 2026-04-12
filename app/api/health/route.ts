import { NextResponse } from "next/server";
import { getRuntimeStatus } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const status = await getRuntimeStatus();
    return NextResponse.json({
      status: "ok",
      updatedAt: new Date().toISOString(),
      runtime: status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca status runtime.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
