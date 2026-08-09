"use client";

import { useMemo, useState, useTransition } from "react";
import { createDailyRecord } from "@/app/actions";
import { useModalClose } from "@/components/Modal";
import { dateInputValue } from "@/lib/format";

type ExpenseTypeOption = {
  id: string;
  name: string;
  defaultAmount: number;
};

export function ExpenseRecordForm({
  projectId,
  expenseTypes,
  defaultClientName,
}: {
  projectId: string;
  expenseTypes: ExpenseTypeOption[];
  defaultClientName?: string;
}) {
  const close = useModalClose();
  const [pending, startTransition] = useTransition();
  const [expenseRows, setExpenseRows] = useState([{ id: "e-0", expenseTypeId: expenseTypes[0]?.id ?? "", description: "", amount: expenseTypes[0]?.defaultAmount ?? 0 }]);

  const expenseTypeMap = useMemo(() => new Map(expenseTypes.map((expenseType) => [expenseType.id, expenseType])), [expenseTypes]);
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
      <div className="grid gap-4 md:grid-cols-[220px_1fr_1fr]">
        <label>
          Date
          <input name="date" type="date" required defaultValue={dateInputValue()} />
        </label>
        <label>
          Client
          <input name="clientName" placeholder={defaultClientName || "Project's default client"} defaultValue={defaultClientName || ""} />
        </label>
        <label>
          Notes
          <input name="notes" placeholder="Site progress, issues, weather, scope notes" />
        </label>
      </div>
      <input type="hidden" name="completedAreaM2" value="0" />

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
              <div className="grid content-end rounded-lg border border-[#d7e1e5] bg-[#f1f3f5] px-3 py-2">
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
          Expenses total: <span className="text-[#373455]">EUR {expenseTotal.toFixed(2)}</span>
        </div>
        <button className="btn btn-primary" type="submit" disabled={pending || !expenseTypes.length}>
          {pending ? "Saving…" : "Save expenses"}
        </button>
      </div>
    </form>
  );
}
