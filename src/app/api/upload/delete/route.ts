import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { deleteCloudinaryAsset } from "@/lib/cloudinary";
import { z } from "zod";

const deleteAssetSchema = z.object({
  publicId: z.string().min(1),
  resourceType: z.enum(["image", "video"]).default("image"),
});

export async function POST(request: Request) {
  try {
    await requireAuth();
    const body = await request.json();
    const parsed = deleteAssetSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Noto'g'ri so'rov" }, { status: 400 });
    }

    const { publicId, resourceType } = parsed.data;
    const ok = await deleteCloudinaryAsset(publicId, resourceType);
    return NextResponse.json({ success: ok });
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Asset deletion API error:", err);
    return NextResponse.json({ error: "Faylni o'chirishda xatolik" }, { status: 500 });
  }
}
