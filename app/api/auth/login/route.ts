import { NextResponse } from "next/server";
import { loginAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        email?: string;
        password?: string;
      }
    | null;

  if (!body?.email || !body.password) {
    return NextResponse.json(
      { error: "Email dan password wajib diisi." },
      { status: 400 },
    );
  }

  try {
    const viewer = await loginAccount({
      email: body.email,
      password: body.password,
    });

    return NextResponse.json({ viewer });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal login.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
