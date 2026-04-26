export type ProjectStatus = 'NOT_STARTED' | 'ACTIVE' | 'ON_HOLD' | 'FINISHED'

export interface Product {
  id: string
  name: string
  unit: string
  defaultCostPerUnit: number
  createdAt: string
  updatedAt: string
}

export interface Employee {
  id: string
  name: string
  role: string | null
  defaultDailyWage: number
  createdAt: string
  updatedAt: string
}

export interface DailyProductUsage {
  id: string
  dailyRecordId: string
  productId: string
  quantity: number
  costPerUnit: number
  totalCost: number
  product: Product
}

export interface DailyLabour {
  id: string
  dailyRecordId: string
  employeeId: string | null
  employeeName: string | null
  externalTeamName: string | null
  ratePerSquareMeter: number | null
  squareMeters: number | null
  dailyWage: number
  employee: Employee | null
}

export interface DailyRecord {
  id: string
  projectId: string
  date: string
  notes: string | null
  createdAt: string
  productUsages: DailyProductUsage[]
  labourEntries: DailyLabour[]
  totalProductCost: number
  totalLabourCost: number
  totalCost: number
}

export interface Invoice {
  id: string
  projectId: string
  invoiceDate: string
  monthCovered: string
  invoiceNumber: string | null
  amount: number
  notes: string | null
  createdAt: string
}

export interface Project {
  id: string
  name: string
  client: string | null
  startDate: string
  status: ProjectStatus
  createdAt: string
  updatedAt: string
}

export interface ProjectWithDetails extends Project {
  dailyRecords: DailyRecord[]
  invoices: Invoice[]
  summary: ProjectSummary
}

export interface ProjectSummary {
  totalProductCost: number
  totalLabourCost: number
  totalCost: number
  totalInvoiced: number
  profit: number
  margin: number
}
