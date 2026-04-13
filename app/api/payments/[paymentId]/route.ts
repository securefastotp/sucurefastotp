import { NextResponse } from "next/server";
import { getPaymentSession } from "@/lib/payments";

type RouteContext = {
  params: Promise<{
    paymentId: string;
  }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  const { paymentId } = await context.params;
  const requestUrl = new URL(_request.url);
  const sessionToken =
    _request.headers.get("x-payment-token") ??
    requestUrl.searchParams.get("token");

  try {
    const payment = await getPaymentSession(paymentId, sessionToken);

    if (!payment) {
      return NextResponse.json(
        { error: "Session payment tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json({ payment });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca payment session.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
