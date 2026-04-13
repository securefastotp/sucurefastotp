import { NextResponse } from "next/server";
import { requireCurrentViewer, updateAccountProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        email?: string;
        currentPassword?: string;
        newPassword?: string;
      }
    | null;

  if (!body?.name || !body.email || !body.currentPassword) {
    return NextResponse.json(
      { error: "Nama, email, dan password saat ini wajib diisi." },
      { status: 400 },
    );
  }

  try {
    const viewer = await requireCurrentViewer();
    const nextViewer = await updateAccountProfile({
      userId: viewer.id,
      name: body.name,
      email: body.email,
      currentPassword: body.currentPassword,
      newPassword: body.newPassword,
    });

    return NextResponse.json({
      viewer: nextViewer,
      message: "Pengaturan akun berhasil diperbarui.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui akun.";
    const status = /login/i.test(message) ? 401 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
