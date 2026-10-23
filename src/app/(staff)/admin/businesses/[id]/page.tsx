import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  adminZoneAction,
  createStaffUserAction,
  deleteBusinessAction,
  updateBusinessAction,
  updateStaffUserAction,
} from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { trialLabel } from "@/lib/commission";
import { formatAthens } from "@/lib/hours";
import { centsToInput } from "@/lib/money";
import { requireAdminPage } from "@/server/auth";
import { getBusinessForAdmin, listAllCategories, listAllRegions } from "@/server/admin-data";
import { getPlatformSettings } from "@/server/settings";

export const metadata: Metadata = { title: "Κατάστημα" };

export default async function AdminBusinessPage(props: PageProps<"/admin/businesses/[id]">) {
  await requireAdminPage();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [data, cats, regions, settings] = await Promise.all([getBusinessForAdmin(id), listAllCategories(), listAllRegions(), getPlatformSettings()]);
  if (!data) notFound();
  const { business: b, staff, zones } = data;
  const created = (await props.searchParams).created;
  const trialDate = b.trialEndsAt
    ? new Date(b.trialEndsAt.getTime() - 1).toLocaleDateString("en-CA", { timeZone: "Europe/Athens" })
    : "";

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/businesses" className="text-sm text-ink-soft hover:underline">← Καταστήματα</Link>
        <h1 className="mt-1 text-xl font-bold">{b.name}</h1>
        <p className="text-sm text-ink-soft">
          <Link href={`/r/${b.slug}`} target="_blank" className="underline">/r/{b.slug}</Link> · {data.orderCount} παραγγελίες · {trialLabel(b.trialEndsAt)}
        </p>
        {created && (
          <p className="mt-2 rounded-lg bg-green-50 p-2 text-sm text-ok">
            Το κατάστημα δημιουργήθηκε (ανενεργό). Επόμενα βήματα: στοιχεία & κατηγορίες → λογαριασμός χρήστη για το κατάστημα → το κατάστημα συμπληρώνει κατάλογο, ωράριο, περιοχές → «Ενεργό».
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ActionForm action={updateBusinessAction} className="card space-y-3 p-4">
          <input type="hidden" name="id" value={b.id} />
          <h2 className="font-bold">Στοιχεία</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="name">Όνομα *</label>
              <input id="name" name="name" required maxLength={100} defaultValue={b.name} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="slug">Slug σελίδας</label>
              <input id="slug" name="slug" maxLength={60} defaultValue={b.slug} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="status">Κατάσταση</label>
              <select id="status" name="status" defaultValue={b.status} className="input">
                <option value="active">Ενεργό (εμφανίζεται)</option>
                <option value="inactive">Ανενεργό (κρυφό)</option>
                <option value="suspended">Σε αναστολή</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="region">Περιοχή</label>
              <select id="region" name="regionId" defaultValue={b.regionId} className="input">
                {regions.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="legal">Επωνυμία</label>
              <input id="legal" name="legalName" maxLength={150} defaultValue={b.legalName} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="vat">ΑΦΜ</label>
              <input id="vat" name="vatNumber" maxLength={20} defaultValue={b.vatNumber} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="phone">Τηλέφωνο</label>
              <input id="phone" name="phone" maxLength={30} defaultValue={b.phone} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" maxLength={120} defaultValue={b.email} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="address">Διεύθυνση</label>
            <input id="address" name="address" maxLength={200} defaultValue={b.address} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="desc">Περιγραφή</label>
            <textarea id="desc" name="description" rows={2} maxLength={500} defaultValue={b.description} className="input" />
          </div>
          <fieldset>
            <legend className="label">Κατηγορίες</legend>
            <div className="flex flex-wrap gap-2">
              {cats.map((c) => (
                <label key={c.id} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 text-sm">
                  <input type="checkbox" name="categoryIds" value={c.id} defaultChecked={data.categoryIds.includes(c.id)} />
                  {c.icon} {c.name}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="rounded-xl border border-line p-3">
            <legend className="px-1 font-bold">Δωρεάν περίοδος & προμήθεια</legend>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="trial">Δωρεάν έως (και)</label>
                <input id="trial" name="trialEndsAt" type="date" defaultValue={trialDate} className="input" />
                <p className="mt-1 text-xs text-ink-soft">Κενό = δωρεάν χωρίς λήξη.</p>
              </div>
              <div>
                <label className="label" htmlFor="rate">Προμήθεια %</label>
                <input
                  id="rate"
                  name="commissionRate"
                  inputMode="decimal"
                  placeholder={`${settings.defaultCommissionRateBps / 100} (προεπ.)`}
                  defaultValue={b.commissionRateBps === null ? "" : String(b.commissionRateBps / 100)}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="base">Βάση</label>
                <select id="base" name="commissionBase" defaultValue={b.commissionBase ?? ""} className="input">
                  <option value="">Προεπιλογή πλατφόρμας</option>
                  <option value="subtotal">Μόνο προϊόντα</option>
                  <option value="subtotal_plus_delivery">Προϊόντα + διανομή</option>
                </select>
              </div>
            </div>
            <p className="mt-2 text-xs text-ink-soft">
              {settings.commissionEnabled
                ? "Η προμήθεια είναι ενεργή στην πλατφόρμα: εφαρμόζεται σε νέες παραγγελίες μετά τη λήξη της δωρεάν περιόδου."
                : "Η προμήθεια είναι απενεργοποιημένη για όλη την πλατφόρμα (Ρυθμίσεις) — όλες οι παραγγελίες καταγράφονται με 0%."}
            </p>
          </fieldset>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isDemo" defaultChecked={b.isDemo} /> Δοκιμαστικό κατάστημα (εμφανίζει σήμανση «ΔΟΚΙΜΑΣΤΙΚΟ»)
          </label>
          <SubmitButton>Αποθήκευση</SubmitButton>
        </ActionForm>

        <div className="space-y-6">
          <div className="card p-4">
            <h2 className="font-bold">Λογαριασμοί καταστήματος</h2>
            <ul className="mt-2 space-y-2">
              {staff.map((u) => (
                <li key={u.id} className="rounded-xl border border-line p-2 text-sm">
                  <p className="font-medium">{u.email}</p>
                  <p className="text-xs text-ink-soft">Τελ. σύνδεση: {u.lastLoginAt ? formatAthens(u.lastLoginAt) : "ποτέ"}</p>
                  <ActionForm action={updateStaffUserAction} className="mt-2 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="active" defaultChecked={u.active} /> Ενεργός
                    </label>
                    <input name="password" type="password" autoComplete="new-password" placeholder="Νέος κωδικός (προαιρ.)" className="input !w-48 !py-1.5" />
                    <SubmitButton className="btn-ghost !px-2.5 !py-1.5 text-xs">Αποθήκευση</SubmitButton>
                  </ActionForm>
                </li>
              ))}
              {!staff.length && <li className="text-sm text-ink-soft">Κανένας λογαριασμός ακόμη.</li>}
            </ul>
            <ActionForm action={createStaffUserAction} className="mt-3 space-y-2 border-t border-line pt-3" resetOnSuccess>
              <input type="hidden" name="role" value="business" />
              <input type="hidden" name="businessId" value={b.id} />
              <input name="email" type="email" required placeholder="Email" className="input" aria-label="Email" />
              <input name="name" placeholder="Όνομα (προαιρ.)" className="input" aria-label="Όνομα" />
              <input name="password" type="password" autoComplete="new-password" required minLength={10} placeholder="Αρχικός κωδικός (10+ χαρακτήρες)" className="input" aria-label="Κωδικός" />
              <SubmitButton className="btn-dark">Δημιουργία λογαριασμού</SubmitButton>
            </ActionForm>
          </div>

          <div className="card p-4">
            <h2 className="font-bold">Περιοχές διανομής</h2>
            <ul className="mt-2 space-y-2">
              {zones.map((z) => (
                <li key={z.id}>
                  <ActionForm action={adminZoneAction} className="flex flex-wrap items-center gap-2 text-sm">
                    <input type="hidden" name="businessId" value={b.id} />
                    <input type="hidden" name="id" value={z.id} />
                    <input name="name" defaultValue={z.name} className="input !py-1.5 min-w-32 flex-1" aria-label="Περιοχή" />
                    <input name="fee" defaultValue={centsToInput(z.feeCents)} className="input !w-20 !py-1.5" aria-label="Κόστος" />
                    <input name="minOrder" defaultValue={centsToInput(z.minOrderCents)} className="input !w-20 !py-1.5" aria-label="Ελάχιστη" />
                    <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={z.active} /> Ενεργή</label>
                    <SubmitButton className="btn-ghost !px-2 !py-1.5 text-xs">OK</SubmitButton>
                    <button name="delete" value="1" className="text-xs text-danger underline">Διαγραφή</button>
                  </ActionForm>
                </li>
              ))}
            </ul>
            <ActionForm action={adminZoneAction} className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3 text-sm" resetOnSuccess>
              <input type="hidden" name="businessId" value={b.id} />
              <input name="name" required placeholder="Νέα περιοχή" className="input !py-1.5 min-w-32 flex-1" aria-label="Νέα περιοχή" />
              <input name="fee" placeholder="Κόστος" className="input !w-20 !py-1.5" aria-label="Κόστος" />
              <input name="minOrder" placeholder="Ελάχ." className="input !w-20 !py-1.5" aria-label="Ελάχιστη" />
              <SubmitButton className="btn-dark !py-1.5">+</SubmitButton>
            </ActionForm>
          </div>

          <ActionForm action={deleteBusinessAction} confirm="Οριστική διαγραφή του καταστήματος;" className="card p-4">
            <input type="hidden" name="id" value={b.id} />
            <h2 className="font-bold text-danger">Διαγραφή</h2>
            <p className="text-xs text-ink-soft">Επιτρέπεται μόνο αν δεν υπάρχουν παραγγελίες. Αλλιώς ορίστε «Ανενεργό» ή «Σε αναστολή».</p>
            <button className="btn-danger mt-2 !py-1.5 text-sm">Διαγραφή καταστήματος</button>
          </ActionForm>
        </div>
      </div>
    </div>
  );
}
