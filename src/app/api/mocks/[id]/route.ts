import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mocks, parts, questions } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { updateMockSchema, validateMockReady } from "@/lib/validations/mock";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";

export async function GET(
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

    const mock = mockList[0];
    if (session.role !== "admin" && mock.ownerId !== session.userId) {
      return NextResponse.json({ error: "Ruxsat etilmagan" }, { status: 403 });
    }

    // Load parts ordered
    const mockParts = await db
      .select()
      .from(parts)
      .where(eq(parts.mockId, id))
      .orderBy(asc(parts.order));

    // Load questions for all parts
    const partsWithQuestions = await Promise.all(
      (mockParts as any[]).map(async (part: any) => {
        const partQuestions = await db
          .select()
          .from(questions)
          .where(eq(questions.partId, part.id))
          .orderBy(asc(questions.order));
        return {
          ...part,
          questions: partQuestions,
        };
      })
    );

    return NextResponse.json({
      mock: {
        ...mock,
        parts: partsWithQuestions,
      },
    });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Fetch mock detail error:", err);
    return NextResponse.json({ error: "Mock testni yuklashda xatolik" }, { status: 500 });
  }
}

export async function PATCH(
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

    const mock = mockList[0];
    if (session.role !== "admin" && mock.ownerId !== session.userId) {
      return NextResponse.json({ error: "Ruxsat etilmagan" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateMockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Noto'g'ri ma'lumot" },
        { status: 400 }
      );
    }

    // If setting to ready, validate completeness
    if (parsed.data.status === "ready") {
      const mockParts = await db
        .select()
        .from(parts)
        .where(eq(parts.mockId, id))
        .orderBy(asc(parts.order));

      const partsWithQuestions = await Promise.all(
        (mockParts as any[]).map(async (part: any) => {
          const partQuestions = await db
            .select()
            .from(questions)
            .where(eq(questions.partId, part.id))
            .orderBy(asc(questions.order));
          return {
            ...part,
            questions: partQuestions,
          };
        })
      );

      const validation = validateMockReady(partsWithQuestions);
      if (!validation.isValid) {
        return NextResponse.json(
          {
            error: "Mock test hali to'liq emas:\n" + validation.errors.join("\n"),
            validationErrors: validation.errors,
          },
          { status: 400 }
        );
      }
    }

    const updateData: Partial<typeof mocks.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
    if (parsed.data.levelLabel !== undefined) updateData.levelLabel = parsed.data.levelLabel;
    if (parsed.data.status !== undefined) updateData.status = parsed.data.status;

    const updated = await db
      .update(mocks)
      .set(updateData)
      .where(eq(mocks.id, id))
      .returning();

    return NextResponse.json({ success: true, mock: updated[0] });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Update mock error:", err);
    return NextResponse.json({ error: "Mock testni yangilashda xatolik" }, { status: 500 });
  }
}

export async function DELETE(
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

    const mock = mockList[0];
    if (session.role !== "admin" && mock.ownerId !== session.userId) {
      return NextResponse.json({ error: "Ruxsat etilmagan" }, { status: 403 });
    }

    // Collect all media public_ids to clean up Cloudinary storage
    const mockParts = await db.select().from(parts).where(eq(parts.mockId, id));
    for (const part of mockParts) {
      if (part.instructionAudioPublicId) {
        await deleteCloudinaryAsset(part.instructionAudioPublicId, "video");
      }
      const partQuestions = await db
        .select()
        .from(questions)
        .where(eq(questions.partId, part.id));
      for (const q of partQuestions) {
        if (q.audioPublicId) {
          await deleteCloudinaryAsset(q.audioPublicId, "video");
        }
        if (q.imageUrls && Array.isArray(q.imageUrls)) {
          for (const img of q.imageUrls) {
            if (img.public_id) {
              await deleteCloudinaryAsset(img.public_id, "image");
            }
          }
        }
      }
    }

    // Delete mock (cascades to parts and questions in DB)
    await db.delete(mocks).where(eq(mocks.id, id));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Delete mock error:", err);
    return NextResponse.json({ error: "Mock testni o'chirishda xatolik" }, { status: 500 });
  }
}
