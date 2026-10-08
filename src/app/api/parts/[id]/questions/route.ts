import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parts, mocks, questions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { questionSchema } from "@/lib/validations/mock";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: partId } = await props.params;

    const partList = await db
      .select({
        part: parts,
        mock: mocks,
      })
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
    const parsed = questionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Noto'g'ri ma'lumot" },
        { status: 400 }
      );
    }

    // Find current max order
    const lastQuestion = await db
      .select({ order: questions.order })
      .from(questions)
      .where(eq(questions.partId, partId))
      .orderBy(desc(questions.order))
      .limit(1);

    const nextOrder = lastQuestion.length > 0 ? lastQuestion[0].order + 1 : 1;
    const newQuestionId = crypto.randomUUID();

    const inserted = await db
      .insert(questions)
      .values({
        id: newQuestionId,
        partId,
        order: nextOrder,
        text: parsed.data.text || "",
        audioUrl: parsed.data.audioUrl || null,
        audioPublicId: parsed.data.audioPublicId || null,
        imageUrls: parsed.data.imageUrls || [],
        prepSeconds: parsed.data.prepSeconds ?? null,
        answerSeconds: parsed.data.answerSeconds ?? null,
        topic: parsed.data.topic ?? null,
        forPoints: parsed.data.forPoints || [],
        againstPoints: parsed.data.againstPoints || [],
      })
      .returning();

    return NextResponse.json({ success: true, question: inserted[0] }, { status: 201 });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Add question error:", err);
    return NextResponse.json({ error: "Savol qo'shishda xatolik" }, { status: 500 });
  }
}
