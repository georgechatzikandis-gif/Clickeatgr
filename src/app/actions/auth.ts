"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/components/action-form";
import { login, logout } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";
import { clientIpHash } from "@/server/request";

export async function loginAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  const password = String(fd.get("password") ?? "").slice(0, 200);
  const next = String(fd.get("next") ?? "");
  if (!email || !password) return { error: "Συμπληρώστε email και κωδικό." };

  const ip = await clientIpHash();
  const allowed = (await rateLimit(`login:ip:${ip}`, 20, 900)) && (await rateLimit(`login:email:${email}`, 8, 900));
  if (!allowed) return { error: "Πάρα πολλές προσπάθειες. Δοκιμάστε ξανά σε 15 λεπτά." };

  const user = await login(email, password);
  if (!user) return { error: "Λάθος email ή κωδικός." };

  const home = user.role === "admin" ? "/admin" : "/dashboard";
  // Only allow internal redirects that match the user's area.
  const safeNext = next.startsWith(home) && !next.startsWith("//") ? next : home;
  redirect(safeNext);
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
