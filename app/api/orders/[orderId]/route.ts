import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function legacyOrderResponse() {
  return NextResponse.json(
    {
      error:
        "Endpoint status order publik sudah dinonaktifkan. Silakan login dan gunakan /api/account/orders/{orderId}.",
    },
    { status: 410 },
  );
}

export async function GET() {
  return legacyOrderResponse();
}

export async function DELETE() {
  return legacyOrderResponse();
}
