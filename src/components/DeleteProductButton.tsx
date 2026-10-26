"use client";

import { deleteProduct } from "@/app/actions";
import { useT } from "@/components/LanguageProvider";

export function DeleteProductButton({ id, name }: { id: string; name: string }) {
  const t = useT();
  return (
    <form
      action={deleteProduct}
      onSubmit={(event) => {
        if (!window.confirm(t("confirm.deleteProduct", { name }))) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-small btn-delete" type="submit">
        {t("common.delete")}
      </button>
    </form>
  );
}
