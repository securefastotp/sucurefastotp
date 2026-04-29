import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function legacyOrderResponse() {
  return NextResponse.json(
    {
      error:
        "Endpoint order publik sudah dinonaktifkan. Silakan login dan gunakan /api/account/orders agar saldo internal, riwayat, dan refund berjalan aman.",
    },
    { status: 410 },
  );
}

export async function GET() {
  return legacyOrderResponse();
}

export async function POST() {
  return legacyOrderResponse();
}
