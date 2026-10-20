import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  storeMedia,
  MAX_IMAGE_BYTES,
  MAX_AUDIO_BYTES,
} from "@/lib/media-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml",
];

const ALLOWED_AUDIO_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/m4a",
  "audio/aac",
  "video/mp4",
];

function humanSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function POST(request: Request) {
  try {
    const session = await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file");
    const requestedKind = String(formData.get("resourceType") || "image");
    const kind: "image" | "audio" =
      requestedKind === "video" || requestedKind === "audio" ? "audio" : "image";

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Fayl yuborilmadi" }, { status: 400 });
    }

    const mimeType = file.type || (kind === "audio" ? "audio/mpeg" : "image/jpeg");
    const allowed = kind === "audio" ? ALLOWED_AUDIO_TYPES : ALLOWED_IMAGE_TYPES;
    if (!allowed.includes(mimeType)) {
      return NextResponse.json(
        {
          error:
            kind === "audio"
              ? "Qo'llab-quvvatlanmaydigan audio format. MP3, M4A, WAV yoki OGG yuklang."
              : "Qo'llab-quvvatlanmaydigan rasm formati. PNG, JPG yoki WEBP yuklang.",
        },
        { status: 415 }
      );
    }

    const limit = kind === "audio" ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
    if (file.size > limit) {
      return NextResponse.json(
        {
          error: `Fayl hajmi ${humanSize(limit)} dan oshmasligi kerak (yuborilgan: ${humanSize(
            file.size
          )}).`,
        },
        { status: 413 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const stored = await storeMedia({
      bytes,
      mimeType,
      kind,
      filename: (file as File).name || null,
      ownerId: session.userId,
    });

    return NextResponse.json({
      url: stored.url,
      secure_url: stored.url,
      public_id: stored.publicId,
      resource_type: kind === "audio" ? "video" : "image",
      bytes: stored.byteSize,
      storage: "database",
    });
  } catch (err: any) {
    if (err?.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Media store upload error:", err);
    return NextResponse.json(
      {
        error:
          "Faylni saqlashda xatolik: " + (err?.message || "noma'lum server xatoligi"),
      },
      { status: 500 }
    );
  }
}
