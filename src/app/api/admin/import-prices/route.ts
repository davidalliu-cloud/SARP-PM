import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importOfferPrices } from "@/lib/offer-prices";

// Admin-only, idempotent apply of the manual supplier-price overrides.
export const maxDuration = 60;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });
  try {
    const result = await importOfferPrices(prisma);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
