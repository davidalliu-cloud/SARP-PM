import { createProject } from "@/app/actions";
import { PageTitle } from "@/components/PageTitle";
import { dateInputValue } from "@/lib/format";
import { getT } from "@/lib/i18n-server";

export default async function NewProjectPage() {
  const t = await getT();
  return (
    <>
      <PageTitle eyebrow={t("pd.newProject.eyebrow")} title={t("pd.newProject.title")} />
      <form action={createProject} className="panel grid max-w-3xl gap-4 p-5 md:grid-cols-2">
        <label>
          {t("pd.newProject.name")}
          <input name="name" required placeholder={t("pd.newProject.namePlaceholder")} />
        </label>
        <label>
          {t("pd.newProject.clientName")}
          <input name="clientName" placeholder={t("pd.newProject.clientPlaceholder")} />
        </label>
        <label>
          {t("pd.newProject.startDate")}
          <input name="startDate" type="date" required defaultValue={dateInputValue()} />
        </label>
        <label>
          {t("pd.newProject.budget")}
          <input name="budgetAmount" type="number" min="0" step="0.01" placeholder={t("pd.newProject.budgetPlaceholder")} />
        </label>
        <label>
          {t("pd.newProject.contractValue")}
          <input name="estimatedContractValue" type="number" min="0" step="0.01" placeholder={t("pd.newProject.contractPlaceholder")} />
        </label>
        <label>
          {t("common.status")}
          <select name="status" required defaultValue="NOT_STARTED">
            <option value="NOT_STARTED">{t("status.NOT_STARTED")}</option>
            <option value="ACTIVE">{t("status.ACTIVE")}</option>
            <option value="ON_HOLD">{t("status.ON_HOLD")}</option>
            <option value="FINISHED">{t("status.FINISHED")}</option>
          </select>
        </label>
        <div className="md:col-span-2">
          <button className="btn btn-primary" type="submit">{t("pd.newProject.create")}</button>
        </div>
      </form>
    </>
  );
}
