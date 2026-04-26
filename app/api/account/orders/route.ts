import { NextResponse } from "next/server";
import { requireCurrentViewer } from "@/lib/auth";
import { getDashboardSummary, purchaseOtpWithWallet } from "@/lib/member-service";
import { isOperatorAllowedForCountry } from "@/lib/operators";

type CreateOrderBody = {
  serviceId?: string;
  serviceCode?: string;
  serverId?: "bimasakti" | "mars";
  countryId?: number | string;
  providerServerId?: string;
  providerCountryId?: number | string;
  providerServiceCode?: string;
  operator?: string;
};

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET() {
  try {
    const viewer = await requireCurrentViewer();
    const summary = await getDashboardSummary(viewer.id);
    return NextResponse.json({ orders: summary.orders });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca riwayat order akun.";
    const status = /login/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateOrderBody | null;
  const countryId =
    typeof body?.countryId === "number"
      ? body.countryId
      : typeof body?.countryId === "string"
        ? Number(body.countryId)
        : NaN;

  if (!body?.serviceId || !body.serverId || !Number.isFinite(countryId)) {
    return NextResponse.json(
      { error: "serviceId, serverId, dan countryId wajib diisi." },
      { status: 400 },
    );
  }

  if (!isOperatorAllowedForCountry(countryId, body.operator)) {
    return NextResponse.json(
      { error: "Provider/operator nomor tidak valid." },
      { status: 400 },
    );
  }

  try {
    const viewer = await requireCurrentViewer();
    const order = await purchaseOtpWithWallet({
      userId: viewer.id,
      serviceId: body.serviceId,
      serviceCode: body.serviceCode,
      serverId: body.serverId,
      countryId,
      providerServerId: body.providerServerId,
      providerCountryId:
        typeof body.providerCountryId === "number"
          ? body.providerCountryId
          : typeof body.providerCountryId === "string"
            ? Number(body.providerCountryId)
            : undefined,
      providerServiceCode: body.providerServiceCode,
      operator: body.operator,
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membuat order OTP.";
    const status =
      /login/i.test(message) ? 401 : /saldo/i.test(message) ? 409 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
