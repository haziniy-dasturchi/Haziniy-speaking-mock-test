import { readMedia } from "@/lib/media-store";

export const runtime = "nodejs";

/**
 * Serves an uploaded file stored in the database.
 * Media rows are immutable, so the response can be cached aggressively —
 * the exam player preloads every asset before the test starts.
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await props.params;
    const asset = await readMedia(id);

    if (!asset) {
      return new Response("Not found", { status: 404 });
    }

    return new Response(asset.bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.bytes.length),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "none",
      },
    });
  } catch (err) {
    console.error("Media read error:", err);
    return new Response("Media could not be loaded", { status: 500 });
  }
}
