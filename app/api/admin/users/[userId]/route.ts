import { NextResponse } from "next/server";
import { requireAdminViewer } from "@/lib/auth";
import { applyAdminDeleteUser } from "@/lib/member-service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const admin = await requireAdminViewer();
    const { userId } = await context.params;

    await applyAdminDeleteUser({
      actorUserId: admin.id,
      targetUserId: userId,
    });

    return NextResponse.json({ message: "Akun user berhasil dihapus." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menghapus user.";
    const status = /admin/i.test(message) ? 403 : /login/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
