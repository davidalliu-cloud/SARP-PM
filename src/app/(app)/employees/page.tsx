import { createEmployee, updateEmployee } from "@/app/actions";
import { DeleteEmployeeButton } from "@/components/DeleteEmployeeButton";
import { PageTitle } from "@/components/PageTitle";
import { prisma } from "@/lib/prisma";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
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
      <PageTitle eyebrow="Master data" title="Employees" />
      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form action={createEmployee} className="panel grid gap-4 p-5">
          <h2 className="text-lg font-black">Add employee</h2>
          <label>Employee name<input name="name" required placeholder="Samir Haddad" /></label>
          <label>Role<input name="role" placeholder="Foreman, installer, labourer" /></label>
          <label>Default daily wage<input name="defaultDailyWage" type="number" min="0" step="0.01" required placeholder="180.00" /></label>
          <button className="btn btn-primary" type="submit">Add employee</button>
        </form>
        <div className="panel overflow-hidden">
          <form className="border-b border-[#d7e1e5] p-4">
            <label>
              Search employees
              <input name="q" defaultValue={params.q || ""} placeholder="Employee, role, or wage" />
            </label>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-[#6b7188]">Showing {filteredEmployees.length} of {employees.length} employees</div>
              <button className="btn btn-small btn-save" type="submit">Search</button>
            </div>
          </form>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employee</th><th>Role</th><th>Default wage</th><th>Action</th></tr></thead>
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
                        <button form={`employee-${employee.id}`} className="btn btn-small btn-save" type="submit">Save</button>
                        <DeleteEmployeeButton id={employee.id} name={employee.name} />
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredEmployees.length ? (
                  <tr><td colSpan={4} className="py-8 text-center font-bold text-[#6b7188]">No employees match your search.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
