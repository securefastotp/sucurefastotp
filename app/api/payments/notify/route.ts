import { NextResponse } from "next/server";
import { handleMidtransNotification } from "@/lib/payments";

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
    const payment = await handleMidtransNotification(payload);

    return NextResponse.json({
      ok: true,
      paymentId:
        payment && "id" in payment && typeof payment.id === "string"
          ? payment.id
          : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memproses notifikasi Midtrans.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
