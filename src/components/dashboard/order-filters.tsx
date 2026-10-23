import Link from "next/link";
import { STATUS_LABELS } from "@/lib/order-status";

export function OrderFilters({
  raw,
  businesses,
}: {
  raw: { from: string; to: string; status: string; business: string };
  businesses?: { id: string; name: string }[];
}) {
  return (
    <form className="mb-4 flex flex-wrap items-end gap-2" method="get">
      {businesses && (
        <div>
          <label className="label" htmlFor="business">Κατάστημα</label>
          <select id="business" name="business" defaultValue={raw.business} className="input !py-2">
            <option value="">Όλα</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label" htmlFor="from">Από</label>
        <input id="from" name="from" type="date" defaultValue={raw.from} className="input !py-2" />
      </div>
      <div>
        <label className="label" htmlFor="to">Έως</label>
        <input id="to" name="to" type="date" defaultValue={raw.to} className="input !py-2" />
      </div>
      <div>
        <label className="label" htmlFor="status">Κατάσταση</label>
        <select id="status" name="status" defaultValue={raw.status} className="input !py-2">
          <option value="">Όλες</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <button className="btn-dark">Φίλτρο</button>
      <Link href="?" className="btn-ghost">Καθαρισμός</Link>
    </form>
  );
}
