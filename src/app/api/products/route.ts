import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const products = await prisma.product.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(
      products.map((p) => ({
        ...p,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }))
    )
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, unit, defaultCostPerUnit } = body

    if (!name || !unit || defaultCostPerUnit == null) {
      return NextResponse.json({ error: 'Name, unit and cost per unit are required' }, { status: 400 })
    }

    const product = await prisma.product.create({
      data: { name: name.trim(), unit: unit.trim(), defaultCostPerUnit: Number(defaultCostPerUnit) },
    })

    return NextResponse.json({
      ...product,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    }, { status: 201 })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 })
  }
}
