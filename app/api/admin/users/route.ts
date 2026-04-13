import { NextResponse } from "next/server";
import { requireAdminViewer } from "@/lib/auth";
import { getAdminUserList } from "@/lib/member-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminViewer();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? "";
    const users = await getAdminUserList(search);

    return NextResponse.json({ users });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membaca daftar user.";
    const status = /admin/i.test(message) ? 403 : /login/i.test(message) ? 401 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
