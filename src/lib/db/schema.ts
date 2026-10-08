import { pgTable, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  fullName: text("full_name").notNull(),
  login: text("login").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "teacher"] }).notNull().default("teacher"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const mocks = pgTable("mocks", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  levelLabel: text("level_label").notNull().default("B1–C1"),
  status: text("status", { enum: ["draft", "ready"] }).notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const parts = pgTable("parts", {
  id: text("id").primaryKey(),
  mockId: text("mock_id")
    .notNull()
    .references(() => mocks.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  type: text("type", { enum: ["part1_1", "part1_2", "part2", "part3"] }).notNull(),
  displayLabel: text("display_label").notNull(),
  instructionText: text("instruction_text").notNull(),
  instructionAudioUrl: text("instruction_audio_url"),
  instructionAudioPublicId: text("instruction_audio_public_id"),
  defaultPrepSeconds: integer("default_prep_seconds").notNull(),
  defaultAnswerSeconds: integer("default_answer_seconds").notNull(),
});

export interface QuestionImageItem {
  url: string;
  public_id: string;
}

export const questions = pgTable("questions", {
  id: text("id").primaryKey(),
  partId: text("part_id")
    .notNull()
    .references(() => parts.id, { onDelete: "cascade" }),
  order: integer("order").notNull(),
  text: text("text").notNull().default(""),
  audioUrl: text("audio_url"),
  audioPublicId: text("audio_public_id"),
  imageUrls: jsonb("image_urls").$type<QuestionImageItem[]>().default([]),
  prepSeconds: integer("prep_seconds"),
  answerSeconds: integer("answer_seconds"),
  topic: text("topic"),
  forPoints: jsonb("for_points").$type<string[]>().default([]),
  againstPoints: jsonb("against_points").$type<string[]>().default([]),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  mocks: many(mocks),
}));

export const mocksRelations = relations(mocks, ({ one, many }) => ({
  owner: one(users, {
    fields: [mocks.ownerId],
    references: [users.id],
  }),
  parts: many(parts),
}));

export const partsRelations = relations(parts, ({ one, many }) => ({
  mock: one(mocks, {
    fields: [parts.mockId],
    references: [mocks.id],
  }),
  questions: many(questions),
}));

export const questionsRelations = relations(questions, ({ one }) => ({
  part: one(parts, {
    fields: [questions.partId],
    references: [parts.id],
  }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Mock = typeof mocks.$inferSelect;
export type NewMock = typeof mocks.$inferInsert;
export type Part = typeof parts.$inferSelect;
export type NewPart = typeof parts.$inferInsert;
export type Question = typeof questions.$inferSelect;
export type NewQuestion = typeof questions.$inferInsert;
