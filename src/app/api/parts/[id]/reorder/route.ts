import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parts, mocks, questions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { updateQuestionOrderSchema } from "@/lib/validations/mock";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: partId } = await props.params;

    const partList = await db
      .select({ part: parts, mock: mocks })
      .from(parts)
      .innerJoin(mocks, eq(mocks.id, parts.mockId))
      .where(eq(parts.id, partId))
      .limit(1);

    if (partList.length === 0) {
      return NextResponse.json({ error: "Bo'lim topilmadi" }, { status: 404 });
    }

    const { mock } = partList[0];
    if (session.role !== "admin" && mock.ownerId !== session.userId) {
      return NextResponse.json({ error: "Ruxsat etilmagan" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateQuestionOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Noto'g'ri ma'lumot" }, { status: 400 });
    }

    const { questionIds } = parsed.data;

    // Update order for each question
    await Promise.all(
      questionIds.map(async (qId, index) => {
        await db
          .update(questions)
          .set({ order: index + 1 })
          .where(eq(questions.id, qId));
      })
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Reorder questions error:", err);
    return NextResponse.json({ error: "Savollarni qayta tartiblashda xatolik" }, { status: 500 });
  }
}
