import { NextResponse } from "next/server";
import { addDays } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const invoiceDate = new Date(body.invoiceDate);
  const invoice = await prisma.invoice.create({
    data: {
      projectId: id,
      invoiceDate,
      monthCovered: body.monthCovered,
      invoiceNo: body.invoiceNo || null,
      amount: Number(body.amount),
      dueDate: body.dueDate ? new Date(body.dueDate) : addDays(invoiceDate, 30),
      isPaid: Boolean(body.isPaid),
      paidDate: body.isPaid ? (body.paidDate ? new Date(body.paidDate) : new Date()) : null,
      notes: body.notes || null,
    },
  });
  return NextResponse.json(invoice, { status: 201 });
}
