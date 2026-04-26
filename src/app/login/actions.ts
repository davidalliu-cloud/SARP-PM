"use server";

import { redirect } from "next/navigation";
import { UserRole } from "@prisma/client";
import { createSession, destroySession, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function value(formData: FormData, key: string) {
  const entry = formData.get(key);
  return typeof entry === "string" ? entry.trim() : "";
}

export async function login(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  let user = await prisma.user.findUnique({ where: { email } });

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME?.trim() || "SARP Admin";

  if (adminEmail && adminPassword && email === adminEmail && password === adminPassword) {
    user = await prisma.user.upsert({
      where: { email },
      update: {
        name: adminName,
        passwordHash: hashPassword(password),
        role: UserRole.ADMIN,
        sessions: { deleteMany: {} },
      },
      create: {
        name: adminName,
        email,
        passwordHash: hashPassword(password),
        role: UserRole.ADMIN,
      },
    });
  }

  if (!user || !verifyPassword(password, user.passwordHash)) {
    redirect("/login?error=1");
  }

  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
