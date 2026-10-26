import { UserRole } from "@prisma/client";
import { createUser, updateUserPassword } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { requireUser } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function UsersPage() {
  const currentUser = await requireUser();
  const t = await getT();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  if (currentUser.role !== UserRole.ADMIN) {
    return (
      <>
        <PageTitle eyebrow={t("users.eyebrow")} title={t("users.title")} />
        <div className="panel p-5 font-bold text-lab-burgundy">{t("users.adminsOnly")}</div>
      </>
    );
  }

  return (
    <>
      <PageTitle eyebrow={t("users.eyebrow")} title={t("users.title")} />
      <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <form action={createUser} className="panel grid gap-4 p-5">
          <h2 className="text-lg font-bold">{t("users.addUser")}</h2>
          <label>{t("users.name")}<input name="name" required placeholder={t("users.namePlaceholder")} /></label>
          <label>{t("users.email")}<input name="email" type="email" required placeholder="employee@sarp.com" /></label>
          <label>
            {t("users.role")}
            <select name="role" required defaultValue={UserRole.EMPLOYEE}>
              <option value={UserRole.ADMIN}>{t("users.roleAdmin")}</option>
              <option value={UserRole.MANAGER}>{t("users.roleManager")}</option>
              <option value={UserRole.EMPLOYEE}>{t("users.roleEmployee")}</option>
            </select>
          </label>
          <label>{t("users.password")}<input name="password" type="password" required minLength={8} placeholder={t("users.passwordHint")} /></label>
          <button className="btn btn-primary" type="submit">{t("users.addUser")}</button>
        </form>
        <div className="panel table-wrap">
          <table>
            <thead><tr><th>{t("users.name")}</th><th>{t("users.email")}</th><th>{t("users.role")}</th><th>{t("users.colCreated")}</th><th>{t("users.colPassword")}</th></tr></thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="font-bold">{user.name}</td>
                  <td>{user.email}</td>
                  <td>{t(`roles.${user.role}`)}</td>
                  <td>{formatDate(user.createdAt)}</td>
                  <td>
                    <form action={updateUserPassword} className="flex min-w-[260px] gap-2">
                      <input type="hidden" name="id" value={user.id} />
                      <input name="password" type="password" required minLength={8} placeholder={t("users.newPassword")} aria-label={`New password for ${user.email}`} />
                      <button className="btn btn-small btn-save" type="submit">{t("common.save")}</button>
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
