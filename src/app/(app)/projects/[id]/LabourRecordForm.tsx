"use client";

import { useMemo, useState, useTransition } from "react";
import { createDailyRecord } from "@/app/actions";
import { useModalClose } from "@/components/Modal";
import { dateInputValue } from "@/lib/format";

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

type LabourRow = {
  id: string;
  labourType: "employee" | "external";
  employeeId: string;
  dailyWage: number;
  externalTeamName: string;
  ratePerSquareMeter: number;
  squareMeters: number;
};

function newLabourRow(id: string, employees: EmployeeOption[]): LabourRow {
  return {
    id,
    labourType: "employee",
    employeeId: employees[0]?.id ?? "",
    dailyWage: employees[0]?.defaultDailyWage ?? 0,
    externalTeamName: "",
    ratePerSquareMeter: 0,
    squareMeters: 0,
  };
}

export function LabourRecordForm({
  projectId,
  employees,
  expenseTypes,
}: {
  projectId: string;
  employees: EmployeeOption[];
  expenseTypes: ExpenseTypeOption[];
}) {
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [labourRows, setLabourRows] = useState([newLabourRow("l-0", employees)]);
  const [expenseRows, setExpenseRows] = useState([{ id: "e-0", expenseTypeId: expenseTypes[0]?.id ?? "", description: "", amount: expenseTypes[0]?.defaultAmount ?? 0 }]);

  const employeeMap = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const expenseTypeMap = useMemo(() => new Map(expenseTypes.map((expenseType) => [expenseType.id, expenseType])), [expenseTypes]);
  const labourTotal = labourRows.reduce((sum, row) => sum + (row.labourType === "external" ? row.ratePerSquareMeter * row.squareMeters : row.dailyWage), 0);
  const expenseTotal = expenseRows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <form
      action={(formData) =>
        startTransition(async () => {
          await createDailyRecord(formData);
          close();
        })
      }
      className="grid gap-5"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <div className="grid gap-4 md:grid-cols-[220px_220px_1fr]">
        <label>
          Date
          <input name="date" type="date" required defaultValue={dateInputValue()} />
        </label>
        <label>
          Completed area m2
          <input name="completedAreaM2" type="number" min="0" step="0.01" placeholder="85" />
        </label>
        <label>
          Notes
          <input name="notes" placeholder="Site progress, issues, weather, scope notes" />
        </label>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black">Employees worked</h3>
          <button
            className="btn btn-small btn-secondary"
            type="button"
            onClick={() => setLabourRows((rows) => [...rows, newLabourRow(`l-${Date.now()}`, employees)])}
          >
            Add labour row
          </button>
        </div>
        <div className="grid gap-3">
          {labourRows.map((row, index) => {
            const selected = employeeMap.get(row.employeeId);
            return (
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
                          setLabourRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, employeeId: event.target.value, dailyWage: employee?.defaultDailyWage ?? 0 } : item));
                        }}
                      >
                        {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name}{employee.role ? ` / ${employee.role}` : ""}</option>)}
                      </select>
                      <input type="hidden" name="externalTeamName" value="" />
                    </>
                  )}
                  <input type="hidden" name="employeeName" value={selected?.name ?? ""} />
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
                <div className="grid content-end rounded-lg border border-[#d7e1e5] bg-[#f3f7f3] px-3 py-2">
                  <div className="text-xs font-black uppercase text-[#6b7188]">Line total</div>
                  <div className="font-black">EUR {(row.labourType === "external" ? row.ratePerSquareMeter * row.squareMeters : row.dailyWage).toFixed(2)}</div>
                </div>
                <div className="grid content-end">
                  <button className="btn btn-small btn-delete" type="button" onClick={() => setLabourRows((rows) => rows.filter((item) => item.id !== row.id))}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-black">Expenses</h3>
          <button
            className="btn btn-small btn-secondary"
            type="button"
            onClick={() => setExpenseRows((rows) => [...rows, { id: `e-${Date.now()}`, expenseTypeId: expenseTypes[0]?.id ?? "", description: "", amount: expenseTypes[0]?.defaultAmount ?? 0 }])}
          >
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
                    setExpenseRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, expenseTypeId: event.target.value, amount: expenseType?.defaultAmount ?? 0 } : item));
                  }}
                >
                  {expenseTypes.map((expenseType) => <option key={expenseType.id} value={expenseType.id}>{expenseType.name}</option>)}
                </select>
                <input type="hidden" name="expenseCategory" value={expenseTypeMap.get(row.expenseTypeId)?.name ?? ""} />
              </label>
              <label>
                Description
                <input
                  name="expenseDescription"
                  value={row.description}
                  placeholder="Lunch, overtime, drill bits, parking"
                  onChange={(event) => setExpenseRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, description: event.target.value } : item))}
                />
              </label>
              <label>
                Amount
                <input
                  name="expenseAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={row.amount}
                  onChange={(event) => setExpenseRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) } : item))}
                />
              </label>
              <div className="grid content-end rounded-lg border border-[#d7e1e5] bg-[#f3f7f3] px-3 py-2">
                <div className="text-xs font-black uppercase text-[#6b7188]">Line total</div>
                <div className="font-black">EUR {row.amount.toFixed(2)}</div>
              </div>
              <div className="grid content-end">
                <button className="btn btn-small btn-delete" type="button" onClick={() => setExpenseRows((rows) => rows.filter((item) => item.id !== row.id))}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4 md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-bold text-[#373455]">
          Labour &amp; expenses total: <span className="text-[#373455]">EUR {(labourTotal + expenseTotal).toFixed(2)}</span>
        </div>
        <button className="btn btn-primary" type="submit" disabled={pending || !employees.length}>
          {pending ? "Saving…" : "Save labour"}
        </button>
      </div>
    </form>
  );
}
