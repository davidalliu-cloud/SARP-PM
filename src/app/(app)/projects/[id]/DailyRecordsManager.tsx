"use client";

import { Fragment, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { deleteDailyRecord, updateDailyRecord } from "@/app/actions";
import { money } from "@/lib/format";

type ProductOption = {
  id: string;
  name: string;
  unit: string;
  defaultCostPerUnit: number;
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
  notes: string;
  productItems: ProductRow[];
  labourItems: LabourRow[];
  expenseItems: ExpenseRow[];
};

function dateInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}

function displayDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function productTotal(items: ProductRow[]) {
  return items.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0);
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const filteredRecords = useMemo(() => {
    if (!normalizedQuery) return records;
    return records.filter((record) => {
      const searchable = [
        displayDate(record.date),
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
      <div className="rounded-lg border border-dashed border-[#c5cdd6] bg-[#f7f9fb] p-4 text-sm font-bold text-[#687482]">
        No daily records saved for this project yet.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <label>
        Search daily records
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Date, product, employee, expense, or note" />
      </label>
      <div className="text-xs font-bold text-[#687482]">Showing {filteredRecords.length} of {records.length} records</div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Products</th>
              <th>Labour</th>
              <th>Expenses</th>
              <th>Product cost</th>
              <th>Labour cost</th>
              <th>Expense cost</th>
              <th>Daily total</th>
              <th>Notes</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRecords.map((record) => {
            const productCost = productTotal(record.productItems);
            const labourCost = labourTotal(record.labourItems);
            const expenses = expenseTotal(record.expenseItems);
            const isEditing = editingId === record.id;

            return (
              <Fragment key={record.id}>
                <tr>
                  <td className="font-bold">{displayDate(record.date)}</td>
                  <td>{record.productItems.map((item) => `${item.productName} (${item.quantity} ${item.unit})`).join(", ") || "-"}</td>
                  <td>{record.labourItems.map((item) => item.labourType === "external" ? `${item.externalTeamName} (${item.squareMeters} m2)` : item.employeeName).join(", ") || "-"}</td>
                  <td>{record.expenseItems.map((item) => `${item.category}${item.description ? `: ${item.description}` : ""}`).join(", ") || "-"}</td>
                  <td>{money(productCost)}</td>
                  <td>{money(labourCost)}</td>
                  <td>{money(expenses)}</td>
                  <td className="font-black">{money(productCost + labourCost + expenses)}</td>
                  <td>{record.notes || "-"}</td>
                  <td>
                    <div className="flex flex-nowrap gap-2">
                      <button className="btn btn-small btn-edit" type="button" onClick={() => setEditingId(isEditing ? null : record.id)}>
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                      <form
                        action={deleteDailyRecord}
                        onSubmit={(event) => {
                          if (!window.confirm(`Delete daily record from ${displayDate(record.date)}? This cannot be undone.`)) {
                            event.preventDefault();
                          }
                        }}
                      >
                        <input type="hidden" name="recordId" value={record.id} />
                        <input type="hidden" name="projectId" value={projectId} />
                        <button className="btn btn-small btn-delete" type="submit">Delete</button>
                      </form>
                    </div>
                  </td>
                </tr>
                {isEditing ? (
                  <tr>
                    <td colSpan={10} className="bg-[#f7f9fb]">
                      <DailyRecordEditForm
                        record={record}
                        products={products}
                        employees={employees}
                        expenseTypes={expenseTypes}
                        onCancel={() => setEditingId(null)}
                        onSaved={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
            {!filteredRecords.length ? (
              <tr><td colSpan={10} className="py-8 text-center font-bold text-[#687482]">No daily records match your search.</td></tr>
            ) : null}
          </tbody>
        </table>
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
  const [productRows, setProductRows] = useState<ProductRow[]>(
    record.productItems.length ? record.productItems : [{ id: `p-${record.id}`, productId: products[0]?.id ?? "", productName: products[0]?.name ?? "", unit: products[0]?.unit ?? "", quantity: 1, costPerUnit: products[0]?.defaultCostPerUnit ?? 0 }]
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
      className="grid gap-4 rounded-lg border border-[#d8dee5] bg-white p-4"
    >
      <input type="hidden" name="recordId" value={record.id} />
      <input type="hidden" name="projectId" value={record.projectId} />
      <div className="grid gap-3 md:grid-cols-[220px_1fr]">
        <label>
          Date
          <input name="date" type="date" required defaultValue={dateInputValue(record.date)} />
        </label>
        <label>
          Notes
          <input name="notes" defaultValue={record.notes} placeholder="Site progress, issues, weather, scope notes" />
        </label>
      </div>

      <EditableProductRows productRows={productRows} productMap={productMap} products={products} setProductRows={setProductRows} />
      <EditableLabourRows labourRows={labourRows} employeeMap={employeeMap} employees={employees} setLabourRows={setLabourRows} />
      <EditableExpenseRows expenseRows={expenseRows} expenseTypeMap={expenseTypeMap} expenseTypes={expenseTypes} setExpenseRows={setExpenseRows} />

      <div className="flex flex-col gap-3 border-t border-[#d8dee5] pt-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-bold text-[#46515d]">
          Updated daily total: <span className="text-[#20262d]">{money(total)}</span>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-small btn-secondary" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn btn-small btn-save" type="submit">Save changes</button>
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
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black">Products used</h3>
        <button className="btn btn-small btn-secondary" type="button" onClick={() => setProductRows((rows) => [...rows, { id: `p-${Date.now()}`, productId: products[0]?.id ?? "", productName: products[0]?.name ?? "", unit: products[0]?.unit ?? "", quantity: 1, costPerUnit: products[0]?.defaultCostPerUnit ?? 0 }])}>
          Add product row
        </button>
      </div>
      <div className="grid gap-3">
        {productRows.map((row, index) => (
          <div key={row.id} className="grid gap-3 md:grid-cols-[1.5fr_0.7fr_0.8fr_0.8fr_auto]">
            <label>
              Product
              <select
                name="productId"
                value={row.productId}
                onChange={(event) => {
                  const product = productMap.get(event.target.value);
                  setProductRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, productId: event.target.value, productName: product?.name ?? "", unit: product?.unit ?? "", costPerUnit: product?.defaultCostPerUnit ?? 0 } : item));
                }}
              >
                {products.map((product) => <option key={product.id} value={product.id}>{product.name} / {product.unit}</option>)}
              </select>
            </label>
            <label>
              Quantity
              <input name="productQuantity" type="number" min="0" step="0.01" value={row.quantity} onChange={(event) => setProductRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} />
            </label>
            <label>
              Cost per unit
              <input name="productCostPerUnit" type="number" min="0" step="0.01" value={row.costPerUnit} onChange={(event) => setProductRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, costPerUnit: Number(event.target.value) } : item))} />
            </label>
            <div className="grid content-end rounded-lg border border-[#d8dee5] bg-[#f7f9fb] px-3 py-2">
              <div className="text-xs font-black uppercase text-[#687482]">Line total</div>
              <div className="font-black">{money(row.quantity * row.costPerUnit)}</div>
            </div>
            <div className="grid content-end">
              <button className="btn btn-small btn-delete" type="button" onClick={() => setProductRows((rows) => rows.filter((item) => item.id !== row.id))}>Delete</button>
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
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black">Employees worked</h3>
        <button className="btn btn-small btn-secondary" type="button" onClick={() => setLabourRows((rows) => [...rows, { id: `l-${Date.now()}`, labourType: "employee", employeeId: employees[0]?.id ?? "", employeeName: employees[0]?.name ?? "", externalTeamName: "", ratePerSquareMeter: 0, squareMeters: 0, dailyWage: employees[0]?.defaultDailyWage ?? 0 }])}>
          Add labour row
        </button>
      </div>
      <div className="grid gap-3">
        {labourRows.map((row, index) => (
          <div key={row.id} className="grid gap-3 md:grid-cols-[0.75fr_1.3fr_0.8fr_0.8fr_0.8fr_auto]">
            <label>
              Type
              <select
                name="labourType"
                value={row.labourType}
                onChange={(event) => {
                  const labourType = event.target.value as LabourRow["labourType"];
                  setLabourRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, labourType } : item));
                }}
              >
                <option value="employee">Employee</option>
                <option value="external">External m2 team</option>
              </select>
            </label>
            <label>
              {row.labourType === "external" ? "External team" : "Employee"}
              {row.labourType === "external" ? (
                <>
                  <input type="hidden" name="employeeId" value="" />
                  <input name="externalTeamName" value={row.externalTeamName} placeholder="External waterproofing team" onChange={(event) => setLabourRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, externalTeamName: event.target.value } : item))} />
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
              {row.labourType === "external" ? "Rate / m2" : "Daily wage"}
              <input name={row.labourType === "external" ? "ratePerSquareMeter" : "dailyWage"} type="number" min="0" step="0.01" value={row.labourType === "external" ? row.ratePerSquareMeter : row.dailyWage} onChange={(event) => setLabourRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? row.labourType === "external" ? { ...item, ratePerSquareMeter: Number(event.target.value) } : { ...item, dailyWage: Number(event.target.value) } : item))} />
              {row.labourType === "external" ? <input type="hidden" name="dailyWage" value="0" /> : <input type="hidden" name="ratePerSquareMeter" value="0" />}
            </label>
            <label>
              m2 done
              <input name="squareMeters" type="number" min="0" step="0.01" value={row.squareMeters} disabled={row.labourType !== "external"} onChange={(event) => setLabourRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, squareMeters: Number(event.target.value) } : item))} />
              {row.labourType !== "external" ? <input type="hidden" name="squareMeters" value="0" /> : null}
            </label>
            <div className="grid content-end rounded-lg border border-[#d8dee5] bg-[#f7f9fb] px-3 py-2">
              <div className="text-xs font-black uppercase text-[#687482]">Line total</div>
              <div className="font-black">{money(row.labourType === "external" ? row.ratePerSquareMeter * row.squareMeters : row.dailyWage)}</div>
            </div>
            <div className="grid content-end">
              <button className="btn btn-small btn-delete" type="button" onClick={() => setLabourRows((rows) => rows.filter((item) => item.id !== row.id))}>Delete</button>
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
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-black">Expenses</h3>
        <button className="btn btn-small btn-secondary" type="button" onClick={() => setExpenseRows((rows) => [...rows, { id: `e-${Date.now()}`, expenseTypeId: expenseTypes[0]?.id ?? "", category: expenseTypes[0]?.name ?? "", description: "", amount: expenseTypes[0]?.defaultAmount ?? 0 }])}>
          Add expense row
        </button>
      </div>
      <div className="grid gap-3">
        {expenseRows.map((row, index) => (
          <div key={row.id} className="grid gap-3 md:grid-cols-[1fr_1.4fr_0.8fr_0.8fr_auto]">
            <label>
              Expense type
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
              Description
              <input name="expenseDescription" value={row.description} placeholder="Lunch, overtime, tools, parking" onChange={(event) => setExpenseRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))} />
            </label>
            <label>
              Amount
              <input name="expenseAmount" type="number" min="0" step="0.01" value={row.amount} onChange={(event) => setExpenseRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) } : item))} />
            </label>
            <div className="grid content-end rounded-lg border border-[#d8dee5] bg-[#f7f9fb] px-3 py-2">
              <div className="text-xs font-black uppercase text-[#687482]">Line total</div>
              <div className="font-black">{money(row.amount)}</div>
            </div>
            <div className="grid content-end">
              <button className="btn btn-small btn-delete" type="button" onClick={() => setExpenseRows((rows) => rows.filter((item) => item.id !== row.id))}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
