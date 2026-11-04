import type { PrismaClient } from "@prisma/client";
import tech from "../data/offer-tech.json";

// Albanian technical descriptions for the products used in the waterproofing
// systems, sourced from Mapei/Polyglass TDS. Attached to products by name and
// assembled into an offer's "Karakteristikat Teknike" block on demand.
export type TechEntry = { name: string; techDescription: string; techSource: string | null };

export const offerTechData = tech as TechEntry[];

/** Attach the technical descriptions to Product, matched by name. Idempotent. */
export async function importTechDescriptions(prisma: PrismaClient) {
  const existing = await prisma.product.findMany({ select: { id: true, name: true } });
  const idByName = new Map(existing.map((p) => [p.name, p.id]));
  let updated = 0;
  const missing: string[] = [];
  for (const entry of offerTechData) {
    const id = idByName.get(entry.name);
    if (!id) {
      missing.push(entry.name);
      continue;
    }
    await prisma.product.update({
      where: { id },
      data: { techDescription: entry.techDescription, techSource: entry.techSource ?? null },
    });
    updated += 1;
  }
  return { total: offerTechData.length, updated, missing };
}
