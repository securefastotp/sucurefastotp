import { NextResponse } from "next/server";
import { getCountries } from "@/lib/provider";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const countries = await getCountries(
      searchParams.get("server") ?? searchParams.get("serverId") ?? undefined,
    );

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      countries,
      total: countries.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengambil daftar negara.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
