import { NextResponse } from "next/server";
import { listOrdersFromDatabase } from "@/lib/order-store";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const limitValue = Number(requestUrl.searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitValue) ? Math.max(1, Math.min(100, limitValue)) : 20;

  try {
    const orders = await listOrdersFromDatabase(limit);

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      total: orders.length,
      orders,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca riwayat order.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
