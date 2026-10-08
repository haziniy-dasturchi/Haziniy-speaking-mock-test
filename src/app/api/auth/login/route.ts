import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parseResult = loginSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Noto'g'ri ma'lumot kiritildi" },
        { status: 400 }
      );
    }

    const { login, password } = parseResult.data;

    const userList = await db
      .select()
      .from(users)
      .where(eq(users.login, login.trim()))
      .limit(1);

    if (userList.length === 0) {
      return NextResponse.json(
        { error: "Login yoki parol noto'g'ri" },
        { status: 401 }
      );
    }

    const user = userList[0];

    if (!user.isActive) {
      return NextResponse.json(
        { error: "Ushbu hisob faolsizlantirilgan. Administratorga murojaat qiling." },
        { status: 403 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: "Login yoki parol noto'g'ri" },
        { status: 401 }
      );
    }

    await setSessionCookie({
      userId: user.id,
      login: user.login,
      fullName: user.fullName,
      role: user.role as "admin" | "teacher",
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Tizimga kirishda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
