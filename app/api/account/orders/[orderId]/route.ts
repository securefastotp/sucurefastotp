import { NextResponse } from "next/server";
import { requireCurrentViewer } from "@/lib/auth";
import { cancelUserOrder, syncUserOrder } from "@/lib/member-service";

type RouteContext = {
  params: Promise<{
    orderId: string;
  }>;
};

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const viewer = await requireCurrentViewer();
    const { orderId } = await context.params;
    const order = await syncUserOrder(viewer.id, orderId);

    if (!order) {
      return NextResponse.json(
        { error: "Order user tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json({ order });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal sinkron status order.";
    const status = /login/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const viewer = await requireCurrentViewer();
    const { orderId } = await context.params;
    const order = await cancelUserOrder(viewer.id, orderId);

    if (!order) {
      return NextResponse.json(
        { error: "Order user tidak ditemukan." },
        { status: 404 },
      );
    }

    return NextResponse.json({
      order,
      message: "Order berhasil dibatalkan dan saldo direfund.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membatalkan order OTP.";
    const status =
      /login/i.test(message)
        ? 401
        : /tidak bisa dibatalkan|cannot cancel|3 minute|3 menit|refund/i.test(message)
          ? 409
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
