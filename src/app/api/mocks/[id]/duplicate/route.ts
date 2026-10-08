import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mocks, parts, questions } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await props.params;

    const mockList = await db
      .select()
      .from(mocks)
      .where(eq(mocks.id, id))
      .limit(1);

    if (mockList.length === 0) {
      return NextResponse.json({ error: "Mock test topilmadi" }, { status: 404 });
    }

    const originalMock = mockList[0];
    if (session.role !== "admin" && originalMock.ownerId !== session.userId) {
      return NextResponse.json({ error: "Ruxsat etilmagan" }, { status: 403 });
    }

    // 1. Create duplicate mock
    const newMockId = crypto.randomUUID();
    await db.insert(mocks).values({
      id: newMockId,
      ownerId: session.userId,
      title: `${originalMock.title} (Nusxa)`,
      levelLabel: originalMock.levelLabel,
      status: "draft",
    });

    // 2. Fetch original parts
    const originalParts = await db
      .select()
      .from(parts)
      .where(eq(parts.mockId, id))
      .orderBy(asc(parts.order));

    for (const p of originalParts) {
      const newPartId = crypto.randomUUID();
      await db.insert(parts).values({
        id: newPartId,
        mockId: newMockId,
        order: p.order,
        type: p.type,
        displayLabel: p.displayLabel,
        instructionText: p.instructionText,
        instructionAudioUrl: p.instructionAudioUrl,
        instructionAudioPublicId: p.instructionAudioPublicId,
        defaultPrepSeconds: p.defaultPrepSeconds,
        defaultAnswerSeconds: p.defaultAnswerSeconds,
      });

      // Fetch and duplicate questions
      const originalQuestions = await db
        .select()
        .from(questions)
        .where(eq(questions.partId, p.id))
        .orderBy(asc(questions.order));

      for (const q of originalQuestions) {
        const newQuestionId = crypto.randomUUID();
        await db.insert(questions).values({
          id: newQuestionId,
          partId: newPartId,
          order: q.order,
          text: q.text,
          audioUrl: q.audioUrl,
          audioPublicId: q.audioPublicId,
          imageUrls: q.imageUrls,
          prepSeconds: q.prepSeconds,
          answerSeconds: q.answerSeconds,
          topic: q.topic,
          forPoints: q.forPoints,
          againstPoints: q.againstPoints,
        });
      }
    }

    const created = await db
      .select()
      .from(mocks)
      .where(eq(mocks.id, newMockId))
      .limit(1);

    return NextResponse.json({ success: true, mock: created[0] }, { status: 201 });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Duplicate mock error:", err);
    return NextResponse.json({ error: "Nusxa olishda xatolik yuz berdi" }, { status: 500 });
  }
}
