import { NextResponse } from "next/server";
import { createOrder } from "@/lib/provider";

type CreateOrderBody = {
  serviceId?: string;
  service?: string;
  country?: string;
  price?: number;
  currency?: string;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateOrderBody | null;

  if (!body?.serviceId || !body.service || !body.country) {
    return NextResponse.json(
      {
        error:
          "Field `serviceId`, `service`, dan `country` wajib diisi untuk membuat order.",
      },
      { status: 400 },
    );
  }

  try {
    const order = await createOrder({
      serviceId: body.serviceId,
      service: body.service,
      country: body.country,
      price: body.price,
      currency: body.currency,
    });

    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membuat order.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
