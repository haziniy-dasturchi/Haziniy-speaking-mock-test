/**
 * Database-backed media storage.
 *
 * Images and audio uploaded by teachers are stored directly in the Postgres
 * (Neon) database as base64 payloads and served back through /api/media/<id>.
 *
 * Why: the previous implementation wrote files into public/uploads with fs,
 * which always fails with HTTP 500 on serverless hosts (Vercel / Cloudflare),
 * where the filesystem is read-only. Storing media in the database works on
 * every host, requires no extra paid service, and keeps a mock test fully
 * self-contained (duplicate / delete / export all keep working).
 *
 * Cloudinary is still used automatically when valid credentials are present.
 */

import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const DB_MEDIA_PREFIX = "db_";

/** Maximum size accepted for a single stored file (after client-side compression). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4 MB
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024; // 8 MB

const CREATE_MEDIA_TABLE = `CREATE TABLE IF NOT EXISTS media (
  id TEXT PRIMARY KEY,
  owner_id TEXT,
  kind TEXT NOT NULL DEFAULT 'image',
  mime_type TEXT NOT NULL,
  filename TEXT,
  byte_size INTEGER NOT NULL DEFAULT 0,
  data TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
)`;

let schemaReady: Promise<void> | null = null;

/**
 * Creates the media table on first use so that a fresh deployment never needs
 * a manual migration step before teachers can upload files.
 */
export function ensureMediaSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        const databaseUrl = process.env.DATABASE_URL || "";
        if (databaseUrl.startsWith("postgres")) {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { neon } = require("@neondatabase/serverless");
          const sql = neon(databaseUrl);
          await sql.query(CREATE_MEDIA_TABLE);
        } else {
          const rawClient = (db as any).session?.client || (db as any).client;
          if (rawClient?.exec) {
            await rawClient.exec(CREATE_MEDIA_TABLE);
          } else if (rawClient?.query) {
            await rawClient.query(CREATE_MEDIA_TABLE);
          }
        }
      } catch (err) {
        schemaReady = null;
        throw err;
      }
    })();
  }
  return schemaReady;
}

export function isDbMediaId(publicId: string | null | undefined): boolean {
  return !!publicId && publicId.startsWith(DB_MEDIA_PREFIX);
}

function toRowId(publicId: string): string {
  return publicId.startsWith(DB_MEDIA_PREFIX)
    ? publicId.slice(DB_MEDIA_PREFIX.length)
    : publicId;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export interface StoredMedia {
  id: string;
  publicId: string;
  url: string;
  mimeType: string;
  byteSize: number;
}

export async function storeMedia(params: {
  bytes: Uint8Array;
  mimeType: string;
  kind: "image" | "audio";
  filename?: string | null;
  ownerId?: string | null;
}): Promise<StoredMedia> {
  await ensureMediaSchema();

  const id = crypto.randomUUID().replace(/-/g, "");
  await db.insert(media).values({
    id,
    ownerId: params.ownerId ?? null,
    kind: params.kind,
    mimeType: params.mimeType,
    filename: params.filename ?? null,
    byteSize: params.bytes.length,
    data: toBase64(params.bytes),
  });

  return {
    id,
    publicId: `${DB_MEDIA_PREFIX}${id}`,
    url: `/api/media/${id}`,
    mimeType: params.mimeType,
    byteSize: params.bytes.length,
  };
}

export async function readMedia(
  id: string
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  await ensureMediaSchema();

  const rows = await db
    .select()
    .from(media)
    .where(eq(media.id, toRowId(id)))
    .limit(1);

  if (rows.length === 0) return null;
  return { bytes: fromBase64(rows[0].data), mimeType: rows[0].mimeType };
}

export async function deleteMedia(publicId: string): Promise<boolean> {
  try {
    await ensureMediaSchema();
    await db.delete(media).where(eq(media.id, toRowId(publicId)));
    return true;
  } catch (err) {
    console.error("Media deletion error:", err);
    return false;
  }
}
