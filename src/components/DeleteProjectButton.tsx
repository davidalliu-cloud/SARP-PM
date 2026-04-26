"use client";

import { deleteProject } from "@/app/actions";

export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteProject}
      onSubmit={(event) => {
        if (!window.confirm(`Delete project "${name}"? This will delete its daily records and invoices too.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-small btn-delete" type="submit">Delete</button>
    </form>
  );
}
