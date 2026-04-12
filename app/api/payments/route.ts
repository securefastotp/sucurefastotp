import { NextResponse } from "next/server";
import { createPaymentSession } from "@/lib/payments";

type CreatePaymentBody = {
  serviceId?: string;
  serviceCode?: string;
  serverId?: string;
  operator?: string;
  service?: string;
  country?: string;
  countryId?: number | string;
  price?: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreatePaymentBody | null;
  const countryId =
    typeof body?.countryId === "number"
      ? body.countryId
      : typeof body?.countryId === "string"
        ? Number(body.countryId)
        : NaN;

  if (
    !body?.serviceId ||
    !body.serviceCode ||
    !body.serverId ||
    !body.service ||
    !body.country ||
    !Number.isFinite(countryId) ||
    !body.price
  ) {
    return NextResponse.json(
      {
        error:
          "Field `serviceId`, `serviceCode`, `serverId`, `service`, `country`, `countryId`, dan `price` wajib diisi untuk membuat checkout Midtrans.",
      },
      { status: 400 },
    );
  }

  try {
    const payment = await createPaymentSession({
      serviceId: body.serviceId,
      serviceCode: body.serviceCode,
      serverId: body.serverId,
      operator: body.operator,
      service: body.service,
      country: body.country,
      countryId,
      price: body.price,
      currency: body.currency,
      customerName: body.customerName,
      customerEmail: body.customerEmail,
      customerPhone: body.customerPhone,
    });

    return NextResponse.json({ payment }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membuat checkout Midtrans.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
