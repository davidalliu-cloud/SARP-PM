import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { importOfferCatalogue } from "@/lib/offer-catalogue";

// Admin-only, idempotent import of the waterproofing product catalogue into
// Product (consumption/TDS + supplier price), applied through the app's own DB
// connection since Vercel builds can't reach Prisma Postgres. Resumable in
// chunks so a single request never exceeds the function time limit: call it,
// then open the returned `nextUrl` until `done` is true.
export const maxDuration = 60;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.role !== "ADMIN") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const url = new URL(request.url);
  const start = Number(url.searchParams.get("start") ?? "0");
  const count = Number(url.searchParams.get("count") ?? "200");

  try {
    const result = await importOfferCatalogue(prisma, {
      start: Number.isFinite(start) ? start : 0,
      count: Number.isFinite(count) ? count : 200,
    });
    const nextUrl =
      result.nextStart != null
        ? `${url.origin}/api/admin/import-catalogue?start=${result.nextStart}&count=${Number.isFinite(count) ? count : 200}`
        : null;
    return NextResponse.json({ ok: true, done: result.nextStart == null, ...result, nextUrl });
  } catch (error) {
    return NextResponse.json({ ok: false, error: String(error) }, { status: 500 });
  }
}
