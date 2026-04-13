import { NextResponse } from "next/server";
import { requireAdminViewer } from "@/lib/auth";
import { applyAdminPasswordReset } from "@/lib/member-service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    userId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdminViewer();
    const { userId } = await context.params;
    const body = (await request.json().catch(() => null)) as
      | {
          newPassword?: string;
        }
      | null;

    if (!body?.newPassword) {
      return NextResponse.json(
        { error: "Password baru wajib diisi." },
        { status: 400 },
      );
    }

    const viewer = await applyAdminPasswordReset({
      actorUserId: admin.id,
      targetUserId: userId,
      newPassword: body.newPassword,
    });

    return NextResponse.json(
      {
        viewer,
        message: "Password user berhasil diperbarui.",
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui password user.";
    const status = /admin/i.test(message) ? 403 : /login/i.test(message) ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
