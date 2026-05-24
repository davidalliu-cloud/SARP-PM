import { NextResponse } from "next/server";
import { ProjectStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function targetMarginFromBudget(budgetAmount: number, estimatedContractValue: number) {
  return estimatedContractValue > 0 ? ((estimatedContractValue - budgetAmount) / estimatedContractValue) * 100 : 0;
}

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      dailyRecords: { include: { productItems: true, labourItems: true, expenseItems: true } },
      invoices: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const body = await request.json();
  const budgetAmount = body.budgetAmount == null ? 0 : Number(body.budgetAmount);
  const estimatedContractValue = body.estimatedContractValue == null ? 0 : Number(body.estimatedContractValue);
  const project = await prisma.project.create({
    data: {
      name: body.name,
      clientName: body.clientName || null,
      startDate: new Date(body.startDate),
      status: (body.status || "NOT_STARTED") as ProjectStatus,
      budgetAmount,
      estimatedContractValue,
      estimatedProfitMargin: targetMarginFromBudget(budgetAmount, estimatedContractValue),
      contractAreaM2: body.contractAreaM2 == null ? 0 : Number(body.contractAreaM2),
    },
  });
  return NextResponse.json(project, { status: 201 });
}
