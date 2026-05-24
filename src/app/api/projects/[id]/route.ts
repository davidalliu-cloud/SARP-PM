import { NextResponse } from "next/server";
import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function targetMarginFromBudget(budgetAmount: number | undefined, estimatedContractValue: number | undefined) {
  return estimatedContractValue && estimatedContractValue > 0 && budgetAmount != null ? ((estimatedContractValue - budgetAmount) / estimatedContractValue) * 100 : undefined;
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      dailyRecords: {
        include: {
          productItems: { include: { product: true } },
          labourItems: { include: { employee: true } },
          expenseItems: true,
        },
      },
      invoices: true,
    },
  });

  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const budgetAmount = body.budgetAmount == null ? undefined : Number(body.budgetAmount);
  const estimatedContractValue = body.estimatedContractValue == null ? undefined : Number(body.estimatedContractValue);
  const project = await prisma.project.update({
    where: { id },
    data: {
      name: body.name,
      clientName: body.clientName ?? null,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      status: body.status as ProjectStatus | undefined,
      budgetAmount,
      estimatedContractValue,
      estimatedProfitMargin: targetMarginFromBudget(budgetAmount, estimatedContractValue),
      contractAreaM2: body.contractAreaM2 == null ? undefined : Number(body.contractAreaM2),
    },
  });
  return NextResponse.json(project);
}
