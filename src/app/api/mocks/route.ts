import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { mocks, parts, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "@/lib/auth/session";
import { createMockSchema } from "@/lib/validations/mock";
import { DEFAULT_PARTS_CONFIG } from "@/lib/constants/defaults";

export async function GET(request: Request) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);
    const scopeAll = searchParams.get("scope") === "all";

    if (scopeAll && session.role === "admin") {
      const allMocks = await db
        .select({
          id: mocks.id,
          title: mocks.title,
          levelLabel: mocks.levelLabel,
          status: mocks.status,
          createdAt: mocks.createdAt,
          updatedAt: mocks.updatedAt,
          ownerId: mocks.ownerId,
          ownerName: users.fullName,
          ownerLogin: users.login,
        })
        .from(mocks)
        .innerJoin(users, eq(users.id, mocks.ownerId))
        .orderBy(desc(mocks.updatedAt));

      return NextResponse.json({ mocks: allMocks });
    }

    // Teacher or personal mocks
    const userMocks = await db
      .select({
        id: mocks.id,
        title: mocks.title,
        levelLabel: mocks.levelLabel,
        status: mocks.status,
        createdAt: mocks.createdAt,
        updatedAt: mocks.updatedAt,
        ownerId: mocks.ownerId,
      })
      .from(mocks)
      .where(eq(mocks.ownerId, session.userId))
      .orderBy(desc(mocks.updatedAt));

    return NextResponse.json({ mocks: userMocks });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Fetch mocks error:", err);
    return NextResponse.json({ error: "Mock testlarni yuklashda xatolik" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = createMockSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Noto'g'ri ma'lumot kiritildi" },
        { status: 400 }
      );
    }

    const { title, levelLabel } = parsed.data;
    const mockId = crypto.randomUUID();

    // 1. Insert mock
    await db.insert(mocks).values({
      id: mockId,
      ownerId: session.userId,
      title: title.trim(),
      levelLabel: levelLabel?.trim() || "B1–C1",
      status: "draft",
    });

    // 2. Insert standard parts for this mock
    for (const partCfg of DEFAULT_PARTS_CONFIG) {
      const partId = crypto.randomUUID();
      await db.insert(parts).values({
        id: partId,
        mockId,
        order: partCfg.order,
        type: partCfg.type,
        displayLabel: partCfg.displayLabel,
        instructionText: partCfg.instructionText,
        defaultPrepSeconds: partCfg.defaultPrepSeconds,
        defaultAnswerSeconds: partCfg.defaultAnswerSeconds,
      });
    }

    const created = await db
      .select()
      .from(mocks)
      .where(eq(mocks.id, mockId))
      .limit(1);

    return NextResponse.json({ success: true, mock: created[0] }, { status: 201 });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Create mock error:", err);
    return NextResponse.json({ error: "Mock test yaratishda xatolik" }, { status: 500 });
  }
}
