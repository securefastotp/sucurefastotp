import { NextResponse } from "next/server";
import {
  isOperatorAllowedForCountry,
  normalizeOperatorForCountry,
} from "@/lib/operators";
import { createOrder } from "@/lib/provider";

type CreateOrderBody = {
  serviceId?: string;
  serviceCode?: string;
  serverId?: string;
  service?: string;
  country?: string;
  countryId?: number | string;
  operator?: string;
  price?: number;
  currency?: string;
};

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as CreateOrderBody | null;
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
    !Number.isFinite(countryId)
  ) {
    return NextResponse.json(
      {
        error:
          "Field `serviceId`, `serviceCode`, `serverId`, `service`, `country`, dan `countryId` wajib diisi untuk membuat order.",
      },
      { status: 400 },
    );
  }

  if (!isOperatorAllowedForCountry(countryId, body.operator)) {
    return NextResponse.json(
      { error: "Operator Indonesia hanya bisa dipakai untuk region Indonesia." },
      { status: 400 },
    );
  }

  try {
    const order = await createOrder({
      serviceId: body.serviceId,
      serviceCode: body.serviceCode,
      serverId: body.serverId,
      service: body.service,
      country: body.country,
      countryId,
      operator: normalizeOperatorForCountry(countryId, body.operator),
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
