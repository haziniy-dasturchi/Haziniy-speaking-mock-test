export interface UploadResult {
  url: string;
  secure_url: string;
  public_id: string;
  resource_type: string;
  duration?: number;
  storage?: string;
}

export interface UploadProgressCallback {
  (percentage: number): void;
}

/** Hard limits accepted by the server (see src/lib/media-store.ts). */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_AUDIO_BYTES = 8 * 1024 * 1024;

/** Projector-friendly resolution: anything larger is pointless on a 1920x1080 screen. */
const MAX_IMAGE_DIMENSION = 1600;
const TARGET_IMAGE_BYTES = 900 * 1024;

function readableSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImageBitmap(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Rasmni o'qib bo'lmadi"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

/**
 * Shrinks a photo in the browser before upload: at most 1600px on the long
 * edge and roughly under 900 KB. Teachers usually upload 5-10 MB phone photos,
 * which would otherwise be rejected and slow the exam preload down.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;
  if (typeof document === "undefined") return file;

  try {
    const img = await loadImageBitmap(file);
    const scale = Math.min(
      1,
      MAX_IMAGE_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight)
    );

    const alreadySmallEnough = scale === 1 && file.size <= TARGET_IMAGE_BYTES;
    if (alreadySmallEnough) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    let blob: Blob | null = null;
    for (const quality of [0.86, 0.75, 0.62]) {
      blob = await canvasToBlob(canvas, quality);
      if (blob && blob.size <= TARGET_IMAGE_BYTES) break;
    }

    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
  } catch {
    // Compression is an optimisation only — fall back to the original file.
    return file;
  }
}

function xhrUpload(
  url: string,
  body: FormData,
  onProgress?: UploadProgressCallback
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => resolve({ status: xhr.status, text: xhr.responseText });
    xhr.onerror = () => reject(new Error("Tarmoq bilan bog'lanishda xatolik"));
    xhr.ontimeout = () => reject(new Error("Yuklash vaqti tugadi, qayta urinib ko'ring"));
    xhr.send(body);
  });
}

/** Stores the file inside the application database (always available). */
async function uploadToDatabase(
  file: File,
  resourceType: "image" | "video",
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("resourceType", resourceType);

  const { status, text } = await xhrUpload("/api/upload/store", formData, onProgress);

  let payload: any = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = null;
  }

  if (status < 200 || status >= 300) {
    throw new Error(
      payload?.error || `Faylni saqlab bo'lmadi (HTTP ${status}). Qayta urinib ko'ring.`
    );
  }

  return payload as UploadResult;
}

async function uploadToCloudinary(
  file: File,
  resourceType: "image" | "video",
  credentials: {
    timestamp: number;
    signature: string;
    apiKey: string;
    cloudName: string;
    folder: string;
  },
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", credentials.apiKey);
  formData.append("timestamp", credentials.timestamp.toString());
  formData.append("signature", credentials.signature);
  formData.append("folder", credentials.folder);

  const uploadUrl = `https://api.cloudinary.com/v1_1/${credentials.cloudName}/${resourceType}/upload`;
  const { status, text } = await xhrUpload(uploadUrl, formData, onProgress);

  if (status < 200 || status >= 300) {
    throw new Error(`Cloudinary HTTP ${status}`);
  }

  const response = JSON.parse(text);
  return {
    url: response.secure_url || response.url,
    secure_url: response.secure_url || response.url,
    public_id: response.public_id,
    resource_type: response.resource_type,
    duration: response.duration,
    storage: "cloudinary",
  };
}

/**
 * Uploads one file and returns its permanent URL.
 *
 * Order of attempts:
 *   1. Cloudinary (only when the server confirms the credentials are valid)
 *   2. The application database — works on every host, no external account
 */
export async function uploadMedia(
  file: File,
  resourceType: "image" | "video",
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  let payload = file;

  if (resourceType === "image") {
    payload = await compressImage(file);
    if (payload.size > MAX_IMAGE_BYTES) {
      throw new Error(
        `Rasm hajmi juda katta (${readableSize(payload.size)}). ${readableSize(
          MAX_IMAGE_BYTES
        )} gacha bo'lgan rasm yuklang.`
      );
    }
  } else if (file.size > MAX_AUDIO_BYTES) {
    throw new Error(
      `Audio hajmi juda katta (${readableSize(file.size)}). ${readableSize(
        MAX_AUDIO_BYTES
      )} gacha bo'lgan fayl yuklang.`
    );
  }

  let credentials: any = null;
  try {
    const signRes = await fetch("/api/upload/sign", { method: "POST" });
    if (signRes.ok) {
      const data = await signRes.json();
      if (data?.configured) credentials = data;
    }
  } catch {
    credentials = null;
  }

  if (credentials) {
    try {
      return await uploadToCloudinary(payload, resourceType, credentials, onProgress);
    } catch (err) {
      console.warn("Cloudinary upload failed, storing in database instead:", err);
      onProgress?.(0);
    }
  }

  return uploadToDatabase(payload, resourceType, onProgress);
}
