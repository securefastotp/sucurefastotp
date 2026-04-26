import { NextResponse } from "next/server";
import { getServiceProviders } from "@/lib/provider";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const countryId = searchParams.get("countryId") ?? searchParams.get("negara");
  const serviceCode =
    searchParams.get("serviceCode") ?? searchParams.get("code") ?? "";
  const serverId =
    searchParams.get("server") ?? searchParams.get("serverId") ?? "bimasakti";

  if (!countryId || !serviceCode) {
    return NextResponse.json(
      { error: "countryId dan serviceCode wajib diisi." },
      { status: 400 },
    );
  }

  try {
    const payload = await getServiceProviders({
      serverId,
      countryId,
      serviceCode,
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memuat provider layanan.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
