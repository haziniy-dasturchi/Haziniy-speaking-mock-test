import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { mocks, users } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Navbar } from "@/components/Navbar";
import { ToastProvider } from "@/components/Toast";
import { MocksDashboard } from "./MocksDashboard";

export const dynamic = "force-dynamic";

export default async function MocksPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const resolvedParams = await searchParams;
  const isAllScope = resolvedParams.scope === "all" && session.role === "admin";

  let mockList: any[] = [];

  if (isAllScope) {
    mockList = await db
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
  } else {
    mockList = await db
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
  }

  const serializedMocks = mockList.map((m) => ({
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }));

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={session} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <MocksDashboard
            key={isAllScope ? "all" : "my"}
            user={session}
            initialMocks={serializedMocks}
            isAllScope={isAllScope}
          />
        </main>
      </div>
    </ToastProvider>
  );
}
