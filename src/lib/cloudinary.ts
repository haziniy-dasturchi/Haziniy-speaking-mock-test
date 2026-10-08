// Cloudinary signed upload and deletion utilities
// Uses Web Crypto API (SHA-1) to work seamlessly across Node.js and Cloudflare Workers

async function sha1Hex(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-1", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface UploadSignatureResponse {
  timestamp: number;
  signature: string;
  apiKey: string;
  cloudName: string;
  folder: string;
}

export async function generateUploadSignature(
  folder = "haziniy_speaking_mock"
): Promise<UploadSignatureResponse> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
  const apiKey = process.env.CLOUDINARY_API_KEY || "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET || "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary environment variables are missing");
  }

  const timestamp = Math.round(new Date().getTime() / 1000);

  // Cloudinary signature parameters must be sorted alphabetically:
  // "folder=haziniy_speaking_mock&timestamp=1234567890" + apiSecret
  const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = await sha1Hex(paramsToSign);

  return {
    timestamp,
    signature,
    apiKey,
    cloudName,
    folder,
  };
}

export async function deleteCloudinaryAsset(
  publicId: string,
  resourceType: "image" | "video" = "image"
): Promise<boolean> {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
    const apiKey = process.env.CLOUDINARY_API_KEY || "";
    const apiSecret = process.env.CLOUDINARY_API_SECRET || "";

    if (!cloudName || !apiKey || !apiSecret || !publicId) {
      return false;
    }

    const timestamp = Math.round(new Date().getTime() / 1000);
    // Sort parameters alphabetically: public_id, timestamp
    const paramsToSign = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = await sha1Hex(paramsToSign);

    const formData = new FormData();
    formData.append("public_id", publicId);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp.toString());
    formData.append("signature", signature);

    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`;
    const res = await fetch(url, {
      method: "POST",
      body: formData,
    });

    const data = await res.json();
    return data.result === "ok";
  } catch (err) {
    console.error("Cloudinary asset deletion error:", err);
    return false;
  }
}
