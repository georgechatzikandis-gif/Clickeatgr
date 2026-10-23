import type { Metadata } from "next";
import { saveHoursAction, saveProfileAction, saveZoneAction, uploadBusinessImageAction } from "@/app/actions/business";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ImageInput } from "@/components/image-input";
import { WEEKDAYS_EL } from "@/lib/hours";
import { centsToInput } from "@/lib/money";
import { requireBusinessPage } from "@/server/auth";
import { getBusinessSettings } from "@/server/business-data";

export const metadata: Metadata = { title: "Ρυθμίσεις" };

export default async function SettingsPage() {
  const user = await requireBusinessPage();
  const { business: b, hours, zones } = await getBusinessSettings(user.businessId);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4">
        <h1 className="text-xl font-bold">Ρυθμίσεις καταστήματος</h1>
        <ActionForm action={saveProfileAction} className="card space-y-3 p-4">
          <h2 className="font-bold">Στοιχεία & παραλαβή</h2>
          <div>
            <label className="label" htmlFor="desc">Περιγραφή</label>
            <textarea id="desc" name="description" rows={2} maxLength={500} defaultValue={b.description} className="input" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="phone">Τηλέφωνο (εμφανίζεται στον πελάτη)</label>
              <input id="phone" name="phone" maxLength={30} defaultValue={b.phone} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" name="email" type="email" maxLength={120} defaultValue={b.email} className="input" />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="address">Διεύθυνση καταστήματος</label>
            <input id="address" name="address" maxLength={200} defaultValue={b.address} className="input" />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="prep">Προετοιμασία (λεπτά)</label>
              <input id="prep" name="prepTimeMinutes" type="number" min={0} max={240} defaultValue={b.prepTimeMinutes} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="deltime">Διανομή (λεπτά)</label>
              <input id="deltime" name="deliveryTimeMinutes" type="number" min={0} max={240} defaultValue={b.deliveryTimeMinutes} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="pmin">Ελάχ. παραλαβής (€)</label>
              <input id="pmin" name="pickupMinOrder" inputMode="decimal" defaultValue={centsToInput(b.pickupMinOrderCents)} className="input" />
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-sm font-medium">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="acceptsDelivery" defaultChecked={b.acceptsDelivery} className="h-4 w-4 accent-amber-500" /> Διανομή
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" name="acceptsPickup" defaultChecked={b.acceptsPickup} className="h-4 w-4 accent-amber-500" /> Παραλαβή από το κατάστημα
            </label>
          </div>
          <SubmitButton>Αποθήκευση</SubmitButton>
        </ActionForm>

        <div className="card grid gap-4 p-4 sm:grid-cols-2">
          {(["logo", "cover"] as const).map((kind) => {
            const img = kind === "logo" ? b.logoImageId : b.coverImageId;
            return (
              <ActionForm key={kind} action={uploadBusinessImageAction} className="space-y-2">
                <h2 className="font-bold">{kind === "logo" ? "Λογότυπο" : "Φωτογραφία εξωφύλλου"}</h2>
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/img/${img}`} alt="" className={kind === "logo" ? "h-20 w-20 rounded-xl object-cover" : "aspect-[16/9] w-full rounded-xl object-cover"} />
                )}
                <input type="hidden" name="kind" value={kind} />
                <ImageInput name="image" label="Επιλογή εικόνας" />
                <SubmitButton className="btn-dark !py-2 text-sm">Ανέβασμα</SubmitButton>
              </ActionForm>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <ActionForm action={saveHoursAction} className="card p-4">
          <h2 className="font-bold">Ωράριο λειτουργίας</h2>
          <p className="text-xs text-ink-soft">
            Ώρα Ελλάδας. Αφήστε κενό για κλειστά. Αν το κλείσιμο είναι μετά τα μεσάνυχτα (π.χ. 18:00–02:00) συνεχίζει στην επόμενη μέρα. 00:00–00:00 = 24ωρο.
          </p>
          <div className="mt-3 space-y-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const ranges = hours.filter((h) => h.weekday === d).sort((a, z) => a.opensAt.localeCompare(z.opensAt));
              return (
                <div key={d} className="grid grid-cols-[84px_1fr] items-center gap-2 text-sm">
                  <span className="font-medium">{WEEKDAYS_EL[d]}</span>
                  <div className="flex flex-wrap gap-2">
                    {[0, 1].map((n) => (
                      <span key={n} className="flex items-center gap-1">
                        <input type="time" name={`h${d}_${n}_open`} defaultValue={ranges[n]?.opensAt.slice(0, 5)} className="input !w-auto !px-2 !py-1" aria-label={`${WEEKDAYS_EL[d]} άνοιγμα ${n + 1}`} />
                        –
                        <input type="time" name={`h${d}_${n}_close`} defaultValue={ranges[n]?.closesAt.slice(0, 5)} className="input !w-auto !px-2 !py-1" aria-label={`${WEEKDAYS_EL[d]} κλείσιμο ${n + 1}`} />
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <SubmitButton>Αποθήκευση ωραρίου</SubmitButton>
          </div>
        </ActionForm>

        <div className="card p-4">
          <h2 className="font-bold">Περιοχές διανομής</h2>
          <p className="text-xs text-ink-soft">Ο πελάτης επιλέγει περιοχή στο ταμείο. Κάθε περιοχή έχει δικό κόστος διανομής και ελάχιστη παραγγελία.</p>
          <ul className="mt-3 space-y-2">
            {zones.map((z) => (
              <li key={z.id}>
                <ActionForm action={saveZoneAction} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2 text-sm">
                  <input type="hidden" name="id" value={z.id} />
                  <input name="name" defaultValue={z.name} maxLength={80} className="input !py-1.5 min-w-36 flex-1" aria-label="Περιοχή" />
                  <label className="flex items-center gap-1">Κόστος <input name="fee" defaultValue={centsToInput(z.feeCents)} inputMode="decimal" className="input !w-20 !py-1.5" /></label>
                  <label className="flex items-center gap-1">Ελάχ. <input name="minOrder" defaultValue={centsToInput(z.minOrderCents)} inputMode="decimal" className="input !w-20 !py-1.5" /></label>
                  <input type="hidden" name="sortOrder" value={z.sortOrder} />
                  <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={z.active} /> Ενεργή</label>
                  <SubmitButton className="btn-ghost !px-2.5 !py-1.5 text-xs">Αποθήκευση</SubmitButton>
                  <button name="delete" value="1" className="text-xs text-danger underline">Διαγραφή</button>
                </ActionForm>
              </li>
            ))}
          </ul>
          <ActionForm action={saveZoneAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-line pt-3 text-sm" resetOnSuccess>
            <div className="min-w-36 flex-1">
              <label className="label" htmlFor="z-name">Νέα περιοχή</label>
              <input id="z-name" name="name" required maxLength={80} placeholder="π.χ. Φαληράκι" className="input !py-1.5" />
            </div>
            <div>
              <label className="label" htmlFor="z-fee">Κόστος €</label>
              <input id="z-fee" name="fee" inputMode="decimal" placeholder="1,50" className="input !w-20 !py-1.5" />
            </div>
            <div>
              <label className="label" htmlFor="z-min">Ελάχ. €</label>
              <input id="z-min" name="minOrder" inputMode="decimal" placeholder="10,00" className="input !w-20 !py-1.5" />
            </div>
            <input type="hidden" name="sortOrder" value={zones.length} />
            <SubmitButton className="btn-dark !py-1.5">Προσθήκη</SubmitButton>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
