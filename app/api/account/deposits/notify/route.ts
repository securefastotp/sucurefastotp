import { NextResponse } from "next/server";
import { handleDepositNotification } from "@/lib/member-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as
    | Record<string, unknown>
    | null;

  if (!payload) {
    return NextResponse.json(
      { error: "Payload Midtrans tidak valid." },
      { status: 400 },
    );
  }

  try {
    const deposit = await handleDepositNotification(payload);

    return NextResponse.json({
      ok: true,
      depositId: deposit?.id ?? null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memproses webhook deposit.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
