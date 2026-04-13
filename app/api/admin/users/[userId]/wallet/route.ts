import { NextResponse } from "next/server";
import { requireAdminViewer } from "@/lib/auth";
import { applyAdminWalletAdjustment } from "@/lib/member-service";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
) {
  const body = (await request.json().catch(() => null)) as
    | {
        amount?: number | string;
        description?: string;
      }
    | null;

  const rawAmount =
    typeof body?.amount === "number"
      ? body.amount
      : typeof body?.amount === "string"
        ? Number(body.amount)
        : NaN;

  if (!Number.isFinite(rawAmount) || rawAmount === 0) {
    return NextResponse.json(
      { error: "Nominal saldo manual wajib diisi dan tidak boleh 0." },
      { status: 400 },
    );
  }

  try {
    const admin = await requireAdminViewer();
    const { userId } = await context.params;
    const viewer = await applyAdminWalletAdjustment({
      actorUserId: admin.id,
      targetUserId: userId,
      amount: rawAmount,
      description: body?.description,
    });

    return NextResponse.json({
      viewer,
      message: "Saldo user berhasil diperbarui oleh admin.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui saldo user.";
    const status = /admin/i.test(message) ? 403 : /login/i.test(message) ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
