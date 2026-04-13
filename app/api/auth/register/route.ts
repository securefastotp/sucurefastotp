import { NextResponse } from "next/server";
import { registerAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        email?: string;
        password?: string;
      }
    | null;

  if (!body?.name || !body.email || !body.password) {
    return NextResponse.json(
      { error: "Nama, email, dan password wajib diisi." },
      { status: 400 },
    );
  }

  try {
    const viewer = await registerAccount({
      name: body.name,
      email: body.email,
      password: body.password,
    });

    return NextResponse.json({ viewer }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membuat akun.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
