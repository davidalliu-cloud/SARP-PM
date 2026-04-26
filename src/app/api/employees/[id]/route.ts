import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, role, defaultDailyWage } = body

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        name: name?.trim(),
        role: role?.trim() || null,
        defaultDailyWage: defaultDailyWage != null ? Number(defaultDailyWage) : undefined,
      },
    })

    return NextResponse.json({
      ...employee,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.employee.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 })
  }
}
