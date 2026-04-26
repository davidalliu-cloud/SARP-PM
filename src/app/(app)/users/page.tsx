import { UserRole } from "@prisma/client";
import { createUser, updateUserPassword } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  const currentUser = await requireUser();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  if (currentUser.role !== UserRole.ADMIN) {
    return (
      <>
        <PageTitle eyebrow="Access" title="Users" />
        <div className="panel p-5 font-bold text-[#7b2636]">Only admins can manage user accounts.</div>
      </>
    );
  }

  return (
    <>
      <PageTitle eyebrow="Access" title="Users" />
      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form action={createUser} className="panel grid gap-4 p-5">
          <h2 className="text-lg font-black">Add user</h2>
          <label>Name<input name="name" required placeholder="Employee name" /></label>
          <label>Email<input name="email" type="email" required placeholder="employee@sarp.com" /></label>
          <label>
            Role
            <select name="role" required defaultValue={UserRole.EMPLOYEE}>
              <option value={UserRole.ADMIN}>Admin</option>
              <option value={UserRole.MANAGER}>Manager</option>
              <option value={UserRole.EMPLOYEE}>Employee</option>
            </select>
          </label>
          <label>Password<input name="password" type="password" required minLength={8} placeholder="At least 8 characters" /></label>
          <button className="btn btn-primary" type="submit">Add user</button>
        </form>
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th><th>Password</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="font-bold">{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.createdAt.toLocaleDateString()}</td>
                  <td>
                    <form action={updateUserPassword} className="flex min-w-[260px] gap-2">
                      <input type="hidden" name="id" value={user.id} />
                      <input name="password" type="password" required minLength={8} placeholder="New password" aria-label={`New password for ${user.email}`} />
                      <button className="btn btn-small btn-save" type="submit">Save</button>
                    </form>
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
