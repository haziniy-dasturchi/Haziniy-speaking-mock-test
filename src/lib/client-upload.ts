export interface UploadResult {
  url: string;
  secure_url: string;
  public_id: string;
  resource_type: string;
  duration?: number;
}

export interface UploadProgressCallback {
  (percentage: number): void;
}

async function uploadToLocal(
  file: File,
  resourceType: "image" | "video",
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("resourceType", resourceType);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload/local");

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Mahalliy server javobini o'qishda xatolik"));
        }
      } else {
        reject(new Error(`Mahalliy yuklashda xatolik: HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Tarmoqda xatolik"));
    xhr.send(formData);
  });
}

export async function uploadMediaToCloudinary(
  file: File,
  resourceType: "image" | "video",
  onProgress?: UploadProgressCallback
): Promise<UploadResult> {
  // Validate file constraints
  if (resourceType === "video") {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Audio fayl hajmi 10 MB dan oshmasligi kerak");
    }
  } else {
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Rasm fayl hajmi 10 MB dan oshmasligi kerak");
    }
  }

  // 1. Get signed credentials from server
  try {
    const signRes = await fetch("/api/upload/sign", { method: "POST" });
    if (!signRes.ok) {
      // If sign route fails (e.g. no Cloudinary keys), fallback to local upload
      return await uploadToLocal(file, resourceType, onProgress);
    }

    const { timestamp, signature, apiKey, cloudName, folder } = await signRes.json();

    // If placeholder credentials in .env, fallback to local upload
    if (apiKey === "123456789012345" || cloudName === "haziniy" || !apiKey) {
      return await uploadToLocal(file, resourceType, onProgress);
    }

    // 2. Prepare FormData for Cloudinary
    const formData = new FormData();
    formData.append("file", file);
    formData.append("api_key", apiKey);
    formData.append("timestamp", timestamp.toString());
    formData.append("signature", signature);
    formData.append("folder", folder);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

    return await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", uploadUrl);

      if (xhr.upload && onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
      }

      xhr.onload = async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve({
              url: response.secure_url || response.url,
              secure_url: response.secure_url || response.url,
              public_id: response.public_id,
              resource_type: response.resource_type,
              duration: response.duration,
            });
          } catch {
            reject(new Error("Cloudinary javobini o'qishda xatolik"));
          }
        } else {
          // Cloudinary returned error -> seamless fallback to local storage!
          console.warn("Cloudinary upload failed, using local storage fallback...");
          try {
            const localRes = await uploadToLocal(file, resourceType, onProgress);
            resolve(localRes);
          } catch (localErr: any) {
            reject(localErr);
          }
        }
      };

      xhr.onerror = async () => {
        try {
          const localRes = await uploadToLocal(file, resourceType, onProgress);
          resolve(localRes);
        } catch (localErr: any) {
          reject(localErr);
        }
      };

      xhr.send(formData);
    });
  } catch (err) {
    return await uploadToLocal(file, resourceType, onProgress);
  }
}
