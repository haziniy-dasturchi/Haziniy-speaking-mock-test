import { NextResponse } from "next/server";
import { clearSessionCookie, getSession } from "@/lib/auth/session";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ success: true, message: "Tizimdan muvaffaqiyatli chiqildi" });
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  return NextResponse.json({ user: session });
}
