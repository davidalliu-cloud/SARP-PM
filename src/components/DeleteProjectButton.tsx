"use client";

import { deleteProject } from "@/app/actions";
import { useT } from "@/components/LanguageProvider";

export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  const t = useT();
  return (
    <form
      action={deleteProject}
      onSubmit={(event) => {
        if (!window.confirm(t("confirm.deleteProject", { name }))) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-small btn-delete w-full justify-center" type="submit">{t("common.delete")}</button>
    </form>
  );
}
