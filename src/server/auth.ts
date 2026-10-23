import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/db";
import { businesses, sessions, users } from "@/db/schema";
import { verifyPassword } from "./password";

const COOKIE = "ce_session";
const SESSION_DAYS = 30;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "business";
  businessId: string | null;
  businessName: string | null;
  businessSlug: string | null;
};

export class AuthError extends Error {}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function login(email: string, password: string): Promise<SessionUser | null> {
  const [u] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
    .limit(1);
  // Always run a hash comparison so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(
    password,
    u?.passwordHash ?? "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  );
  if (!u || !ok || !u.active) return null;

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId: u.id, expiresAt });
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, u.id));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return (await getCurrentUserUncached(token))!;
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  jar.delete(COOKIE);
}

async function getCurrentUserUncached(token: string | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      businessId: users.businessId,
      businessName: businesses.name,
      businessSlug: businesses.slug,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .leftJoin(businesses, eq(businesses.id, users.businessId))
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date()), eq(users.active, true)))
    .limit(1);
  return row ?? null;
}

/** Current logged-in staff user (memoised per request). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  return getCurrentUserUncached(token);
});

// --- Guards. Use the *Page variants in pages (redirect) and the plain ones in server actions (throw).

export async function requireAdmin(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u || u.role !== "admin") throw new AuthError("Δεν έχετε δικαίωμα πρόσβασης.");
  return u;
}

export async function requireBusinessUser(): Promise<SessionUser & { businessId: string }> {
  const u = await getCurrentUser();
  if (!u || u.role !== "business" || !u.businessId) throw new AuthError("Δεν έχετε δικαίωμα πρόσβασης.");
  return u as SessionUser & { businessId: string };
}

export async function requireAdminPage(): Promise<SessionUser> {
  const u = await getCurrentUser();
  if (!u) redirect("/login?next=/admin");
  if (u.role !== "admin") redirect("/dashboard");
  return u;
}

export async function requireBusinessPage(): Promise<SessionUser & { businessId: string }> {
  const u = await getCurrentUser();
  if (!u) redirect("/login?next=/dashboard");
  if (u.role !== "business" || !u.businessId) redirect("/admin");
  return u as SessionUser & { businessId: string };
}
