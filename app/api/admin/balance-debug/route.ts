import { NextResponse } from "next/server";
import { requireAdminViewer } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminViewer();

    const baseUrl = process.env.UPSTREAM_BASE_URL ?? "https://api.kirimkode.com/v1";
    const apiKey = process.env.UPSTREAM_API_KEY ?? "";
    const headerName = process.env.UPSTREAM_API_KEY_HEADER ?? "x-api-key";
    const url = new URL("/balance", baseUrl).toString();

    const headers = new Headers({
      Accept: "application/json",
    });

    if (headerName.toLowerCase() === "authorization") {
      headers.set("Authorization", `Bearer ${apiKey}`);
    } else {
      headers.set(headerName, apiKey);
      if (headerName.toLowerCase() !== "x-api-key") {
        headers.set("X-API-Key", apiKey);
      }
    }

    const upstream = await fetch(url, {
      headers,
      cache: "no-store",
    });
    const text = await upstream.text();

    return NextResponse.json({
      status: upstream.status,
      url,
      headerUsed: headerName,
      response: text,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca saldo upstream.";
    const status = /admin/i.test(message) ? 403 : /login/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
