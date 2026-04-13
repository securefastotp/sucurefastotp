import { NextResponse } from "next/server";
import { requireAdminViewer } from "@/lib/auth";
import { getAdminPricingState, updateAdminProfitPercent } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminViewer();
    const pricing = await getAdminPricingState();

    return NextResponse.json(pricing);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca pengaturan harga.";
    const status = /admin/i.test(message) ? 403 : /login/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        profitPercent?: number | string;
      }
    | null;
  const rawProfitPercent =
    typeof body?.profitPercent === "number"
      ? body.profitPercent
      : typeof body?.profitPercent === "string"
        ? Number(body.profitPercent)
        : NaN;

  if (!Number.isFinite(rawProfitPercent) || rawProfitPercent < 0) {
    return NextResponse.json(
      { error: "Persentase keuntungan wajib diisi dengan angka 0 atau lebih." },
      { status: 400 },
    );
  }

  try {
    await requireAdminViewer();
    const config = await updateAdminProfitPercent(rawProfitPercent);

    return NextResponse.json({
      config,
      message: "Persentase keuntungan berhasil diperbarui.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan persentase keuntungan.";
    const status = /admin/i.test(message) ? 403 : /login/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
