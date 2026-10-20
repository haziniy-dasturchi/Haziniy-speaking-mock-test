import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import {
  generateUploadSignature,
  hasCloudinaryCredentials,
  verifyCloudinaryCredentials,
} from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

/**
 * Returns signed Cloudinary upload credentials when Cloudinary is correctly
 * configured. Otherwise it answers `{ configured: false }` so the browser
 * uploads straight into the application database instead of failing.
 */
export async function POST() {
  try {
    await requireAuth();

    if (!hasCloudinaryCredentials()) {
      return NextResponse.json({
        configured: false,
        reason: "missing_credentials",
      });
    }

    const isValid = await verifyCloudinaryCredentials();
    if (!isValid) {
      return NextResponse.json({
        configured: false,
        reason: "invalid_credentials",
      });
    }

    const signatureData = await generateUploadSignature();
    return NextResponse.json(signatureData);
  } catch (err: any) {
    if (err?.message?.includes("Unauthorized")) {
      return NextResponse.json({ error: "Avtorizatsiyadan o'tilmagan" }, { status: 401 });
    }
    console.error("Signature generation error:", err);
    return NextResponse.json({ configured: false, reason: "signature_error" });
  }
}
