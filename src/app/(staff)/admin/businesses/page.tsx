import type { Metadata } from "next";
import Link from "next/link";
import { createBusinessAction } from "@/app/actions/admin";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { trialLabel } from "@/lib/commission";
import { requireAdminPage } from "@/server/auth";
import { listAllBusinesses, listAllRegions } from "@/server/admin-data";

export const metadata: Metadata = { title: "Καταστήματα" };

const STATUS = { active: ["Ενεργό", "bg-green-100 text-ok"], inactive: ["Ανενεργό", "bg-surface text-ink-soft"], suspended: ["Σε αναστολή", "bg-red-100 text-danger"] } as const;

export default async function BusinessesPage() {
  await requireAdminPage();
  const [list, regions] = await Promise.all([listAllBusinesses(), listAllRegions()]);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div>
        <h1 className="mb-3 text-xl font-bold">Καταστήματα ({list.length})</h1>
        <ul className="card divide-y divide-line">
          {list.map((b) => (
            <li key={b.id}>
              <Link href={`/admin/businesses/${b.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-surface">
                <span className="font-semibold">{b.name}</span>
                {b.isDemo && <span className="rounded bg-ink px-1.5 text-xs font-bold text-white">DEMO</span>}
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[b.status][1]}`}>{STATUS[b.status][0]}</span>
                <span className="text-xs text-ink-soft">{trialLabel(b.trialEndsAt)}</span>
                <span className="ml-auto text-sm text-ink-soft">{b.orderCount} παραγγελίες · {b.regionName}</span>
              </Link>
            </li>
          ))}
          {!list.length && <li className="p-6 text-center text-ink-soft">Δεν υπάρχουν καταστήματα ακόμη.</li>}
        </ul>
      </div>
      <aside>
        <ActionForm action={createBusinessAction} className="card space-y-3 p-4">
          <h2 className="font-bold">Νέο κατάστημα</h2>
          <div>
            <label className="label" htmlFor="nb-name">Όνομα *</label>
            <input id="nb-name" name="name" required maxLength={100} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="nb-slug">Διεύθυνση σελίδας (προαιρετικό)</label>
            <input id="nb-slug" name="slug" maxLength={60} placeholder="π.χ. souvlaki-nikos" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="nb-region">Περιοχή</label>
            <select id="nb-region" name="regionId" className="input">
              {regions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <SubmitButton>Δημιουργία</SubmitButton>
          <p className="text-xs text-ink-soft">Δημιουργείται ως «Ανενεργό» σε δωρεάν περίοδο. Ενεργοποιήστε το όταν ο κατάλογος είναι έτοιμος.</p>
        </ActionForm>
      </aside>
    </div>
  );
}
