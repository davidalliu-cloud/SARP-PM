// Next.js startup hook: runs once when a server instance boots, before it
// serves requests. We use it to apply any additive schema columns the deployed
// code expects (see ensure-schema), so a deploy that adds a column heals the
// production database itself instead of 500-ing until an admin runs db-sync.
//
// Guards: only the Node.js runtime (not edge) and only production — the local
// dev database is SQLite and keeps its schema via `prisma db push`, and the
// statements are Postgres DDL. A failure is logged, not thrown, so a transient
// database hiccup can't stop the server from starting; db-sync is the fallback.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;
  try {
    const { ensureSchema } = await import("@/lib/ensure-schema");
    await ensureSchema();
  } catch (error) {
    console.error("[instrumentation] ensureSchema failed:", error);
  }
}
