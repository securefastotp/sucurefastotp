import { NextResponse } from "next/server";
import { cancelOrder, getOrder } from "@/lib/provider";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(_request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const requestUrl = new URL(_request.url);
  const contextToken =
    _request.headers.get("x-order-token") ??
    requestUrl.searchParams.get("token");

  try {
    const order = await getOrder(orderId, contextToken);

    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca status order.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { orderId } = await context.params;
  const requestUrl = new URL(_request.url);
  const contextToken =
    _request.headers.get("x-order-token") ??
    requestUrl.searchParams.get("token");

  try {
    const order = await cancelOrder(orderId, contextToken);

    if (!order) {
      return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membatalkan order.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
