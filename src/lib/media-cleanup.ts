import { deleteCloudinaryAsset } from "@/lib/cloudinary";
import { deleteMedia, isDbMediaId } from "@/lib/media-store";

/**
 * Removes an uploaded asset from wherever it lives.
 *
 * public_id conventions:
 *   db_<uuid>      -> row in the media table (default storage)
 *   local_<name>   -> legacy file in public/uploads (dev only, nothing to do)
 *   <cloudinary id>-> Cloudinary asset
 */
export async function deleteStoredAsset(
  publicId: string | null | undefined,
  resourceType: "image" | "video" = "image"
): Promise<boolean> {
  if (!publicId) return false;
  if (isDbMediaId(publicId)) return deleteMedia(publicId);
  if (publicId.startsWith("local_")) return false;
  return deleteCloudinaryAsset(publicId, resourceType);
}
