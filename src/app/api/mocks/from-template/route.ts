import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mocks, parts, questions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { DEFAULT_PARTS_CONFIG } from "@/lib/constants/defaults";
import { MOCK_TEMPLATES, findTemplate } from "@/lib/constants/templates";
import { z } from "zod";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  templateId: z.string().min(1),
  title: z.string().min(2).optional(),
});

export async function GET() {
  try {
    await requireAuth();
    return NextResponse.json({
      templates: MOCK_TEMPLATES.map((template) => ({
        id: template.id,
        title: template.title,
        levelLabel: template.levelLabel,
        summary: template.summary,
        usesSamplePictures: template.usesSamplePictures,
        taskCount: template.parts.reduce((total, p) => total + p.questions.length, 0),
      })),
    });
  } catch (err: any) {
    if (err?.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    return NextResponse.json({ error: "Shablonlarni yuklashda xatolik" }, { status: 500 });
  }
}

/** Creates a complete, ready-to-edit mock from a built-in exam template. */
export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 });
    }

    const template = findTemplate(parsed.data.templateId);
    if (!template) {
      return NextResponse.json({ error: "Shablon topilmadi" }, { status: 404 });
    }

    const mockId = crypto.randomUUID();
    await db.insert(mocks).values({
      id: mockId,
      ownerId: session.userId,
      title: (parsed.data.title || template.title).trim(),
      levelLabel: template.levelLabel,
      status: "draft",
    });

    for (const partConfig of DEFAULT_PARTS_CONFIG) {
      const partId = crypto.randomUUID();
      await db.insert(parts).values({
        id: partId,
        mockId,
        order: partConfig.order,
        type: partConfig.type,
        displayLabel: partConfig.displayLabel,
        instructionText: partConfig.instructionText,
        defaultPrepSeconds: partConfig.defaultPrepSeconds,
        defaultAnswerSeconds: partConfig.defaultAnswerSeconds,
      });

      const templatePart = template.parts.find((p) => p.type === partConfig.type);
      if (!templatePart) continue;

      for (const [index, question] of templatePart.questions.entries()) {
        await db.insert(questions).values({
          id: crypto.randomUUID(),
          partId,
          order: index + 1,
          text: question.text || "",
          imageUrls: question.imageUrls || [],
          prepSeconds: question.prepSeconds ?? null,
          answerSeconds: question.answerSeconds ?? null,
          topic: question.topic ?? null,
          forPoints: question.forPoints || [],
          againstPoints: question.againstPoints || [],
        });
      }
    }

    const created = await db.select().from(mocks).where(eq(mocks.id, mockId)).limit(1);

    return NextResponse.json({ success: true, mock: created[0] }, { status: 201 });
  } catch (err: any) {
    if (err?.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Create mock from template error:", err);
    return NextResponse.json(
      { error: "Shablondan mock yaratishda xatolik" },
      { status: 500 }
    );
  }
}
