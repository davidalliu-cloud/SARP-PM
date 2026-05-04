import { NextRequest, NextResponse } from 'next/server'
import { addDays } from '@/lib/format'
import { prisma } from '@/lib/prisma'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const invoiceDate = body.invoiceDate ? new Date(body.invoiceDate) : undefined
    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        invoiceDate,
        monthCovered: body.monthCovered,
        invoiceNo: body.invoiceNo || null,
        amount: body.amount == null ? undefined : Number(body.amount),
        dueDate: body.dueDate ? new Date(body.dueDate) : invoiceDate ? addDays(invoiceDate, 30) : undefined,
        isPaid: body.isPaid == null ? undefined : Boolean(body.isPaid),
        paidDate: body.isPaid ? (body.paidDate ? new Date(body.paidDate) : new Date()) : null,
        notes: body.notes || null,
      },
    })
    return NextResponse.json(invoice)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update invoice' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.invoice.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete invoice' }, { status: 500 })
  }
}
