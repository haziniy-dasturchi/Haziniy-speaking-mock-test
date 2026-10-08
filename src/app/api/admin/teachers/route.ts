import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, mocks } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { createTeacherSchema } from "@/lib/validations/teacher";
import { hashPassword } from "@/lib/auth/password";

export async function GET() {
  try {
    await requireAdmin();

    const teacherList = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        login: users.login,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        mockCount: sql<number>`cast(count(${mocks.id}) as int)`,
      })
      .from(users)
      .leftJoin(mocks, eq(mocks.ownerId, users.id))
      .where(eq(users.role, "teacher"))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ teachers: teacherList });
  } catch (err: any) {
    if (err.message?.includes("Forbidden") || err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Ruxsat etilmagan" }, { status: 403 });
    }
    console.error("Fetch teachers error:", err);
    return NextResponse.json({ error: "Server xatoligi" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();

    const body = await request.json();
    const parsed = createTeacherSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Noto'g'ri ma'lumot kiritildi" },
        { status: 400 }
      );
    }

    const { fullName, login, password } = parsed.data;

    // Check login uniqueness
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.login, login.toLowerCase().trim()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json(
        { error: "Bu login bilan o'qituvchi allaqachon mavjud" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const newId = crypto.randomUUID();

    const inserted = await db
      .insert(users)
      .values({
        id: newId,
        fullName: fullName.trim(),
        login: login.toLowerCase().trim(),
        passwordHash,
        role: "teacher",
        isActive: true,
      })
      .returning({
        id: users.id,
        fullName: users.fullName,
        login: users.login,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return NextResponse.json({ success: true, teacher: inserted[0] }, { status: 201 });
  } catch (err: any) {
    if (err.message?.includes("Forbidden") || err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Ruxsat etilmagan" }, { status: 403 });
    }
    console.error("Create teacher error:", err);
    return NextResponse.json({ error: "O'qituvchi yaratishda xatolik yuz berdi" }, { status: 500 });
  }
}
