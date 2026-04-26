import { createEmployee, updateEmployee } from "@/app/actions";
import { DeleteEmployeeButton } from "@/components/DeleteEmployeeButton";
import { PageTitle } from "@/components/PageTitle";
import { prisma } from "@/lib/prisma";

export default async function EmployeesPage() {
  const employees = await prisma.employee.findMany({ orderBy: { name: "asc" } });

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
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Employee</th><th>Role</th><th>Default wage</th><th>Action</th></tr></thead>
            <tbody>
              {employees.map((employee) => (
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
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
