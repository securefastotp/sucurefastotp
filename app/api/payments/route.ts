import { NextResponse } from "next/server";
import { createPaymentSession } from "@/lib/payments";

type CreatePaymentBody = {
  serviceId?: string;
  service?: string;
  country?: string;
  price?: number;
  currency?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreatePaymentBody | null;

  if (!body?.serviceId || !body.service || !body.country || !body.price) {
    return NextResponse.json(
      {
        error:
          "Field `serviceId`, `service`, `country`, dan `price` wajib diisi untuk membuat checkout Midtrans.",
      },
      { status: 400 },
    );
  }

  try {
    const payment = await createPaymentSession({
      serviceId: body.serviceId,
      service: body.service,
      country: body.country,
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
