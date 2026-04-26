import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(
      employees.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, role, defaultDailyWage } = body

    if (!name || defaultDailyWage == null) {
      return NextResponse.json({ error: 'Name and daily wage are required' }, { status: 400 })
    }

    const employee = await prisma.employee.create({
      data: { name: name.trim(), role: role?.trim() || null, defaultDailyWage: Number(defaultDailyWage) },
    })

    return NextResponse.json({
      ...employee,
      createdAt: employee.createdAt.toISOString(),
      updatedAt: employee.updatedAt.toISOString(),
    }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create employee' }, { status: 500 })
  }
}
