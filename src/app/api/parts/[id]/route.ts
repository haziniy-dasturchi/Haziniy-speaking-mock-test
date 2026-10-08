import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { parts, mocks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { updatePartSchema } from "@/lib/validations/mock";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await props.params;

    const partList = await db
      .select({
        part: parts,
        mock: mocks,
      })
      .from(parts)
      .innerJoin(mocks, eq(mocks.id, parts.mockId))
      .where(eq(parts.id, id))
      .limit(1);

    if (partList.length === 0) {
      return NextResponse.json({ error: "Bo'lim topilmadi" }, { status: 404 });
    }

    const { part, mock } = partList[0];
    if (session.role !== "admin" && mock.ownerId !== session.userId) {
      return NextResponse.json({ error: "Ruxsat etilmagan" }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updatePartSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Noto'g'ri ma'lumot" },
        { status: 400 }
      );
    }

    // If audio changed, clean up previous audio in Cloudinary
    if (
      part.instructionAudioPublicId &&
      parsed.data.instructionAudioPublicId !== undefined &&
      parsed.data.instructionAudioPublicId !== part.instructionAudioPublicId
    ) {
      await deleteCloudinaryAsset(part.instructionAudioPublicId, "video");
    }

    const updated = await db
      .update(parts)
      .set({
        instructionText: parsed.data.instructionText,
        instructionAudioUrl: parsed.data.instructionAudioUrl,
        instructionAudioPublicId: parsed.data.instructionAudioPublicId,
        defaultPrepSeconds: parsed.data.defaultPrepSeconds,
        defaultAnswerSeconds: parsed.data.defaultAnswerSeconds,
      })
      .where(eq(parts.id, id))
      .returning();

    return NextResponse.json({ success: true, part: updated[0] });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Update part error:", err);
    return NextResponse.json({ error: "Bo'limni yangilashda xatolik" }, { status: 500 });
  }
}
