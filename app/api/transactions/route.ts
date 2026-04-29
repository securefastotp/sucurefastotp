import { NextResponse } from "next/server";
import { listPaymentSessions } from "@/lib/payments";
import type { PaymentRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

function toPublicTransaction(transaction: PaymentRecord) {
  return {
    id: transaction.id,
    gateway: transaction.gateway,
    paymentMethod: transaction.paymentMethod,
    serviceId: transaction.serviceId,
    serviceCode: transaction.serviceCode,
    serverId: transaction.serverId,
    providerServerId: transaction.providerServerId,
    providerName: transaction.providerName,
    operator: transaction.operator,
    service: transaction.service,
    country: transaction.country,
    countryId: transaction.countryId,
    subtotalAmount: transaction.subtotalAmount,
    feeAmount: transaction.feeAmount,
    amount: transaction.amount,
    currency: transaction.currency,
    status: transaction.status,
    paidAt: transaction.paidAt,
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

export async function GET() {
  try {
    const transactions = (await listPaymentSessions()).map(toPublicTransaction);

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
