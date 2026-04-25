import { NextResponse } from "next/server";
import { requireCurrentViewer } from "@/lib/auth";
import { createDepositSession, getDashboardSummary } from "@/lib/member-service";

export const dynamic = "force-dynamic";

const MIN_DEPOSIT_AMOUNT = 1000;

export async function GET() {
  try {
    const viewer = await requireCurrentViewer();
    const summary = await getDashboardSummary(viewer.id);

    return NextResponse.json({
      deposits: summary.deposits,
      ledger: summary.ledger,
      balance: summary.viewer.walletBalance,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca data deposit.";
    const status = /login/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        amount?: number | string;
      }
    | null;

  const rawAmount =
    typeof body?.amount === "number"
      ? body.amount
      : typeof body?.amount === "string"
        ? Number(body.amount)
        : NaN;

  if (!Number.isFinite(rawAmount) || rawAmount < MIN_DEPOSIT_AMOUNT) {
    return NextResponse.json(
      { error: "Minimal deposit Rp1.000." },
      { status: 400 },
    );
  }

  try {
    const viewer = await requireCurrentViewer();
    const deposit = await createDepositSession({
      userId: viewer.id,
      amount: rawAmount,
      customerName: viewer.name,
      customerEmail: viewer.email,
    });

    return NextResponse.json({ deposit }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membuat deposit Midtrans.";
    const status = /login/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
