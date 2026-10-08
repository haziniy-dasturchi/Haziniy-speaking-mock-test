import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mocks, parts, questions } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { Navbar } from "@/components/Navbar";
import { ToastProvider } from "@/components/Toast";
import { MockBuilder } from "./MockBuilder";

export const dynamic = "force-dynamic";

export default async function MockEditPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const { id } = await props.params;

  const mockList = await db
    .select()
    .from(mocks)
    .where(eq(mocks.id, id))
    .limit(1);

  if (mockList.length === 0) {
    redirect("/mocks");
  }

  const mock = mockList[0];
  if (session.role !== "admin" && mock.ownerId !== session.userId) {
    redirect("/mocks");
  }

  // Load parts ordered
  const mockParts = await db
    .select()
    .from(parts)
    .where(eq(parts.mockId, id))
    .orderBy(asc(parts.order));

  // Load questions for each part
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

  const initialMockData: any = {
    ...mock,
    parts: partsWithQuestions,
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={session} />
        <main className="flex-1">
          <MockBuilder initialMock={initialMockData} />
        </main>
      </div>
    </ToastProvider>
  );
}
