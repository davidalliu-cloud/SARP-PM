"use server";

import { ProjectStatus, UserRole } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hashPassword, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: FormDataEntryValue | null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

  await prisma.project.create({
    data: {
      name: text(formData, "name"),
      clientName: text(formData, "clientName") || null,
      startDate: new Date(text(formData, "startDate")),
      status: text(formData, "status") as ProjectStatus,
    },
  });

  revalidatePath("/");
  revalidatePath("/projects");
  redirect("/projects");
}

export async function updateProjectBasics(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");

  await prisma.project.update({
    where: { id },
    data: {
      name: text(formData, "name"),
      clientName: text(formData, "clientName") || null,
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

  await prisma.invoice.create({
    data: {
      projectId,
      invoiceDate: new Date(text(formData, "invoiceDate")),
      monthCovered: text(formData, "monthCovered"),
      invoiceNo: text(formData, "invoiceNo") || null,
      amount: numberValue(formData.get("amount")),
      notes: text(formData, "notes") || null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/monthly`);
  revalidatePath("/");
}

export async function updateInvoice(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  const projectId = text(formData, "projectId");

  await prisma.invoice.update({
    where: { id },
    data: {
      invoiceDate: new Date(text(formData, "invoiceDate")),
      monthCovered: text(formData, "monthCovered"),
      invoiceNo: text(formData, "invoiceNo") || null,
      amount: numberValue(formData.get("amount")),
      notes: text(formData, "notes") || null,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/monthly`);
  revalidatePath("/");
}

export async function deleteInvoice(formData: FormData) {
  await requireUser();

  const id = text(formData, "id");
  const projectId = text(formData, "projectId");

  await prisma.invoice.delete({ where: { id } });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/monthly`);
  revalidatePath("/");
}
