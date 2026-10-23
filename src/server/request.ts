import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/** Client IP, hashed with the app secret so raw IPs are never stored. */
export async function clientIpHash(): Promise<string> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  return createHash("sha256")
    .update(`${process.env.APP_SECRET ?? "dev"}:${ip}`)
    .digest("hex")
    .slice(0, 32);
}
