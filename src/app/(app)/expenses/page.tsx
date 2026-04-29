import { createExpenseType } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { money } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function ExpensesPage() {
  const expenseTypes = await prisma.expenseType.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageTitle eyebrow="Master data" title="Expenses" />
      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form action={createExpenseType} className="panel grid gap-4 p-5">
          <h2 className="text-lg font-black">Add expense option</h2>
          <label>Expense name<input name="name" required placeholder="Food allowance" /></label>
          <label>Default amount<input name="defaultAmount" type="number" min="0" step="0.01" required placeholder="25.00" /></label>
          <label>Notes<textarea name="notes" rows={3} placeholder="Optional internal note" /></label>
          <button className="btn btn-primary" type="submit">Add expense option</button>
        </form>
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Expense option</th><th>Default amount</th><th>Notes</th></tr></thead>
            <tbody>
              {expenseTypes.map((expenseType) => (
                <tr key={expenseType.id}>
                  <td className="font-bold">{expenseType.name}</td>
                  <td>{money(expenseType.defaultAmount)}</td>
                  <td>{expenseType.notes || "-"}</td>
                </tr>
              ))}
              {!expenseTypes.length ? (
                <tr><td colSpan={3} className="py-8 text-center font-bold text-[#6b7188]">No expense options yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
