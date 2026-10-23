import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import * as s from "@/db/schema";
import { ImageError, storeImage, stripJpegMetadata } from "@/server/images";
import { resetDb } from "./fixtures";

/** Minimal JPEG: SOI, APP1 (fake EXIF with "GPS"), SOF0 (40×30), SOS, data, EOI. */
function fakeJpeg(): Uint8Array {
  const app1Payload = [...Buffer.from("Exif\0\0GPS-LOCATION")];
  const app1 = [0xff, 0xe1, 0x00, app1Payload.length + 2, ...app1Payload];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 30, 0x00, 40, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const sos = [0xff, 0xda, 0x00, 0x0c, 0x03, 1, 0, 2, 0x11, 3, 0x11, 0x00, 0x3f, 0x00];
  return new Uint8Array([0xff, 0xd8, ...app1, ...sof, ...sos, 0x12, 0x34, 0xff, 0xd9]);
}

describe("images", () => {
  beforeEach(resetDb);

  it("strips EXIF (incl. GPS) from JPEGs and keeps the rest", () => {
    const original = fakeJpeg();
    const stripped = stripJpegMetadata(original);
    expect(Buffer.from(original).includes("GPS-LOCATION")).toBe(true);
    expect(Buffer.from(stripped).includes("GPS-LOCATION")).toBe(false);
    expect([...stripped.slice(-4)]).toEqual([0x12, 0x34, 0xff, 0xd9]);
  });

  it("stores a valid image with its dimensions, without metadata", async () => {
    const id = await storeImage(new File([Buffer.from(fakeJpeg())], "photo.jpg", { type: "image/jpeg" }), null);
    const [row] = await db.select().from(s.images).where(eq(s.images.id, id));
    expect(row).toMatchObject({ mimeType: "image/jpeg", width: 40, height: 30 });
    expect(row.data.includes("GPS-LOCATION")).toBe(false);
  });

  it("rejects files that are not images, even if they claim to be", async () => {
    await expect(storeImage(new File(["<script>alert(1)</script>"], "x.jpg", { type: "image/jpeg" }), null)).rejects.toThrow(ImageError);
    await expect(storeImage(new File(["GIF89a......"], "x.gif", { type: "image/gif" }), null)).rejects.toThrow(ImageError);
  });
});
