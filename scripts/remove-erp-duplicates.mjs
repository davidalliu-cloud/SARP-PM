/**
 * Remove FutureERP duplicate daily records, targeted per project.
 *
 * SAFE BY DEFAULT: prints what it WOULD delete (dry run). Nothing is removed
 * unless you pass --confirm.
 *
 * Run against PRODUCTION:
 *   npm run prisma:pg:generate                                             # Postgres client
 *   DATABASE_URL="<prod-url>" node scripts/remove-erp-duplicates.mjs --project=<id>            # dry run
 *   DATABASE_URL="<prod-url>" node scripts/remove-erp-duplicates.mjs --project=<id> --confirm  # delete
 *   npm run prisma:generate                                                # restore local SQLite client
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Per-project cleanup targets, matched by the "Synced from FutureERP INVxxxx" note.
const CLEANUPS = {
  // Durres Marina - 2B01 — 20 confirmed duplicates + 2 reversal-pair lines.
  cmog1cv9t0000rrfjoao9xz84: {
    label: "Durres Marina - 2B01",
    invoices: [
      "INV3496", "INV3448", "INV3413", "INV3370", "INV3004",
      "INV1380", "INV1359", "INV1332",
      "INV1659", "INV1669", "INV1635",
      "INV1507", "INV1486", "INV1485",
      "INV1456", "INV1447",
      "INV1279", "INV1280",
      "INV1251", "INV1252",
      "INV1269", "INV1278",
    ],
  },
  // Durres Marina - 2B02 — FutureERP lines that double-count a labour-bearing entry.
  cmol9v0i90000jy1uc9syc5dh: {
    label: "Durres Marina - 2B02",
    invoices: ["INV1358", "INV1407", "INV1426", "INV1446", "INV1457", "INV1541", "INV1633"],
  },
  // Lana Riverside Residence — remove ALL FutureERP-synced entries.
  cmol7inpn0000jl187308ctm7: {
    label: "Lana Riverside Residence",
    allErp: true,
  },
};

const projectArg = process.argv.find((a) => a.startsWith("--project="));
const projectId = projectArg ? projectArg.split("=")[1] : null;
const confirm = process.argv.includes("--confirm");

async function main() {
  if (!projectId || !CLEANUPS[projectId]) {
    console.log("Pass --project=<id>. Known projects:");
    for (const [id, c] of Object.entries(CLEANUPS)) console.log(`  ${id}  (${c.label})`);
    process.exit(1);
  }
  const { label, invoices, allErp } = CLEANUPS[projectId];
  const targetNotes = allErp ? null : new Set(invoices.map((inv) => `Synced from FutureERP ${inv}`));

  const records = await prisma.dailyRecord.findMany({
    where: { projectId },
    include: { productItems: true, labourItems: true, expenseItems: true },
  });

  const toDelete = allErp
    ? records.filter((r) => (r.notes || "").trim().startsWith("Synced from FutureERP"))
    : records.filter((r) => targetNotes.has((r.notes || "").trim()));

  let removedCost = 0;
  console.log(`Project: ${label} (${projectId})`);
  console.log(
    allErp
      ? `Matched ${toDelete.length} FutureERP-synced records (of ${records.length} total):\n`
      : `Matched ${toDelete.length} of ${invoices.length} target records:\n`,
  );
  for (const r of toDelete.sort((a, b) => a.date - b.date)) {
    const cost = r.productItems.reduce((s, i) => s + i.quantity * i.costPerUnit, 0);
    removedCost += cost;
    console.log(`  ${r.date.toISOString().slice(0, 10)}  €${cost.toFixed(0).padStart(9)}   ${r.notes}`);
  }
  console.log(`\nProduct cost contained in these records: €${removedCost.toFixed(2)}`);

  if (!allErp) {
    const matched = new Set(toDelete.map((r) => (r.notes || "").trim()));
    const missing = [...targetNotes].filter((n) => !matched.has(n));
    if (missing.length) {
      console.log(`\n! ${missing.length} target(s) NOT found (already removed, or note differs) — skipped:`);
      missing.forEach((m) => console.log(`    ${m}`));
    }
    if (toDelete.length > invoices.length) {
      console.log("\nSTOP: more records matched than expected. Review the data before proceeding.");
      process.exit(1);
    }
  }

  if (!confirm) {
    console.log("\nDRY RUN — nothing was deleted. Re-run with --confirm to delete the records above.");
    return;
  }

  console.log("\nDeleting…");
  for (const r of toDelete) {
    await prisma.$transaction([
      prisma.productUsageItem.deleteMany({ where: { dailyRecordId: r.id } }),
      prisma.labourEntryItem.deleteMany({ where: { dailyRecordId: r.id } }),
      prisma.expenseItem.deleteMany({ where: { dailyRecordId: r.id } }),
      prisma.dailyRecord.delete({ where: { id: r.id } }),
    ]);
    console.log(`  deleted  ${r.date.toISOString().slice(0, 10)}  ${r.notes}`);
  }
  console.log(`\nDone. Deleted ${toDelete.length} records.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
