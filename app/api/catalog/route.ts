import { NextResponse } from "next/server";
import { getCatalog } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const catalog = await getCatalog({
      q: searchParams.get("q") ?? undefined,
      country: searchParams.get("country") ?? undefined,
      category: searchParams.get("category") ?? undefined,
    });

    return NextResponse.json(catalog);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengambil katalog.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
