import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth/session";
import { updateTeacherSchema } from "@/lib/validations/teacher";
import { hashPassword } from "@/lib/auth/password";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
    const { id } = await props.params;

    const body = await request.json();
    const parsed = updateTeacherSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Noto'g'ri ma'lumot kiritildi" },
        { status: 400 }
      );
    }

    const teacher = await db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.role, "teacher")))
      .limit(1);

    if (teacher.length === 0) {
      return NextResponse.json({ error: "O'qituvchi topilmadi" }, { status: 404 });
    }

    const { fullName, login, password, isActive } = parsed.data;
    const updateValues: Partial<typeof users.$inferInsert> = {};

    if (fullName) {
      updateValues.fullName = fullName.trim();
    }

    if (login) {
      const cleanLogin = login.toLowerCase().trim();
      const duplicate = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.login, cleanLogin), ne(users.id, id)))
        .limit(1);

      if (duplicate.length > 0) {
        return NextResponse.json(
          { error: "Bu login allaqachon boshqa foydalanuvchi tomonidan band qilingan" },
          { status: 409 }
        );
      }
      updateValues.login = cleanLogin;
    }

    if (typeof isActive === "boolean") {
      updateValues.isActive = isActive;
    }

    if (password && password.trim().length >= 6) {
      updateValues.passwordHash = await hashPassword(password.trim());
    }

    const updated = await db
      .update(users)
      .set(updateValues)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        fullName: users.fullName,
        login: users.login,
        role: users.role,
        isActive: users.isActive,
      });

    return NextResponse.json({ success: true, teacher: updated[0] });
  } catch (err: any) {
    if (err.message?.includes("Forbidden") || err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Ruxsat etilmagan" }, { status: 403 });
    }
    console.error("Update teacher error:", err);
    return NextResponse.json({ error: "O'qituvchini yangilashda xatolik yuz berdi" }, { status: 500 });
  }
}
