import { NextResponse } from "next/server";
import { requireAdminViewer } from "@/lib/auth";
import { buildUpstreamUrl, getProviderConfig } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdminViewer();

    const config = getProviderConfig();
    const baseUrl = config.baseUrl ?? "https://api.kirimkode.com/v1";
    const apiKey = config.apiKey ?? "";
    const headerName = config.apiKeyHeader ?? "x-api-key";
    const url = buildUpstreamUrl(baseUrl, "/balance").toString();

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
