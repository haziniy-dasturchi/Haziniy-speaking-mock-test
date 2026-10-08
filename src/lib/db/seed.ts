import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./index";
import { users, mocks, parts, questions } from "./schema";
import { hashPassword } from "../auth/password";
import { eq } from "drizzle-orm";
import { DEFAULT_PARTS_CONFIG } from "../constants/defaults";

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

  // 3. Ensure a complete ready sample mock test
  const existingMocks = await db.select().from(mocks).limit(1);
  if (existingMocks.length === 0) {
    console.log("Creating standard sample CEFR Multilevel Speaking Mock...");
    const mockId = crypto.randomUUID();
    await db.insert(mocks).values({
      id: mockId,
      ownerId: teacherId,
      title: "CEFR Multilevel Speaking Mock #1 (Official Format)",
      levelLabel: "B1–C1",
      status: "ready",
    });

    // Create 4 parts
    // Part 1.1
    const p1_1_id = crypto.randomUUID();
    await db.insert(parts).values({
      id: p1_1_id,
      mockId,
      order: 1,
      type: "part1_1",
      displayLabel: "Part 1.1",
      instructionText: DEFAULT_PARTS_CONFIG[0].instructionText,
      defaultPrepSeconds: 5,
      defaultAnswerSeconds: 30,
    });

    await db.insert(questions).values([
      {
        id: crypto.randomUUID(),
        partId: p1_1_id,
        order: 1,
        text: "Can you tell me about your hometown and what makes it special?",
        imageUrls: [],
      },
      {
        id: crypto.randomUUID(),
        partId: p1_1_id,
        order: 2,
        text: "What do you usually enjoy doing in your free time?",
        imageUrls: [],
      },
      {
        id: crypto.randomUUID(),
        partId: p1_1_id,
        order: 3,
        text: "Do you prefer spending your holidays with your family or friends? Why?",
        imageUrls: [],
      },
    ]);

    // Part 1.2
    const p1_2_id = crypto.randomUUID();
    await db.insert(parts).values({
      id: p1_2_id,
      mockId,
      order: 2,
      type: "part1_2",
      displayLabel: "Part 1.2",
      instructionText: DEFAULT_PARTS_CONFIG[1].instructionText,
      defaultPrepSeconds: 5,
      defaultAnswerSeconds: 30,
    });

    await db.insert(questions).values({
      id: crypto.randomUUID(),
      partId: p1_2_id,
      order: 1,
      text: "Compare these two pictures showing different ways of studying (studying alone vs in a group). Which way do you find more productive, and why?",
      imageUrls: [
        { url: "/sample/study-alone.svg", public_id: "sample_study_alone" },
        { url: "/sample/study-group.svg", public_id: "sample_study_group" },
      ],
    });

    // Part 2
    const p2_id = crypto.randomUUID();
    await db.insert(parts).values({
      id: p2_id,
      mockId,
      order: 3,
      type: "part2",
      displayLabel: "Part 2",
      instructionText: DEFAULT_PARTS_CONFIG[2].instructionText,
      defaultPrepSeconds: 60,
      defaultAnswerSeconds: 120,
    });

    await db.insert(questions).values({
      id: crypto.randomUUID(),
      partId: p2_id,
      order: 1,
      text: "1. Describe what is happening in the picture.\n2. Why do you think people celebrate traditional holidays and gatherings together?\n3. Tell me about a memorable family celebration or festival you attended.",
      imageUrls: [
        { url: "/sample/celebration.svg", public_id: "sample_celebration" },
      ],
    });

    // Part 3
    const p3_id = crypto.randomUUID();
    await db.insert(parts).values({
      id: p3_id,
      mockId,
      order: 4,
      type: "part3",
      displayLabel: "Part 3",
      instructionText: DEFAULT_PARTS_CONFIG[3].instructionText,
      defaultPrepSeconds: 60,
      defaultAnswerSeconds: 120,
    });

    await db.insert(questions).values({
      id: crypto.randomUUID(),
      partId: p3_id,
      order: 1,
      text: "Some people believe that online education will completely replace traditional schools and universities in the future.",
      topic: "Some people believe that online education will completely replace traditional schools and universities in the future.",
      forPoints: [
        "Flexible schedule and self-paced learning from anywhere in the world",
        "Direct access to worldwide top universities and digital resources",
        "Cost-effective with lower tuition, commute, and accommodation fees",
      ],
      againstPoints: [
        "Lack of direct face-to-face social interaction and teamwork skills",
        "Requires high self-discipline; students can be easily distracted",
        "Practical laboratory experiments and hands-on skills are hard to conduct online",
      ],
      imageUrls: [],
    });

    console.log("✅ Namuna CEFR Mock test tayyorlandi va 'ready' holatga o'tkazildi!");
  }

  console.log("🎉 Baza to'liq muvaffaqiyatli tayyorlandi!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed xatoligi:", err);
  process.exit(1);
});
