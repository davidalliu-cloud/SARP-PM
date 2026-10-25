import { prisma } from "@/lib/prisma";

// One-time creation of the offer tables on the hosted Postgres database.
// Vercel builds can't reach the database directly (see vercel-build), so an
// admin applies this from the Offers page through the app's own connection.
// Generated with `prisma migrate diff` from the previous schema; additive only.
const OFFER_TABLES_SQL = [
  `CREATE TYPE "OfferType" AS ENUM ('WORKS', 'PRODUCTS')`,
  `CREATE TYPE "OfferStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'READY', 'SENT', 'WON', 'LOST', 'CANCELLED')`,
  `CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OfferType" NOT NULL DEFAULT 'WORKS',
    "status" "OfferStatus" NOT NULL DEFAULT 'DRAFT',
    "clientName" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "siteAddress" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "exchangeRate" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "discountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "executionTerms" TEXT,
    "warrantyTerms" TEXT,
    "exclusions" TEXT,
    "internalNotes" TEXT,
    "reviewComment" TEXT,
    "lostReason" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "projectId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE "OfferSection" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "title" TEXT NOT NULL,
    "zone" TEXT,
    "description" TEXT,
    "areaM2" DOUBLE PRECISION,
    "isOption" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OfferSection_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE "OfferItem" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "kind" TEXT NOT NULL DEFAULT 'MATERIAL',
    "description" TEXT NOT NULL,
    "productName" TEXT,
    "unit" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    CONSTRAINT "OfferItem_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE TABLE "OfferEvent" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OfferEvent_pkey" PRIMARY KEY ("id")
  )`,
  `CREATE UNIQUE INDEX "Offer_code_key" ON "Offer"("code")`,
  `CREATE UNIQUE INDEX "Offer_projectId_key" ON "Offer"("projectId")`,
  `ALTER TABLE "Offer" ADD CONSTRAINT "Offer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE`,
  `ALTER TABLE "Offer" ADD CONSTRAINT "Offer_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "Offer" ADD CONSTRAINT "Offer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE "OfferSection" ADD CONSTRAINT "OfferSection_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "OfferItem" ADD CONSTRAINT "OfferItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "OfferSection"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "OfferEvent" ADD CONSTRAINT "OfferEvent_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
  `ALTER TABLE "OfferEvent" ADD CONSTRAINT "OfferEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
];

export async function offerTablesExist() {
  try {
    await prisma.offer.count();
    return true;
  } catch {
    return false;
  }
}

// Runs as one transaction: Postgres DDL is transactional, so it either
// creates everything or nothing.
export async function createOfferTables() {
  if (await offerTablesExist()) return;
  await prisma.$transaction(OFFER_TABLES_SQL.map((sql) => prisma.$executeRawUnsafe(sql)));
}
