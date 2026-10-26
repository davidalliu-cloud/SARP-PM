import { createExpenseType } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { getT } from "@/lib/i18n-server";
import { money } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function ExpensesPage() {
  const t = await getT();
  const expenseTypes = await prisma.expenseType.findMany({ orderBy: { name: "asc" } });

  return (
    <>
      <PageTitle eyebrow={t("expenses.eyebrow")} title={t("expenses.title")} />
      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form action={createExpenseType} className="panel grid gap-4 p-5">
          <h2 className="text-lg font-bold">{t("expenses.addOption")}</h2>
          <label>{t("expenses.expenseName")}<input name="name" required placeholder="Food allowance" /></label>
          <label>{t("expenses.defaultAmount")}<input name="defaultAmount" type="number" min="0" step="0.01" required placeholder="25.00" /></label>
          <label>{t("common.notes")}<textarea name="notes" rows={3} placeholder={t("expenses.notesOptional")} /></label>
          <button className="btn btn-primary" type="submit">{t("expenses.addOption")}</button>
        </form>
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>{t("expenses.colOption")}</th><th>{t("expenses.defaultAmount")}</th><th>{t("common.notes")}</th></tr></thead>
            <tbody>
              {expenseTypes.map((expenseType) => (
                <tr key={expenseType.id}>
                  <td className="font-bold">{expenseType.name}</td>
                  <td>{money(expenseType.defaultAmount)}</td>
                  <td>{expenseType.notes || "-"}</td>
                </tr>
              ))}
              {!expenseTypes.length ? (
                <tr><td colSpan={3} className="py-8 text-center font-bold text-muted">{t("expenses.noTypes")}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
