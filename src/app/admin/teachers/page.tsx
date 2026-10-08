import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { users, mocks } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { Navbar } from "@/components/Navbar";
import { ToastProvider } from "@/components/Toast";
import { TeacherManager } from "./TeacherManager";

export const dynamic = "force-dynamic";

export default async function TeachersPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  if (session.role !== "admin") {
    redirect("/mocks");
  }

  // Load teachers with mock count
  const teachers = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      login: users.login,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
      mockCount: sql<number>`cast(count(${mocks.id}) as int)`,
    })
    .from(users)
    .leftJoin(mocks, eq(mocks.ownerId, users.id))
    .where(eq(users.role, "teacher"))
    .groupBy(users.id)
    .orderBy(desc(users.createdAt));

  const serializedTeachers = (teachers as any[]).map((t: any) => ({
    ...t,
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
  }));

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={session} />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <TeacherManager initialTeachers={serializedTeachers} />
        </main>
      </div>
    </ToastProvider>
  );
}
