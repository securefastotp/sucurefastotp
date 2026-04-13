import { NextResponse } from "next/server";
import { requireAdminViewer } from "@/lib/auth";
import { applyAdminBlockUser } from "@/lib/member-service";

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
          blocked?: boolean;
        }
      | null;

    if (typeof body?.blocked !== "boolean") {
      return NextResponse.json(
        { error: "Status blokir wajib diisi." },
        { status: 400 },
      );
    }

    const viewer = await applyAdminBlockUser({
      actorUserId: admin.id,
      targetUserId: userId,
      blocked: body.blocked,
    });

    return NextResponse.json(
      {
        viewer,
        message: body.blocked
          ? "Akun user berhasil diblokir."
          : "Akun user berhasil dibuka kembali.",
      },
      { status: 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui status user.";
    const status = /admin/i.test(message) ? 403 : /login/i.test(message) ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
