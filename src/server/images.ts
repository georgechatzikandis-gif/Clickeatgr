import "server-only";
import { imageSize } from "image-size";
import { db } from "@/db";
import { images } from "@/db/schema";

// Phones shrink photos in the browser (see components/image-input.tsx) before upload, so the server
// only validates and stores. No native image library is used, so this also runs on Cloudflare Workers.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MAX_SIDE = 4000;
const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

export class ImageError extends Error {}

/** Removes EXIF/XMP blocks (APP1, which can hold GPS location) from a JPEG. */
export function stripJpegMetadata(buf: Uint8Array): Uint8Array {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return buf;
  const out: Uint8Array[] = [buf.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= buf.length && buf[i] === 0xff) {
    const marker = buf[i + 1];
    if (marker === 0xda) break; // start of image data: copy the rest unchanged
    const len = (buf[i + 2] << 8) | buf[i + 3];
    if (len < 2 || i + 2 + len > buf.length) return buf; // malformed: keep original
    if (marker !== 0xe1) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  out.push(buf.subarray(i));
  const result = new Uint8Array(out.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of out) {
    result.set(p, o);
    o += p.length;
  }
  return result;
}

/** Validates that the upload really is a JPEG/PNG/WebP of sensible size and stores it. */
export async function storeImage(file: File, businessId: string | null): Promise<string> {
  if (!file || file.size === 0) throw new ImageError("Δεν επιλέχθηκε αρχείο.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageError("Η εικόνα είναι πολύ μεγάλη (μέγιστο 4 MB).");
  let bytes: Uint8Array = new Uint8Array(await file.arrayBuffer());
  let info: { type?: string; width?: number; height?: number };
  try {
    info = imageSize(bytes);
  } catch {
    throw new ImageError("Το αρχείο δεν είναι έγκυρη εικόνα.");
  }
  const mimeType = info.type ? TYPES[info.type] : undefined;
  if (!mimeType || !info.width || !info.height) throw new ImageError("Υποστηρίζονται μόνο εικόνες JPG, PNG, WebP.");
  if (info.width > MAX_SIDE || info.height > MAX_SIDE) throw new ImageError("Η εικόνα έχει πολύ μεγάλες διαστάσεις.");
  if (mimeType === "image/jpeg") bytes = stripJpegMetadata(bytes);

  const [row] = await db
    .insert(images)
    .values({
      businessId,
      mimeType,
      data: Buffer.from(bytes),
      width: info.width,
      height: info.height,
      bytes: bytes.length,
    })
    .returning({ id: images.id });
  return row.id;
}
