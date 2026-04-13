import { NextResponse } from "next/server";
import { listPaymentSessions } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const transactions = await listPaymentSessions();

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      total: transactions.length,
      transactions,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Gagal membaca riwayat transaksi.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
