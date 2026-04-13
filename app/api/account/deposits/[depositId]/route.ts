import { NextResponse } from "next/server";
import { requireCurrentViewer } from "@/lib/auth";
import { syncDepositStatus } from "@/lib/member-service";

type RouteContext = {
  params: Promise<{
    depositId: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const viewer = await requireCurrentViewer();
    const { depositId } = await context.params;
    const deposit = await syncDepositStatus(viewer.id, depositId);

    if (!deposit) {
      return NextResponse.json(
        { error: "Deposit tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json({ deposit });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca status deposit.";
    const status = /login/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
