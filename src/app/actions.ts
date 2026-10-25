"use server";

import { OfferStatus, OfferType, ProjectStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, requireUser } from "@/lib/auth";
import { ITEM_KINDS, OFFER_VALIDITY_DAYS } from "@/lib/offer-calc";
import { canEditOffer, nextOfferCode, transitionOffer, type OfferAction } from "@/lib/offers";
import { createOfferTables } from "@/lib/offer-setup";
import { prisma } from "@/lib/prisma";

const MAX_ATTACHMENT_SIZE = 8 * 1024 * 1024;
const DEFAULT_PAYMENT_TERM_DAYS = 30;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function targetMarginFromBudget(budgetAmount: number, estimatedContractValue: number) {
  return estimatedContractValue > 0 ? ((estimatedContractValue - budgetAmount) / estimatedContractValue) * 100 : 0;
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function invoiceDueDate(invoiceDate: Date, formData: FormData) {
  const dueDate = text(formData, "dueDate");
  return dueDate ? new Date(dueDate) : addDays(invoiceDate, DEFAULT_PAYMENT_TERM_DAYS);
}

function dailyRecordLineItems(formData: FormData) {
  const productIds = formData.getAll("productId").map(String);
  const productQuantities = formData.getAll("productQuantity");
  const productCosts = formData.getAll("productCostPerUnit");
  const employeeIds = formData.getAll("employeeId").map(String);
  const employeeNames = formData.getAll("employeeName").map(String);
  const wages = formData.getAll("dailyWage");
  const labourTypes = formData.getAll("labourType").map(String);
  const externalTeamNames = formData.getAll("externalTeamName").map(String);
  const ratePerSquareMeters = formData.getAll("ratePerSquareMeter");
  const squareMeters = formData.getAll("squareMeters");
  const expenseTypeIds = formData.getAll("expenseTypeId").map(String);
  const expenseCategories = formData.getAll("expenseCategory").map(String);
  const expenseDescriptions = formData.getAll("expenseDescription").map(String);
  const expenseAmounts = formData.getAll("expenseAmount");

  return {
    productItems: productIds
      .map((productId, index) => ({
        productId,
        quantity: numberValue(productQuantities[index] ?? null),
        costPerUnit: numberValue(productCosts[index] ?? null),
      }))
      .filter((item) => item.productId && item.quantity > 0),
    labourItems: employeeIds
      .map((employeeId, index) => ({
        employeeId: labourTypes[index] === "external" ? null : employeeId,
        employeeName: labourTypes[index] === "external" ? null : employeeNames[index]?.trim() || null,
        externalTeamName: labourTypes[index] === "external" ? externalTeamNames[index]?.trim() || "External team" : null,
        ratePerSquareMeter: labourTypes[index] === "external" ? numberValue(ratePerSquareMeters[index] ?? null) : null,
        squareMeters: labourTypes[index] === "external" ? numberValue(squareMeters[index] ?? null) : null,
        dailyWage: labourTypes[index] === "external"
          ? numberValue(ratePerSquareMeters[index] ?? null) * numberValue(squareMeters[index] ?? null)
          : numberValue(wages[index] ?? null),
      }))
      .filter((item) => (item.employeeId || item.externalTeamName) && item.dailyWage > 0),
    expenseItems: expenseCategories
      .map((category, index) => ({
        expenseTypeId: expenseTypeIds[index] || null,
        category,
        description: expenseDescriptions[index]?.trim() || null,
        amount: numberValue(expenseAmounts[index] ?? null),
      }))
      .filter((item) => item.category && item.amount > 0),
  };
}

export async function createProject(formData: FormData) {
  await requireUser();

  const budgetAmount = numberValue(formData.get("budgetAmount"));
  const estimatedContractValue = numberValue(formData.get("estimatedContractValue"));

  await prisma.project.create({
    data: {
      name: text(formData, "name"),
      clientName: text(formData, "clientName") || null,
      startDate: new Date(text(formData, "startDate")),
      status: text(formData, "status") as ProjectStatus,
      budgetAmount,
      estimatedContractValue,
      estimatedProfitMargin: targetMarginFromBudget(budgetAmount, estimatedContractValue),
      contractAreaM2: 0,
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/projects");
}

export async function updateProjectBasics(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  const budgetAmount = numberValue(formData.get("budgetAmount"));
  const estimatedContractValue = numberValue(formData.get("estimatedContractValue"));

  await prisma.project.update({
    where: { id },
    data: {
      name: text(formData, "name"),
      clientName: text(formData, "clientName") || null,
      budgetAmount,
      estimatedContractValue,
      estimatedProfitMargin: targetMarginFromBudget(budgetAmount, estimatedContractValue),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath(`/projects/${id}/monthly`);
}

export async function updateProjectStatus(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  const status = text(formData, "status") as ProjectStatus;

  await prisma.project.update({
    where: { id },
    data: { status },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath(`/projects/${id}/monthly`);
}

export async function updateProjectBudget(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  const budgetAmount = numberValue(formData.get("budgetAmount"));
  const estimatedContractValue = numberValue(formData.get("estimatedContractValue"));

  await prisma.project.update({
    where: { id },
    data: {
      budgetAmount,
      estimatedContractValue,
      estimatedProfitMargin: targetMarginFromBudget(budgetAmount, estimatedContractValue),
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  revalidatePath(`/projects/${id}`);
  revalidatePath(`/projects/${id}/monthly`);
}

export async function deleteProject(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  await prisma.project.delete({ where: { id } });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/projects?deleted=1");
}

export async function createProduct(formData: FormData) {
  await requireUser();

  await prisma.product.create({
    data: {
      name: text(formData, "name"),
      unit: text(formData, "unit"),
      defaultCostPerUnit: numberValue(formData.get("defaultCostPerUnit")),
    },
  });

  revalidatePath("/products");
}

export async function updateProduct(formData: FormData) {
  await requireUser();

  await prisma.product.update({
    where: { id: text(formData, "id") },
    data: {
      name: text(formData, "name"),
      unit: text(formData, "unit"),
      defaultCostPerUnit: numberValue(formData.get("defaultCostPerUnit")),
    },
  });

  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/projects");
}

export async function deleteProduct(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  const usageCount = await prisma.productUsageItem.count({ where: { productId: id } });

  if (usageCount > 0) {
    redirect("/products?error=product-used");
  }

  await prisma.product.delete({ where: { id } });

  revalidatePath("/products");
  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/products?deleted=1");
}

export async function createEmployee(formData: FormData) {
  await requireUser();

  await prisma.employee.create({
    data: {
      name: text(formData, "name"),
      role: text(formData, "role") || null,
      defaultDailyWage: numberValue(formData.get("defaultDailyWage")),
    },
  });

  revalidatePath("/employees");
}

export async function updateEmployee(formData: FormData) {
  await requireUser();

  await prisma.employee.update({
    where: { id: text(formData, "id") },
    data: {
      name: text(formData, "name"),
      role: text(formData, "role") || null,
      defaultDailyWage: numberValue(formData.get("defaultDailyWage")),
    },
  });

  revalidatePath("/employees");
  revalidatePath("/");
  revalidatePath("/projects");
}

export async function deleteEmployee(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  const employee = await prisma.employee.findUnique({ where: { id } });

  if (employee) {
    await prisma.labourEntryItem.updateMany({
      where: { employeeId: id, employeeName: null },
      data: { employeeName: employee.name },
    });
    await prisma.employee.delete({ where: { id } });
  }

  revalidatePath("/employees");
  revalidatePath("/");
  revalidatePath("/projects");
}

export async function createExpenseType(formData: FormData) {
  await requireUser();

  await prisma.expenseType.create({
    data: {
      name: text(formData, "name"),
      defaultAmount: numberValue(formData.get("defaultAmount")),
      notes: text(formData, "notes") || null,
    },
  });

  revalidatePath("/expenses");
}

export async function createUser(formData: FormData) {
  const currentUser = await requireUser();
  if (currentUser.role !== UserRole.ADMIN) {
    throw new Error("Only admins can create users.");
  }

  await prisma.user.create({
    data: {
      name: text(formData, "name"),
      email: text(formData, "email").toLowerCase(),
      passwordHash: hashPassword(text(formData, "password")),
      role: text(formData, "role") as UserRole,
    },
  });

  revalidatePath("/users");
}

export async function updateUserPassword(formData: FormData) {
  const currentUser = await requireUser();
  if (currentUser.role !== UserRole.ADMIN) {
    throw new Error("Only admins can update user passwords.");
  }

  const id = text(formData, "id");
  const password = text(formData, "password");

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  await prisma.user.update({
    where: { id },
    data: {
      passwordHash: hashPassword(password),
      sessions: { deleteMany: {} },
    },
  });

  revalidatePath("/users");
}

export async function createDailyRecord(formData: FormData) {
  await requireUser();

  const projectId = text(formData, "projectId");
  const items = dailyRecordLineItems(formData);

  await prisma.dailyRecord.create({
    data: {
      projectId,
      date: new Date(text(formData, "date")),
      completedAreaM2: numberValue(formData.get("completedAreaM2")),
      clientName: text(formData, "clientName") || null,
      notes: text(formData, "notes") || null,
      productItems: { create: items.productItems },
      labourItems: { create: items.labourItems },
      expenseItems: { create: items.expenseItems },
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/monthly`);
  revalidatePath("/");
}

export async function updateDailyRecord(formData: FormData) {
  await requireUser();

  const recordId = text(formData, "recordId");
  const projectId = text(formData, "projectId");
  const items = dailyRecordLineItems(formData);

  await prisma.dailyRecord.update({
    where: { id: recordId },
    data: {
      date: new Date(text(formData, "date")),
      completedAreaM2: numberValue(formData.get("completedAreaM2")),
      clientName: text(formData, "clientName") || null,
      notes: text(formData, "notes") || null,
      productItems: {
        deleteMany: {},
        create: items.productItems,
      },
      labourItems: {
        deleteMany: {},
        create: items.labourItems,
      },
      expenseItems: {
        deleteMany: {},
        create: items.expenseItems,
      },
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/monthly`);
  revalidatePath("/");
}

export async function deleteDailyRecord(formData: FormData) {
  await requireUser();

  const recordId = text(formData, "recordId");
  const projectId = text(formData, "projectId");

  await prisma.dailyRecord.delete({ where: { id: recordId } });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/monthly`);
  revalidatePath("/");
}

export async function createInvoice(formData: FormData) {
  await requireUser();

  const projectId = text(formData, "projectId");
  const isPaid = formData.get("isPaid") === "on";
  const paidDate = text(formData, "paidDate");
  const invoiceDate = new Date(text(formData, "invoiceDate"));

  await prisma.invoice.create({
    data: {
      projectId,
      invoiceDate,
      monthCovered: text(formData, "monthCovered"),
      invoiceNo: text(formData, "invoiceNo") || null,
      amount: numberValue(formData.get("amount")),
      dueDate: invoiceDueDate(invoiceDate, formData),
      isPaid,
      paidDate: isPaid ? new Date(paidDate || new Date()) : null,
      clientName: text(formData, "clientName") || null,
      notes: text(formData, "notes") || null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/monthly`);
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function updateInvoice(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  const projectId = text(formData, "projectId");
  const isPaid = formData.get("isPaid") === "on";
  const paidDate = text(formData, "paidDate");
  const invoiceDate = new Date(text(formData, "invoiceDate"));

  await prisma.invoice.update({
    where: { id },
    data: {
      invoiceDate,
      monthCovered: text(formData, "monthCovered"),
      invoiceNo: text(formData, "invoiceNo") || null,
      amount: numberValue(formData.get("amount")),
      dueDate: invoiceDueDate(invoiceDate, formData),
      isPaid,
      paidDate: isPaid ? new Date(paidDate || new Date()) : null,
      clientName: text(formData, "clientName") || null,
      notes: text(formData, "notes") || null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/monthly`);
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function markInvoicePaid(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  const projectId = text(formData, "projectId");
  const paidDate = text(formData, "paidDate");

  await prisma.invoice.update({
    where: { id },
    data: {
      isPaid: true,
      paidDate: paidDate ? new Date(paidDate) : new Date(),
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/monthly`);
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function markInvoiceUnpaid(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  const projectId = text(formData, "projectId");

  await prisma.invoice.update({
    where: { id },
    data: {
      isPaid: false,
      paidDate: null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/monthly`);
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function deleteInvoice(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  const projectId = text(formData, "projectId");

  await prisma.invoice.delete({ where: { id } });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/monthly`);
  revalidatePath("/invoices");
  revalidatePath("/");
}

export async function createAttachment(formData: FormData) {
  await requireUser();

  const projectId = text(formData, "projectId");
  const dailyRecordId = text(formData, "dailyRecordId") || null;
  const invoiceId = text(formData, "invoiceId") || null;
  const category = text(formData, "category") || "Other";
  const label = text(formData, "label") || null;
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Select a file to upload.");
  }

  if (file.size > MAX_ATTACHMENT_SIZE) {
    throw new Error("Attachment is too large. Maximum size is 8 MB.");
  }

  await prisma.attachment.create({
    data: {
      projectId,
      dailyRecordId,
      invoiceId,
      category,
      label,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/attachments`);
}

type OfferSectionInput = {
  title: string;
  zone?: string;
  description?: string;
  areaM2?: number | null;
  isOption?: boolean;
  items: {
    kind?: string;
    description: string;
    productName?: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    unitCost?: number;
  }[];
};

function finiteNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// The offer editor posts its sections/items as one JSON field.
function offerSectionsFromForm(formData: FormData) {
  const sections = JSON.parse(text(formData, "sections") || "[]") as OfferSectionInput[];
  return sections
    .map((section, sectionIndex) => ({
      sortOrder: sectionIndex,
      title: String(section.title ?? "").trim() || `Section ${sectionIndex + 1}`,
      zone: String(section.zone ?? "").trim() || null,
      description: String(section.description ?? "").trim() || null,
      areaM2: finiteNumber(section.areaM2) > 0 ? finiteNumber(section.areaM2) : null,
      isOption: Boolean(section.isOption),
      items: {
        create: (section.items ?? [])
          .map((item, itemIndex) => ({
            sortOrder: itemIndex,
            kind: (ITEM_KINDS as readonly string[]).includes(String(item.kind)) ? String(item.kind) : "MATERIAL",
            description: String(item.description ?? "").trim(),
            productName: String(item.productName ?? "").trim() || null,
            unit: String(item.unit ?? "").trim() || "njesi",
            quantity: finiteNumber(item.quantity),
            unitPrice: finiteNumber(item.unitPrice),
            unitCost: finiteNumber(item.unitCost),
          }))
          .filter((item) => item.description || item.productName),
      },
    }));
}

function offerFieldsFromForm(formData: FormData) {
  const issueDate = new Date(text(formData, "issueDate") || new Date());
  const validUntil = text(formData, "validUntil");
  return {
    type: text(formData, "type") === OfferType.PRODUCTS ? OfferType.PRODUCTS : OfferType.WORKS,
    clientName: text(formData, "clientName"),
    projectName: text(formData, "projectName"),
    siteAddress: text(formData, "siteAddress") || null,
    issueDate,
    validUntil: validUntil ? new Date(validUntil) : addDays(issueDate, OFFER_VALIDITY_DAYS),
    currency: text(formData, "currency") === "ALL" ? "ALL" : "EUR",
    exchangeRate: numberValue(formData.get("exchangeRate")) || 100,
    vatRate: numberValue(formData.get("vatRate")),
    discountPct: numberValue(formData.get("discountPct")),
    paymentTerms: text(formData, "paymentTerms") || null,
    executionTerms: text(formData, "executionTerms") || null,
    warrantyTerms: text(formData, "warrantyTerms") || null,
    exclusions: text(formData, "exclusions") || null,
    internalNotes: text(formData, "internalNotes") || null,
  };
}

export async function setupOfferTables() {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) throw new Error("Only admins can set up offers.");

  await createOfferTables();

  revalidateOffers();
}

function revalidateOffers(id?: string) {
  revalidatePath("/offers");
  if (id) revalidatePath(`/offers/${id}`);
  revalidatePath("/", "layout");
}

export async function createOffer(formData: FormData) {
  const user = await requireUser();

  const fields = offerFieldsFromForm(formData);
  if (!fields.clientName || !fields.projectName) throw new Error("Client and project name are required.");

  const offer = await prisma.offer.create({
    data: {
      ...fields,
      code: await nextOfferCode(fields.issueDate),
      createdById: user.id,
      sections: { create: offerSectionsFromForm(formData) },
      events: { create: { userId: user.id, action: "Created" } },
    },
  });

  revalidateOffers(offer.id);
  redirect(`/offers/${offer.id}`);
}

export async function updateOffer(formData: FormData) {
  const user = await requireUser();

  const id = text(formData, "id");
  const existing = await prisma.offer.findUnique({ where: { id } });
  if (!existing) throw new Error("Offer not found.");
  if (!canEditOffer(user, existing)) throw new Error("This offer can no longer be edited.");

  const fields = offerFieldsFromForm(formData);
  if (!fields.clientName || !fields.projectName) throw new Error("Client and project name are required.");

  await prisma.offer.update({
    where: { id },
    data: {
      ...fields,
      sections: { deleteMany: {}, create: offerSectionsFromForm(formData) },
      events: { create: { userId: user.id, action: "Edited" } },
    },
  });

  revalidateOffers(id);
  redirect(`/offers/${id}`);
}

export async function changeOfferStatus(formData: FormData) {
  const user = await requireUser();

  const id = text(formData, "id");
  const offer = await transitionOffer(user, id, text(formData, "action") as OfferAction, text(formData, "comment") || null);

  revalidateOffers(id);
  if (offer.projectId) {
    revalidatePath("/projects");
    revalidatePath(`/projects/${offer.projectId}`);
  }
}

// Copies an offer into a new draft: used for revisions (V2) and as a template.
export async function duplicateOffer(formData: FormData) {
  const user = await requireUser();

  const source = await prisma.offer.findUnique({
    where: { id: text(formData, "id") },
    include: { sections: { include: { items: true } } },
  });
  if (!source) throw new Error("Offer not found.");

  const issueDate = new Date();
  const copy = await prisma.offer.create({
    data: {
      code: await nextOfferCode(issueDate),
      type: source.type,
      status: OfferStatus.DRAFT,
      clientName: source.clientName,
      projectName: source.projectName,
      siteAddress: source.siteAddress,
      issueDate,
      validUntil: addDays(issueDate, OFFER_VALIDITY_DAYS),
      currency: source.currency,
      exchangeRate: source.exchangeRate,
      vatRate: source.vatRate,
      discountPct: source.discountPct,
      paymentTerms: source.paymentTerms,
      executionTerms: source.executionTerms,
      warrantyTerms: source.warrantyTerms,
      exclusions: source.exclusions,
      internalNotes: source.internalNotes,
      createdById: user.id,
      sections: {
        create: source.sections.map(({ sortOrder, title, zone, description, areaM2, isOption, items }) => ({
          sortOrder,
          title,
          zone,
          description,
          areaM2,
          isOption,
          items: {
            create: items.map(({ sortOrder, kind, description, productName, unit, quantity, unitPrice, unitCost }) => ({
              sortOrder, kind, description, productName, unit, quantity, unitPrice, unitCost,
            })),
          },
        })),
      },
      events: { create: { userId: user.id, action: `Copied from ${source.code}` } },
    },
  });

  revalidateOffers(copy.id);
  redirect(`/offers/${copy.id}/edit`);
}

export async function deleteOffer(formData: FormData) {
  const user = await requireUser();

  const id = text(formData, "id");
  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) throw new Error("Offer not found.");
  const ownDraft = offer.status === OfferStatus.DRAFT && offer.createdById === user.id;
  if (!ownDraft && user.role !== UserRole.ADMIN) throw new Error("Only admins can delete this offer.");

  await prisma.offer.delete({ where: { id } });

  revalidateOffers();
  redirect("/offers");
}

export async function deleteAttachment(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  const projectId = text(formData, "projectId");

  await prisma.attachment.delete({ where: { id } });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/attachments`);
}
