import { NextResponse } from "next/server";
import { getProviderOptions } from "@/lib/provider";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const countryId = searchParams.get("countryId") ?? searchParams.get("negara");
  const serverId =
    searchParams.get("server") ?? searchParams.get("serverId") ?? "mars";

  if (!countryId) {
    return NextResponse.json(
      { error: "countryId wajib diisi." },
      { status: 400 },
    );
  }

  try {
    const payload = await getProviderOptions({
      serverId,
      countryId,
    });

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memuat provider.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
