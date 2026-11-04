import type { PrismaClient } from "@prisma/client";
import labour from "../data/offer-labour.json";

// Mapei "Analisi dei Prezzi" labour times — man-hours to apply 1 m² of each
// product, and the crew size. Used to show an expected-output hint under the
// offer's "Rendimenti" (yield) parameter. Synthetic membranes (Mapeplan) are
// not in the Mapei price list, so they carry no labour time.
export type LabourEntry = { name: string; labourManHoursPerM2: number; labourWorkers: number };

export const offerLabourData = labour as LabourEntry[];

/** Attach the Mapei labour times to Product, matched by name. Idempotent. */
export async function importLabourData(prisma: PrismaClient) {
  const existing = await prisma.product.findMany({ select: { id: true, name: true } });
  const idByName = new Map(existing.map((p) => [p.name, p.id]));
  let updated = 0;
  const missing: string[] = [];
  for (const entry of offerLabourData) {
    const id = idByName.get(entry.name);
    if (!id) {
      missing.push(entry.name);
      continue;
    }
    await prisma.product.update({
      where: { id },
      data: { labourManHoursPerM2: entry.labourManHoursPerM2, labourWorkers: entry.labourWorkers },
    });
    updated += 1;
  }
  return { total: offerLabourData.length, updated, missing: missing.length };
}
