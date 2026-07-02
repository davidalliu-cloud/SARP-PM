export const attachmentCategories = [
  "Drawings",
  "Situacione",
  "Offer",
  "Contract",
  "Invoice",
  "Expenses Receipts",
  "Site Photo",
];

export function attachmentCategoryOptions(existingCategories: string[] = []) {
  return Array.from(new Set([...attachmentCategories, ...existingCategories])).filter(Boolean);
}
