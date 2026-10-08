import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { generateUploadSignature } from "@/lib/cloudinary";

export async function POST() {
  try {
    await requireAuth();
    const signatureData = await generateUploadSignature();
    return NextResponse.json(signatureData);
  } catch (err: any) {
    if (err.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Signature generation error:", err);
    return NextResponse.json(
      { error: "Yuklash imzosini yaratishda xatolik yuz berdi" },
      { status: 500 }
    );
  }
}
