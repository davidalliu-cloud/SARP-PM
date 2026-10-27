import { PrismaClient } from "@prisma/client";
import { importOfferCatalogue } from "../src/lib/offer-catalogue";

// Local runner: `tsx prisma/import-catalogue.ts` against the active DATABASE_URL.
const prisma = new PrismaClient();

async function main() {
  const result = await importOfferCatalogue(prisma);
  console.log("Catalogue import:", result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
