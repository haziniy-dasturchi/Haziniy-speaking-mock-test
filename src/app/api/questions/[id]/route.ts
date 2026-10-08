import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { questions, parts, mocks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { questionSchema } from "@/lib/validations/mock";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await props.params;

    const qList = await db
      .select({
        question: questions,
        part: parts,
        mock: mocks,
      })
      .from(questions)
      .innerJoin(parts, eq(parts.id, questions.partId))
      .innerJoin(mocks, eq(mocks.id, parts.mockId))
      .where(eq(questions.id, id))
      .limit(1);

    if (qList.length === 0) {
      return NextResponse.json({ error: "Savol topilmadi" }, { status: 404 });
    }

    const { question, mock } = qList[0];
    if (session.role !== "admin" && mock.ownerId !== session.userId) {
      return NextResponse.json({ error: "Ruxsat etilmagan" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = questionSchema.partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Noto'g'ri ma'lumot" },
        { status: 400 }
      );
    }

    // Audio cleanup if changed
    if (
      question.audioPublicId &&
      parsed.data.audioPublicId !== undefined &&
      parsed.data.audioPublicId !== question.audioPublicId
    ) {
      await deleteCloudinaryAsset(question.audioPublicId, "video");
    }

    // Images cleanup if any removed
    if (parsed.data.imageUrls && Array.isArray(question.imageUrls)) {
      const newPublicIds = new Set(parsed.data.imageUrls.map((img) => img.public_id));
      for (const oldImg of question.imageUrls) {
        if (oldImg.public_id && !newPublicIds.has(oldImg.public_id)) {
          await deleteCloudinaryAsset(oldImg.public_id, "image");
        }
      }
    }

    const updateData: Partial<typeof questions.$inferInsert> = {};
    if (parsed.data.text !== undefined) updateData.text = parsed.data.text;
    if (parsed.data.audioUrl !== undefined) updateData.audioUrl = parsed.data.audioUrl;
    if (parsed.data.audioPublicId !== undefined) updateData.audioPublicId = parsed.data.audioPublicId;
    if (parsed.data.imageUrls !== undefined) updateData.imageUrls = parsed.data.imageUrls;
    if (parsed.data.prepSeconds !== undefined) updateData.prepSeconds = parsed.data.prepSeconds;
    if (parsed.data.answerSeconds !== undefined) updateData.answerSeconds = parsed.data.answerSeconds;
    if (parsed.data.topic !== undefined) updateData.topic = parsed.data.topic;
    if (parsed.data.forPoints !== undefined) updateData.forPoints = parsed.data.forPoints;
    if (parsed.data.againstPoints !== undefined) updateData.againstPoints = parsed.data.againstPoints;

    const updated = await db
      .update(questions)
      .set(updateData)
      .where(eq(questions.id, id))
      .returning();

    return NextResponse.json({ success: true, question: updated[0] });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Update question error:", err);
    return NextResponse.json({ error: "Savolni yangilashda xatolik" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await props.params;

    const qList = await db
      .select({
        question: questions,
        part: parts,
        mock: mocks,
      })
      .from(questions)
      .innerJoin(parts, eq(parts.id, questions.partId))
      .innerJoin(mocks, eq(mocks.id, parts.mockId))
      .where(eq(questions.id, id))
      .limit(1);

    if (qList.length === 0) {
      return NextResponse.json({ error: "Savol topilmadi" }, { status: 404 });
    }

    const { question, mock } = qList[0];
    if (session.role !== "admin" && mock.ownerId !== session.userId) {
      return NextResponse.json({ error: "Ruxsat etilmagan" }, { status: 403 });
    }

    // Clean up audio
    if (question.audioPublicId) {
      await deleteCloudinaryAsset(question.audioPublicId, "video");
    }

    // Clean up images
    if (question.imageUrls && Array.isArray(question.imageUrls)) {
      for (const img of question.imageUrls) {
        if (img.public_id) {
          await deleteCloudinaryAsset(img.public_id, "image");
        }
      }
    }

    await db.delete(questions).where(eq(questions.id, id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Delete question error:", err);
    return NextResponse.json({ error: "Savolni o'chirishda xatolik" }, { status: 500 });
  }
}
