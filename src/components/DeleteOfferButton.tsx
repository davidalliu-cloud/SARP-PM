"use client";

import { deleteOffer } from "@/app/actions";

export function DeleteOfferButton({ id, code, label }: { id: string; code: string; label: string }) {
  return (
    <form
      action={deleteOffer}
      onSubmit={(event) => {
        if (!window.confirm(`Delete offer ${code}? This removes it and its full history permanently.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn btn-small btn-delete" type="submit">{label}</button>
    </form>
  );
}
