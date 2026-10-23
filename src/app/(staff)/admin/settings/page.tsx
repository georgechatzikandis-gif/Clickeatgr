import type { Metadata } from "next";
import { createStaffUserAction, savePlatformSettingsAction, updateStaffUserAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { formatAthens } from "@/lib/hours";
import { requireAdminPage } from "@/server/auth";
import { listAdmins } from "@/server/admin-data";
import { getPlatformSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Ρυθμίσεις πλατφόρμας" };

export default async function AdminSettingsPage() {
  const me = await requireAdminPage();
  const [s, admins] = await Promise.all([getPlatformSettings(), listAdmins()]);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <ActionForm action={savePlatformSettingsAction} className="card space-y-3 p-4">
        <h1 className="text-lg font-bold">Προμήθεια πλατφόρμας</h1>
        <label className="flex items-start gap-2 rounded-xl border border-line p-3">
          <input type="checkbox" name="commissionEnabled" defaultChecked={s.commissionEnabled} className="mt-1 h-4 w-4 accent-amber-500" />
          <span>
            <span className="font-semibold">Ενεργοποίηση προμήθειας</span>
            <span className="block text-sm text-ink-soft">
              Όσο είναι απενεργοποιημένη, κάθε παραγγελία καταγράφεται με 0%. Όταν ενεργοποιηθεί, ισχύει μόνο για καταστήματα των οποίων η δωρεάν
              περίοδος έχει λήξει (ορίζεται ανά κατάστημα) και μόνο για νέες παραγγελίες.
            </span>
          </span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="rate">Προεπιλεγμένο ποσοστό %</label>
            <input id="rate" name="defaultRate" inputMode="decimal" defaultValue={String(s.defaultCommissionRateBps / 100)} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="base">Βάση υπολογισμού</label>
            <select id="base" name="defaultBase" defaultValue={s.defaultCommissionBase} className="input">
              <option value="subtotal">Μόνο προϊόντα (χωρίς διανομή)</option>
              <option value="subtotal_plus_delivery">Προϊόντα + κόστος διανομής</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-ink-soft">
          Η προμήθεια μόνο καταγράφεται για αναφορές — δεν εισπράττεται αυτόματα. Χρεώνεται μόνο σε ολοκληρωμένες παραγγελίες.
        </p>
        <SubmitButton>Αποθήκευση</SubmitButton>
      </ActionForm>

      <div className="card p-4">
        <h2 className="text-lg font-bold">Διαχειριστές</h2>
        <ul className="mt-2 space-y-2">
          {admins.map((u) => (
            <li key={u.id} className="rounded-xl border border-line p-2 text-sm">
              <p className="font-medium">{u.email} {u.id === me.id && <span className="text-xs text-ink-soft">(εσείς)</span>}</p>
              <p className="text-xs text-ink-soft">Τελ. σύνδεση: {u.lastLoginAt ? formatAthens(u.lastLoginAt) : "ποτέ"}</p>
              <ActionForm action={updateStaffUserAction} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={u.id} />
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={u.active} /> Ενεργός</label>
                <input name="password" type="password" autoComplete="new-password" placeholder="Νέος κωδικός" className="input !w-48 !py-1.5" />
                <SubmitButton className="btn-ghost !px-2.5 !py-1.5 text-xs">Αποθήκευση</SubmitButton>
              </ActionForm>
            </li>
          ))}
        </ul>
        <ActionForm action={createStaffUserAction} className="mt-3 space-y-2 border-t border-line pt-3" resetOnSuccess>
          <input type="hidden" name="role" value="admin" />
          <input name="email" type="email" required placeholder="Email νέου διαχειριστή" className="input" aria-label="Email" />
          <input name="password" type="password" autoComplete="new-password" required minLength={10} placeholder="Κωδικός (10+)" className="input" aria-label="Κωδικός" />
          <SubmitButton className="btn-dark">Προσθήκη διαχειριστή</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
