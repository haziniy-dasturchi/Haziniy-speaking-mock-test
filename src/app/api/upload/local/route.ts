import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { promises as fs } from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    await requireAuth();

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const resourceType = (formData.get("resourceType") as string) || "image";

    if (!file) {
      return NextResponse.json({ error: "Fayl yuborilmadi" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save locally into public/uploads
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    const ext = path.extname(file.name) || (resourceType === "video" ? ".mp3" : ".jpg");
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${ext}`;
    const filePath = path.join(uploadDir, uniqueName);

    await fs.writeFile(filePath, buffer);

    const publicUrl = `/uploads/${uniqueName}`;

    return NextResponse.json({
      url: publicUrl,
      secure_url: publicUrl,
      public_id: `local_${uniqueName}`,
      resource_type: resourceType,
    });
  } catch (err: any) {
    console.error("Local upload error:", err);
    return NextResponse.json(
      { error: "Faylni mahalliy saqlashda xatolik: " + (err.message || "") },
      { status: 500 }
    );
  }
}
