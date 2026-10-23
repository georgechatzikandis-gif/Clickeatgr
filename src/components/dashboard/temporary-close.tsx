"use client";

import { setTemporarilyClosedAction } from "@/app/actions/business";
import { ActionForm, SubmitButton } from "../action-form";

export function TemporaryCloseToggle({ closed }: { closed: boolean }) {
  return (
    <div className={`px-4 py-2 ${closed ? "bg-red-50" : "bg-green-50"}`}>
      <ActionForm
        action={setTemporarilyClosedAction}
        className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 text-sm"
        confirm={closed ? undefined : "Να σταματήσει προσωρινά η λήψη νέων παραγγελιών;"}
      >
        <span className={`font-medium ${closed ? "text-danger" : "text-ok"}`}>
          {closed ? "⏸ Προσωρινά κλειστό — δεν δέχεστε νέες παραγγελίες" : "● Δέχεστε παραγγελίες (εντός ωραρίου)"}
        </span>
        <input type="hidden" name="closed" value={closed ? "false" : "true"} />
        <SubmitButton className={closed ? "btn-dark !py-1.5 text-sm" : "btn-ghost !py-1.5 text-sm"}>
          {closed ? "Άνοιγμα ξανά" : "Προσωρινό κλείσιμο"}
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
