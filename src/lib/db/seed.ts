import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./index";
import { users, mocks, parts, questions } from "./schema";
import { hashPassword } from "../auth/password";
import { eq } from "drizzle-orm";
import { DEFAULT_PARTS_CONFIG } from "../constants/defaults";
import { SPORTS_AND_FAILURE_TEMPLATE } from "../constants/templates";

async function main() {
  console.log("🌱 Initializing and seeding Haziniy Speaking Mock database...");

  // If using local PGlite, access underlying client to create tables
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      login TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'teacher',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS mocks (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      level_label TEXT NOT NULL DEFAULT 'B1–C1',
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS parts (
      id TEXT PRIMARY KEY,
      mock_id TEXT NOT NULL REFERENCES mocks(id) ON DELETE CASCADE,
      "order" INTEGER NOT NULL,
      type TEXT NOT NULL,
      display_label TEXT NOT NULL,
      instruction_text TEXT NOT NULL,
      instruction_audio_url TEXT,
      instruction_audio_public_id TEXT,
      default_prep_seconds INTEGER NOT NULL,
      default_answer_seconds INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      owner_id TEXT,
      kind TEXT NOT NULL DEFAULT 'image',
      mime_type TEXT NOT NULL,
      filename TEXT,
      byte_size INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`,
    `CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      part_id TEXT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
      "order" INTEGER NOT NULL,
      text TEXT NOT NULL DEFAULT '',
      audio_url TEXT,
      audio_public_id TEXT,
      image_urls JSONB DEFAULT '[]'::jsonb,
      prep_seconds INTEGER,
      answer_seconds INTEGER,
      topic TEXT,
      for_points JSONB DEFAULT '[]'::jsonb,
      against_points JSONB DEFAULT '[]'::jsonb
    )`
  ];

  try {
    const dbUrl = process.env.DATABASE_URL || "";
    if (dbUrl.startsWith("postgres") && !dbUrl.includes("ep-sample-pooler")) {
      console.log("Connecting to Neon cloud database and creating tables...");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { neon } = require("@neondatabase/serverless");
      const sql = neon(dbUrl);
      for (const statement of ddlStatements) {
        await (sql as any).query(statement);
      }
    } else {
      const rawClient = (db as any).session?.client || (db as any).client;
      if (rawClient) {
        for (const statement of ddlStatements) {
          if (typeof rawClient.exec === "function") {
            await rawClient.exec(statement);
          } else if (typeof rawClient.query === "function") {
            await rawClient.query(statement);
          }
        }
      }
    }
  } catch (tableErr) {
    console.log("Notice on table check:", tableErr);
  }

  const adminLogin = process.env.ADMIN_LOGIN || "admin";
  const adminPassword = process.env.ADMIN_PASSWORD || "HaziniyAdmin2026!";

  // 1. Ensure Admin User
  let adminId = crypto.randomUUID();
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.login, adminLogin))
    .limit(1);

  if (existingAdmin.length === 0) {
    const passwordHash = await hashPassword(adminPassword);
    await db.insert(users).values({
      id: adminId,
      fullName: "Haziniy Administrator",
      login: adminLogin,
      passwordHash,
      role: "admin",
      isActive: true,
    });
    console.log(`✅ Admin yaratildi: login: ${adminLogin}, parol: ${adminPassword}`);
  } else {
    adminId = existingAdmin[0].id;
    console.log(`ℹ️ Admin allaqachon mavjud: ${adminLogin}`);
  }

  // 2. Ensure Teacher User
  const teacherLogin = "teacher1";
  const teacherPassword = "Teacher2026!";
  let teacherId = crypto.randomUUID();

  const existingTeacher = await db
    .select()
    .from(users)
    .where(eq(users.login, teacherLogin))
    .limit(1);

  if (existingTeacher.length === 0) {
    const passwordHash = await hashPassword(teacherPassword);
    await db.insert(users).values({
      id: teacherId,
      fullName: "Rustam Karimov",
      login: teacherLogin,
      passwordHash,
      role: "teacher",
      isActive: true,
    });
    console.log(`✅ O'qituvchi yaratildi: login: ${teacherLogin}, parol: ${teacherPassword}`);
  } else {
    teacherId = existingTeacher[0].id;
    console.log(`ℹ️ O'qituvchi allaqachon mavjud: ${teacherLogin}`);
  }

  // 3. Ensure a complete sample mock built from the official exam template
  const existingMocks = await db.select().from(mocks).limit(1);
  if (existingMocks.length === 0) {
    console.log("Creating the standard CEFR Multilevel Speaking Mock template...");

    const template = SPORTS_AND_FAILURE_TEMPLATE;
    const mockId = crypto.randomUUID();

    await db.insert(mocks).values({
      id: mockId,
      ownerId: teacherId,
      title: "Multilevel Speaking Mock #1 (Namuna)",
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

    console.log("✅ Namuna mock test shablon asosida tayyorlandi (8 ta topshiriq).");
  }

  console.log("🎉 Baza to'liq muvaffaqiyatli tayyorlandi!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed xatoligi:", err);
  process.exit(1);
});
