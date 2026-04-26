"use client";

import { deleteEmployee } from "@/app/actions";

export function DeleteEmployeeButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteEmployee}
      onSubmit={(event) => {
        if (!window.confirm(`Delete employee "${name}"? Existing project records will keep their labour cost history.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-small btn-delete" type="submit">Delete</button>
    </form>
  );
}
