"use client";

import { deleteEmployee } from "@/app/actions";
import { useT } from "@/components/LanguageProvider";

export function DeleteEmployeeButton({ id, name }: { id: string; name: string }) {
  const t = useT();
  return (
    <form
      action={deleteEmployee}
      onSubmit={(event) => {
        if (!window.confirm(t("confirm.deleteEmployee", { name }))) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-small btn-delete" type="submit">{t("common.delete")}</button>
    </form>
  );
}
