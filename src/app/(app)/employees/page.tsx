import { createEmployee, updateEmployee } from "@/app/actions";
import { DeleteEmployeeButton } from "@/components/DeleteEmployeeButton";
import { PageTitle } from "@/components/PageTitle";
import { getT } from "@/lib/i18n-server";
import { prisma } from "@/lib/prisma";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const t = await getT();
  const query = (params.q || "").trim().toLowerCase();
  const employees = await prisma.employee.findMany({ orderBy: { name: "asc" } });
  const filteredEmployees = employees.filter((employee) => {
    return !query ||
      employee.name.toLowerCase().includes(query) ||
      (employee.role || "").toLowerCase().includes(query) ||
      String(employee.defaultDailyWage).includes(query);
  });

  return (
    <>
      <PageTitle eyebrow={t("employees.eyebrow")} title={t("employees.title")} />
      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form action={createEmployee} className="panel grid gap-4 p-5">
          <h2 className="text-lg font-bold">{t("employees.addEmployee")}</h2>
          <label>{t("employees.employeeName")}<input name="name" required placeholder="Samir Haddad" /></label>
          <label>{t("employees.role")}<input name="role" placeholder="Foreman, installer, labourer" /></label>
          <label>{t("employees.defaultDailyWage")}<input name="defaultDailyWage" type="number" min="0" step="0.01" required placeholder="180.00" /></label>
          <button className="btn btn-primary" type="submit">{t("employees.addEmployee")}</button>
        </form>
        <div className="panel overflow-hidden">
          <form className="border-b border-[#d7e1e5] p-4">
            <label>
              {t("employees.searchEmployees")}
              <input name="q" defaultValue={params.q || ""} placeholder={t("employees.searchPlaceholder")} />
            </label>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-muted">{t("employees.showing", { shown: filteredEmployees.length, total: employees.length })}</div>
              <button className="btn btn-small btn-save" type="submit">{t("common.search")}</button>
            </div>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>{t("employees.colEmployee")}</th><th>{t("employees.role")}</th><th>{t("employees.colDefaultWage")}</th><th>{t("common.actions")}</th></tr></thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <form id={`employee-${employee.id}`} action={updateEmployee}>
                        <input type="hidden" name="id" value={employee.id} />
                        <input name="name" defaultValue={employee.name} required aria-label={`Employee name for ${employee.name}`} />
                      </form>
                    </td>
                    <td>
                      <input form={`employee-${employee.id}`} name="role" defaultValue={employee.role || ""} placeholder="Role" aria-label={`Role for ${employee.name}`} />
                    </td>
                    <td>
                      <input form={`employee-${employee.id}`} name="defaultDailyWage" type="number" min="0" step="0.01" defaultValue={employee.defaultDailyWage} required aria-label={`Default daily wage for ${employee.name}`} />
                    </td>
                    <td>
                      <div className="flex flex-nowrap gap-2">
                        <button form={`employee-${employee.id}`} className="btn btn-small btn-save" type="submit">{t("common.save")}</button>
                        <DeleteEmployeeButton id={employee.id} name={employee.name} />
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredEmployees.length ? (
                  <tr><td colSpan={4} className="py-8 text-center font-bold text-muted">{t("employees.noMatch")}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
