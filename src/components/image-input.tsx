"use client";

import { useState } from "react";

const MAX_SIDE = 1600;

/**
 * File input that shrinks photos in the browser (max 1600px JPEG) before upload, so large
 * phone photos upload quickly and stay under hosting request limits.
 */
export function ImageInput({ name = "image", label = "Εικόνα" }: { name?: string; label?: string }) {
  const [status, setStatus] = useState<string | null>(null);

  const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const f = input.files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    try {
      setStatus("Προετοιμασία εικόνας…");
      const bitmap = await createImageBitmap(f);
      const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.85));
      if (blob) {
        const dt = new DataTransfer();
        dt.items.add(new File([blob], f.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" }));
        input.files = dt.files;
      }
      setStatus(`Έτοιμη (${Math.round((blob?.size ?? f.size) / 1024)} KB)`);
    } catch {
      // Browser couldn't decode it (e.g. HEIC on some devices): upload the original, the server will try.
      setStatus(null);
    }
  };

  return (
    <div>
      <label className="label" htmlFor={`f-${name}`}>{label}</label>
      <input id={`f-${name}`} name={name} type="file" accept="image/*" onChange={onChange} className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold" />
      {status && <p className="mt-1 text-xs text-ink-soft">{status}</p>}
    </div>
  );
}
