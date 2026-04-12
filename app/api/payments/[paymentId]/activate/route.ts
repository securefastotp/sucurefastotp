import { NextResponse } from "next/server";
import { activatePaymentOrder } from "@/lib/payments";

type RouteContext = {
  params: Promise<{
    paymentId: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function POST(_request: Request, context: RouteContext) {
  const { paymentId } = await context.params;

  try {
    const payment = await activatePaymentOrder(paymentId);

    if (!payment) {
      return NextResponse.json(
        { error: "Session payment tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json({ payment, order: payment.order ?? null });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal aktivasi order dari Midtrans.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
