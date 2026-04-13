import { NextResponse } from "next/server";
import { requireAdminViewer } from "@/lib/auth";
import {
  removeAdminServiceOverride,
  updateAdminServiceOverride,
} from "@/lib/pricing";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        serviceId?: string;
        serviceCode?: string;
        service?: string;
        serverId?: string;
        countryId?: number | string;
        country?: string;
        customPrice?: number | string;
        upstreamPrice?: number | string;
      }
    | null;
  const countryId =
    typeof body?.countryId === "number"
      ? body.countryId
      : typeof body?.countryId === "string"
        ? Number(body.countryId)
        : NaN;
  const customPrice =
    typeof body?.customPrice === "number"
      ? body.customPrice
      : typeof body?.customPrice === "string"
        ? Number(body.customPrice)
        : NaN;
  const upstreamPrice =
    typeof body?.upstreamPrice === "number"
      ? body.upstreamPrice
      : typeof body?.upstreamPrice === "string"
        ? Number(body.upstreamPrice)
        : NaN;

  if (
    !body?.serviceId ||
    !body.serviceCode ||
    !body.service ||
    !body.serverId ||
    !body.country ||
    !Number.isFinite(countryId) ||
    !Number.isFinite(customPrice) ||
    customPrice <= 0
  ) {
    return NextResponse.json(
      { error: "Data layanan dan harga custom wajib diisi dengan benar." },
      { status: 400 },
    );
  }

  try {
    await requireAdminViewer();
    const override = await updateAdminServiceOverride({
      serviceId: body.serviceId,
      serviceCode: body.serviceCode,
      service: body.service,
      serverId: body.serverId,
      countryId,
      country: body.country,
      customPrice,
      upstreamPrice: Number.isFinite(upstreamPrice) ? upstreamPrice : 0,
    });

    return NextResponse.json({
      override,
      message: "Harga layanan berhasil diperbarui.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan harga layanan.";
    const status = /admin/i.test(message) ? 403 : /login/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const serviceId = searchParams.get("serviceId")?.trim();

  if (!serviceId) {
    return NextResponse.json(
      { error: "serviceId wajib diisi untuk menghapus override." },
      { status: 400 },
    );
  }

  try {
    await requireAdminViewer();
    await removeAdminServiceOverride(serviceId);

    return NextResponse.json({
      message: "Override harga layanan berhasil dihapus.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menghapus override harga.";
    const status = /admin/i.test(message) ? 403 : /login/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
