import { eq } from "drizzle-orm";
import { db } from "@/db";
import { images } from "@/db/schema";

// Images are immutable: a new upload always gets a new id, so they can be cached forever.
export async function GET(_req: Request, ctx: RouteContext<"/img/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("Not found", { status: 404 });
  const [img] = await db
    .select({ data: images.data, mimeType: images.mimeType })
    .from(images)
    .where(eq(images.id, id))
    .limit(1);
  if (!img) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(img.data), {
    headers: {
      "Content-Type": img.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
