"use client";

import { useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { deleteDailyRecord, updateDailyRecord } from "@/app/actions";
import { useT } from "@/components/LanguageProvider";
import { formatDate, formatNumber, money } from "@/lib/format";

// Temporary review aid: FutureERP-synced records flagged as duplicates
// (20 confirmed duplicates + 2 reversal-pair lines) are shown in red so they
// are easy to spot. Remove once the cleanup is done.
const DUPLICATE_ERP_NOTES = new Set(
  [
    "INV3496", "INV3448", "INV3413", "INV3370", "INV3004",
    "INV1380", "INV1359", "INV1332",
    "INV1659", "INV1669", "INV1635",
    "INV1507", "INV1486", "INV1485",
    "INV1456", "INV1447",
    "INV1279", "INV1280",
    "INV1251", "INV1252",
    "INV1269", "INV1278",
  ].map((inv) => `Synced from FutureERP ${inv}`),
);

type ProductOption = {
  id: string;
  name: string;
  unit: string;
  defaultCostPerUnit: number;
  lastCostPerUnit?: number | null;
};

type EmployeeOption = {
  id: string;
  name: string;
  role: string | null;
  defaultDailyWage: number;
};

type ExpenseTypeOption = {
  id: string;
  name: string;
  defaultAmount: number;
};

type ProductRow = {
  id: string;
  productId: string;
  productName: string;
  unit: string;
  quantity: number;
  costPerUnit: number;
};

type LabourRow = {
  id: string;
  labourType: "employee" | "external";
  employeeId: string;
  employeeName: string;
  externalTeamName: string;
  ratePerSquareMeter: number;
  squareMeters: number;
  dailyWage: number;
};

type ExpenseRow = {
  id: string;
  expenseTypeId: string;
  category: string;
  description: string;
  amount: number;
};

export type DailyRecordRow = {
  id: string;
  projectId: string;
  date: string;
  completedAreaM2: number;
  clientName: string;
  notes: string;
  productItems: ProductRow[];
  labourItems: LabourRow[];
  expenseItems: ExpenseRow[];
};

function dateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function displayDate(value: string) {
  return formatDate(value);
}

function productTotal(items: ProductRow[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0);
}

function productCost(product?: ProductOption) {
  return product?.lastCostPerUnit ?? product?.defaultCostPerUnit ?? 0;
}

function labourTotal(items: LabourRow[]) {
  return items.reduce((sum, item) => sum + (item.labourType === "external" ? item.ratePerSquareMeter * item.squareMeters : item.dailyWage), 0);
}

function expenseTotal(items: ExpenseRow[]) {
  return items.reduce((sum, item) => sum + item.amount, 0);
}

export function DailyRecordsManager({
  projectId,
  records,
  products,
  employees,
  expenseTypes,
}: {
  projectId: string;
  records: DailyRecordRow[];
  products: ProductOption[];
  employees: EmployeeOption[];
  expenseTypes: ExpenseTypeOption[];
}) {
  const t = useT();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecords = useMemo(() => {
    if (!normalizedQuery) return records;
    return records.filter((record) => {
      const searchable = [
        displayDate(record.date),
        record.clientName,
        record.notes,
        ...record.productItems.map((item) => `${item.productName} ${item.quantity} ${item.unit}`),
        ...record.labourItems.map((item) => item.labourType === "external" ? `${item.externalTeamName} ${item.squareMeters}` : item.employeeName),
        ...record.expenseItems.map((item) => `${item.category} ${item.description}`),
      ].join(" ").toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [records, normalizedQuery]);

  if (!records.length) {
    return (
      <div className="rounded-lg border border-dashed border-[#c5cdd6] bg-[#f1f3f5] p-4 text-sm font-bold text-muted">
        {t("pd.daily.emptyNone")}
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <label>
        {t("pd.daily.searchLabel")}
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("pd.daily.searchPlaceholder")} />
      </label>
      <div className="text-xs font-bold text-muted">{t("pd.daily.showing", { shown: filteredRecords.length, total: records.length })}</div>
      <div className="grid gap-3">
        {filteredRecords.map((record) => {
          const productCost = productTotal(record.productItems);
          const labourCost = labourTotal(record.labourItems);
          const expenses = expenseTotal(record.expenseItems);
          const total = productCost + labourCost + expenses;
          const isEditing = editingId === record.id;
          const isDuplicate = DUPLICATE_ERP_NOTES.has((record.notes || "").trim());

          const productsText = record.productItems.map((item) => `${item.productName} (${item.quantity} ${item.unit})`).join(", ");
          const labourText = record.labourItems.map((item) => item.labourType === "external" ? `${item.externalTeamName} (${item.squareMeters} m2)` : item.employeeName).join(", ");
          const expensesText = record.expenseItems.map((item) => `${item.category}${item.description ? `: ${item.description}` : ""}`).join(", ");

          return (
            <div
              key={record.id}
              className={`rounded-xl border p-4 ${isDuplicate ? "border-[#e7b4ad] bg-[#fdf3f2]" : "border-line bg-white"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className={`text-sm font-bold ${isDuplicate ? "text-[#c0362c]" : "text-ink"}`}>{displayDate(record.date)}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-muted">
                    {record.clientName ? <span>{record.clientName}</span> : null}
                    {record.completedAreaM2 > 0 ? <span>{formatNumber(record.completedAreaM2)} m²</span> : null}
                    {isDuplicate ? <span className="rounded-full bg-[#f6d9d5] px-2 py-0.5 font-bold text-[#c0362c]">{t("pd.daily.possibleDuplicate")}</span> : null}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-bold text-ink">{money(total)}</div>
                    <div className="text-[11px] font-semibold text-muted">
                      {t("pd.daily.costBreakdown", { products: money(productCost), labour: money(labourCost), expenses: money(expenses) })}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button className="btn btn-small btn-edit" type="button" onClick={() => setEditingId(isEditing ? null : record.id)}>
                      {isEditing ? t("common.cancel") : t("common.edit")}
                    </button>
                    <form
                      action={deleteDailyRecord}
                      onSubmit={(event) => {
                        if (!window.confirm(t("pd.daily.confirmDelete", { date: displayDate(record.date) }))) {
                          event.preventDefault();
                        }
                      }}
                    >
                      <input type="hidden" name="recordId" value={record.id} />
                      <input type="hidden" name="projectId" value={projectId} />
                      <button className="btn btn-small btn-delete" type="submit">{t("common.delete")}</button>
                    </form>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{t("pd.daily.products")}</div>
                  <div className="mt-1 break-words text-sm text-ink">{productsText || "—"}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{t("pd.daily.labour")}</div>
                  <div className="mt-1 break-words text-sm text-ink">{labourText || "—"}</div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">{t("pd.daily.expenses")}</div>
                  <div className="mt-1 break-words text-sm text-ink">{expensesText || "—"}</div>
                </div>
              </div>

              {record.notes ? (
                <div className="mt-3 break-words text-sm text-muted">
                  <span className="font-semibold text-ink">{t("pd.daily.notePrefix")}</span>
                  {record.notes}
                </div>
              ) : null}

              {isEditing ? (
                <div className="mt-4 border-t border-line pt-4">
                  <DailyRecordEditForm
                    record={record}
                    products={products}
                    employees={employees}
                    expenseTypes={expenseTypes}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => setEditingId(null)}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
        {!filteredRecords.length ? (
          <div className="rounded-lg border border-dashed border-[#c5cdd6] bg-[#f1f3f5] p-4 text-center text-sm font-bold text-muted">
            {t("pd.daily.noMatch")}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DailyRecordEditForm({
  record,
  products,
  employees,
  expenseTypes,
  onCancel,
  onSaved,
}: {
  record: DailyRecordRow;
  products: ProductOption[];
  employees: EmployeeOption[];
  expenseTypes: ExpenseTypeOption[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [productRows, setProductRows] = useState<ProductRow[]>(
    record.productItems.length ? record.productItems : [{ id: `p-${record.id}`, productId: products[0]?.id ?? "", productName: products[0]?.name ?? "", unit: products[0]?.unit ?? "", quantity: 1, costPerUnit: productCost(products[0]) }]
  );
  const [labourRows, setLabourRows] = useState<LabourRow[]>(
    record.labourItems.length ? record.labourItems : [{ id: `l-${record.id}`, labourType: "employee", employeeId: employees[0]?.id ?? "", employeeName: employees[0]?.name ?? "", externalTeamName: "", ratePerSquareMeter: 0, squareMeters: 0, dailyWage: employees[0]?.defaultDailyWage ?? 0 }]
  );
  const [expenseRows, setExpenseRows] = useState<ExpenseRow[]>(
    record.expenseItems.length ? record.expenseItems : [{ id: `e-${record.id}`, expenseTypeId: expenseTypes[0]?.id ?? "", category: expenseTypes[0]?.name ?? "", description: "", amount: expenseTypes[0]?.defaultAmount ?? 0 }]
  );

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const employeeMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const expenseTypeMap = useMemo(() => new Map(expenseTypes.map((expenseType) => [expenseType.id, expenseType])), [expenseTypes]);
  const total = productTotal(productRows) + labourTotal(labourRows) + expenseTotal(expenseRows);

  return (
    <form
      action={async (formData) => {
        await updateDailyRecord(formData);
        onSaved();
      }}
      className="grid gap-4 rounded-lg border border-[#d7e1e5] bg-white p-4"
    >
      <input type="hidden" name="recordId" value={record.id} />
      <input type="hidden" name="projectId" value={record.projectId} />
      <div className="grid gap-3 md:grid-cols-[220px_220px_1fr_1fr]">
        <label>
          {t("common.date")}
          <input name="date" type="date" required defaultValue={dateInputValue(record.date)} />
        </label>
        <label>
          {t("pd.daily.completedAreaM2")}
          <input name="completedAreaM2" type="number" min="0" step="0.01" defaultValue={record.completedAreaM2} />
        </label>
        <label>
          {t("pd.daily.client")}
          <input name="clientName" defaultValue={record.clientName} placeholder={t("pd.daily.clientPlaceholder")} />
        </label>
        <label>
          {t("common.notes")}
          <input name="notes" defaultValue={record.notes} placeholder={t("pd.daily.notesPlaceholder")} />
        </label>
      </div>

      <EditableProductRows productRows={productRows} productMap={productMap} products={products} setProductRows={setProductRows} />
      <EditableLabourRows labourRows={labourRows} employeeMap={employeeMap} employees={employees} setLabourRows={setLabourRows} />
      <EditableExpenseRows expenseRows={expenseRows} expenseTypeMap={expenseTypeMap} expenseTypes={expenseTypes} setExpenseRows={setExpenseRows} />

      <div className="flex flex-col gap-3 border-t border-[#d7e1e5] pt-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-bold text-ink">
          {t("pd.daily.updatedDailyTotal")} <span className="text-ink">{money(total)}</span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-small btn-secondary" type="button" onClick={onCancel}>{t("common.cancel")}</button>
          <button className="btn btn-small btn-save" type="submit">{t("common.saveChanges")}</button>
        </div>
      </div>
    </form>
  );
}

function EditableProductRows({
  productRows,
  productMap,
  products,
  setProductRows,
}: {
  productRows: ProductRow[];
  productMap: Map<string, ProductOption>;
  products: ProductOption[];
  setProductRows: Dispatch<SetStateAction<ProductRow[]>>;
}) {
  const t = useT();
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">{t("pd.daily.productsUsed")}</h3>
        <button className="btn btn-small btn-secondary" type="button" onClick={() => setProductRows((rows) => [...rows, { id: `p-${Date.now()}`, productId: products[0]?.id ?? "", productName: products[0]?.name ?? "", unit: products[0]?.unit ?? "", quantity: 1, costPerUnit: productCost(products[0]) }])}>
          {t("pd.daily.addProductRow")}
        </button>
      </div>
      <div className="grid gap-3">
        {productRows.map((row, index) => (
          <div key={row.id} className="grid gap-3 md:grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_auto]">
            <label>
              {t("pd.daily.product")}
              <select
                name="productId"
                value={row.productId}
                onChange={(event) => {
                  const product = productMap.get(event.target.value);
                  setProductRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, productId: event.target.value, productName: product?.name ?? "", unit: product?.unit ?? "", costPerUnit: productCost(product) } : item));
                }}
              >
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} / {product.unit}</option>)}
              </select>
            </label>
            <label>
              {t("common.quantity")}
              <input name="productQuantity" type="number" min="0" step="0.01" value={row.quantity} onChange={(event) => setProductRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} />
            </label>
            <label>
              {t("pd.daily.costPerUnit")}
              <input name="productCostPerUnit" type="number" min="0" step="0.01" value={row.costPerUnit} onChange={(event) => setProductRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, costPerUnit: Number(event.target.value) } : item))} />
            </label>
            <div className="grid content-end rounded-lg border border-[#d7e1e5] bg-[#f1f3f5] px-3 py-2">
              <div className="text-xs font-bold uppercase text-muted">{t("pd.daily.lineTotal")}</div>
              <div className="font-bold">{money(row.quantity * row.costPerUnit)}</div>
            </div>
            <div className="grid content-end">
              <button className="btn btn-small btn-delete" type="button" onClick={() => setProductRows((rows) => rows.filter((item) => item.id !== row.id))}>{t("common.delete")}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditableLabourRows({
  labourRows,
  employeeMap,
  employees,
  setLabourRows,
}: {
  labourRows: LabourRow[];
  employeeMap: Map<string, EmployeeOption>;
  employees: EmployeeOption[];
  setLabourRows: Dispatch<SetStateAction<LabourRow[]>>;
}) {
  const t = useT();
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">{t("pd.daily.employeesWorked")}</h3>
        <button className="btn btn-small btn-secondary" type="button" onClick={() => setLabourRows((rows) => [...rows, { id: `l-${Date.now()}`, labourType: "employee", employeeId: employees[0]?.id ?? "", employeeName: employees[0]?.name ?? "", externalTeamName: "", ratePerSquareMeter: 0, squareMeters: 0, dailyWage: employees[0]?.defaultDailyWage ?? 0 }])}>
          {t("pd.daily.addLabourRow")}
        </button>
      </div>
      <div className="grid gap-3">
        {labourRows.map((row, index) => (
          <div key={row.id} className="grid gap-3 md:grid-cols-[0.75fr_1.3fr_0.8fr_0.8fr_0.8fr_auto]">
            <label>
              {t("pd.daily.type")}
              <select
                name="labourType"
                value={row.labourType}
                onChange={(event) => {
                  const labourType = event.target.value as LabourRow["labourType"];
                  setLabourRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, labourType } : item));
                }}
              >
                <option value="employee">{t("pd.daily.employee")}</option>
                <option value="external">{t("pd.daily.externalTeamOption")}</option>
              </select>
            </label>
            <label>
              {row.labourType === "external" ? t("pd.daily.externalTeam") : t("pd.daily.employee")}
              {row.labourType === "external" ? (
                <>
                  <input type="hidden" name="employeeId" value="" />
                  <input name="externalTeamName" value={row.externalTeamName} placeholder={t("pd.daily.externalTeamPlaceholder")} onChange={(event) => setLabourRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, externalTeamName: event.target.value } : item))} />
                </>
              ) : (
                <>
                  <select
                    name="employeeId"
                    value={row.employeeId}
                    onChange={(event) => {
                      const employee = employeeMap.get(event.target.value);
                      setLabourRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, employeeId: event.target.value, employeeName: employee?.name ?? "", dailyWage: employee?.defaultDailyWage ?? 0 } : item));
                    }}
                  >
                    {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` / ${employee.role}` : ""}</option>)}
                  </select>
                  <input type="hidden" name="externalTeamName" value="" />
                </>
              )}
              <input type="hidden" name="employeeName" value={row.labourType === "external" ? "" : row.employeeName} />
            </label>
            <label>
              {row.labourType === "external" ? t("pd.daily.ratePerM2") : t("pd.daily.dailyWage")}
              <input name={row.labourType === "external" ? "ratePerSquareMeter" : "dailyWage"} type="number" min="0" step="0.01" value={row.labourType === "external" ? row.ratePerSquareMeter : row.dailyWage} onChange={(event) => setLabourRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? row.labourType === "external" ? { ...item, ratePerSquareMeter: Number(event.target.value) } : { ...item, dailyWage: Number(event.target.value) } : item))} />
              {row.labourType === "external" ? <input type="hidden" name="dailyWage" value="0" /> : <input type="hidden" name="ratePerSquareMeter" value="0" />}
            </label>
            <label>
              {t("pd.daily.m2Done")}
              <input name="squareMeters" type="number" min="0" step="0.01" value={row.squareMeters} disabled={row.labourType !== "external"} onChange={(event) => setLabourRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, squareMeters: Number(event.target.value) } : item))} />
              {row.labourType !== "external" ? <input type="hidden" name="squareMeters" value="0" /> : null}
            </label>
            <div className="grid content-end rounded-lg border border-[#d7e1e5] bg-[#f1f3f5] px-3 py-2">
              <div className="text-xs font-bold uppercase text-muted">{t("pd.daily.lineTotal")}</div>
              <div className="font-bold">{money(row.labourType === "external" ? row.ratePerSquareMeter * row.squareMeters : row.dailyWage)}</div>
            </div>
            <div className="grid content-end">
              <button className="btn btn-small btn-delete" type="button" onClick={() => setLabourRows((rows) => rows.filter((item) => item.id !== row.id))}>{t("common.delete")}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditableExpenseRows({
  expenseRows,
  expenseTypeMap,
  expenseTypes,
  setExpenseRows,
}: {
  expenseRows: ExpenseRow[];
  expenseTypeMap: Map<string, ExpenseTypeOption>;
  expenseTypes: ExpenseTypeOption[];
  setExpenseRows: Dispatch<SetStateAction<ExpenseRow[]>>;
}) {
  const t = useT();
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-bold">{t("pd.daily.expenses")}</h3>
        <button className="btn btn-small btn-secondary" type="button" onClick={() => setExpenseRows((rows) => [...rows, { id: `e-${Date.now()}`, expenseTypeId: expenseTypes[0]?.id ?? "", category: expenseTypes[0]?.name ?? "", description: "", amount: expenseTypes[0]?.defaultAmount ?? 0 }])}>
          {t("pd.daily.addExpenseRow")}
        </button>
      </div>
      <div className="grid gap-3">
        {expenseRows.map((row, index) => (
          <div key={row.id} className="grid gap-3 md:grid-cols-[1fr_1.4fr_0.8fr_0.8fr_auto]">
            <label>
              {t("pd.daily.expenseType")}
              <select
                name="expenseTypeId"
                value={row.expenseTypeId}
                onChange={(event) => {
                  const expenseType = expenseTypeMap.get(event.target.value);
                  setExpenseRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, expenseTypeId: event.target.value, category: expenseType?.name ?? "", amount: expenseType?.defaultAmount ?? 0 } : item));
                }}
              >
                {expenseTypes.map((expenseType) => <option key={expenseType.id} value={expenseType.id}>{expenseType.name}</option>)}
              </select>
              <input type="hidden" name="expenseCategory" value={expenseTypeMap.get(row.expenseTypeId)?.name ?? row.category} />
            </label>
            <label>
              {t("pd.daily.description")}
              <input name="expenseDescription" value={row.description} placeholder={t("pd.daily.expenseDescPlaceholder")} onChange={(event) => setExpenseRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} />
            </label>
            <label>
              {t("common.amount")}
              <input name="expenseAmount" type="number" min="0" step="0.01" value={row.amount} onChange={(event) => setExpenseRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) } : item))} />
            </label>
            <div className="grid content-end rounded-lg border border-[#d7e1e5] bg-[#f1f3f5] px-3 py-2">
              <div className="text-xs font-bold uppercase text-muted">{t("pd.daily.lineTotal")}</div>
              <div className="font-bold">{money(row.amount)}</div>
            </div>
            <div className="grid content-end">
              <button className="btn btn-small btn-delete" type="button" onClick={() => setExpenseRows((rows) => rows.filter((item) => item.id !== row.id))}>{t("common.delete")}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
