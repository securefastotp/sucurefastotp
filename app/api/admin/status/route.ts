import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdminViewer } from "@/lib/auth";
import { getProviderConfig } from "@/lib/provider";

export const dynamic = "force-dynamic";

function fingerprintKey(key: string) {
  return crypto.createHash("sha256").update(key).digest("hex").slice(0, 10);
}

function lastChars(value: string, count = 6) {
  return value.length > count ? value.slice(-count) : value;
}

export async function GET() {
  try {
    await requireAdminViewer();
    const config = getProviderConfig();
    const upstreamKey = config.apiKey ?? "";

    return NextResponse.json({
      databaseConfigured: Boolean(
        process.env.POSTGRES_URL?.trim() || process.env.DATABASE_URL?.trim(),
      ),
      upstreamKeyPresent: Boolean(upstreamKey),
      upstreamKeySuffix: upstreamKey ? lastChars(upstreamKey) : null,
      upstreamKeyFingerprint: upstreamKey ? fingerprintKey(upstreamKey) : null,
      upstreamBaseUrl: config.baseUrl,
      upstreamHeader: config.apiKeyHeader,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca status admin.";
    const status = /admin/i.test(message) ? 403 : /login/i.test(message) ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
