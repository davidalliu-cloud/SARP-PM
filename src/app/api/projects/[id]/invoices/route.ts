import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const invoice = await prisma.invoice.create({
    data: {
      projectId: id,
      invoiceDate: new Date(body.invoiceDate),
      monthCovered: body.monthCovered,
      invoiceNo: body.invoiceNo || null,
      amount: Number(body.amount),
      notes: body.notes || null,
    },
  });
  return NextResponse.json(invoice, { status: 201 });
}
