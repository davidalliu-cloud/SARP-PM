import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const record = await prisma.dailyRecord.create({
    data: {
      projectId: id,
      date: new Date(body.date),
      notes: body.notes || null,
      productItems: {
        create: (body.productItems || []).map((item: { productId: string; quantity: number; costPerUnit: number }) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          costPerUnit: Number(item.costPerUnit),
        })),
      },
      labourItems: {
        create: (body.labourItems || []).map((item: { employeeId?: string; employeeName?: string; externalTeamName?: string; ratePerSquareMeter?: number; squareMeters?: number; dailyWage?: number }) => ({
          employeeId: item.employeeId || null,
          employeeName: item.employeeName || null,
          externalTeamName: item.externalTeamName || null,
          ratePerSquareMeter: item.ratePerSquareMeter == null ? null : Number(item.ratePerSquareMeter),
          squareMeters: item.squareMeters == null ? null : Number(item.squareMeters),
          dailyWage: item.externalTeamName ? Number(item.ratePerSquareMeter || 0) * Number(item.squareMeters || 0) : Number(item.dailyWage || 0),
        })),
      },
      expenseItems: {
        create: (body.expenseItems || []).map((item: { category: string; description?: string; amount: number }) => ({
          category: item.category,
          description: item.description || null,
          amount: Number(item.amount),
        })),
      },
    },
  });
  return NextResponse.json(record, { status: 201 });
}
