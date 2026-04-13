import { NextResponse } from "next/server";
import { requireCurrentViewer } from "@/lib/auth";
import { getDashboardSummary } from "@/lib/member-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const viewer = await requireCurrentViewer();
    const summary = await getDashboardSummary(viewer.id);
    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca dashboard akun.";
    const status = /login/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
