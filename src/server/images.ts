import "server-only";
import sharp, { type OutputInfo } from "sharp";
import { db } from "@/db";
import { images } from "@/db/schema";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif"]);

export class ImageError extends Error {}

/**
 * Validates, strips metadata (incl. GPS), resizes to max 1200px and stores as WebP.
 * Decoding with sharp also rejects files that only pretend to be images.
 */
export async function storeImage(file: File, businessId: string | null): Promise<string> {
  if (!file || file.size === 0) throw new ImageError("Δεν επιλέχθηκε αρχείο.");
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageError("Η εικόνα είναι πολύ μεγάλη (μέγιστο 8 MB).");
  if (file.type && !ALLOWED.has(file.type)) throw new ImageError("Υποστηρίζονται μόνο εικόνες JPG, PNG, WebP.");
  let out: { data: Buffer; info: OutputInfo };
  try {
    out = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 50_000_000 })
      .rotate()
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new ImageError("Το αρχείο δεν είναι έγκυρη εικόνα.");
  }
  const [row] = await db
    .insert(images)
    .values({
      businessId,
      mimeType: "image/webp",
      data: out.data,
      width: out.info.width,
      height: out.info.height,
      bytes: out.info.size,
    })
    .returning({ id: images.id });
  return row.id;
}
