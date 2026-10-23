"use client";

import { useEffect, useRef, useState } from "react";
import { formatEuro } from "@/lib/money";
import type { OrderWithItems } from "@/server/business-data";
import { AutoRefresh } from "../auto-refresh";
import { OrderCard } from "./order-card";

/** Short two-tone chime generated with Web Audio (no sound file needed). */
function chime(ctx: AudioContext) {
  const t = ctx.currentTime;
  [880, 1175, 880, 1175].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.5, t + i * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + i * 0.18);
    osc.stop(t + i * 0.18 + 0.17);
  });
}

export function OrdersBoard({ orders, today }: { orders: OrderWithItems[]; today: { completed: number; totalCents: number } }) {
  const audio = useRef<AudioContext | null>(null);
  const [soundOn, setSoundOn] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(id);
  }, []);
  const pending = orders.filter((o) => o.status === "pending");
  const inProgress = orders.filter((o) => o.status !== "pending");

  const enableSound = async () => {
    audio.current ??= new AudioContext();
    await audio.current.resume();
    chime(audio.current);
    setSoundOn(true);
  };

  // Keep ringing every 8 seconds while there are orders waiting for acceptance.
  useEffect(() => {
    if (!pending.length) return;
    const ring = () => {
      if (audio.current?.state === "running") chime(audio.current);
      if ("vibrate" in navigator) navigator.vibrate?.([200, 100, 200]);
    };
    ring();
    const id = setInterval(ring, 8000);
    return () => clearInterval(id);
  }, [pending.length]);

  // Tab title shows the number of new orders (visible even when the tab is in the background).
  useEffect(() => {
    const base = "Παραγγελίες · ClickEat";
    if (!pending.length) {
      document.title = base;
      return;
    }
    let flip = false;
    const id = setInterval(() => {
      flip = !flip;
      document.title = flip ? `🔔 (${pending.length}) ΝΕΑ ΠΑΡΑΓΓΕΛΙΑ` : `(${pending.length}) ${base}`;
    }, 1000);
    return () => {
      clearInterval(id);
      document.title = base;
    };
  }, [pending.length]);

  return (
    <div>
      <AutoRefresh seconds={10} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!soundOn ? (
          <button type="button" onClick={enableSound} className="btn-primary animate-pulse">
            🔔 Ενεργοποίηση ήχου ειδοποιήσεων
          </button>
        ) : (
          <span className="rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-ok">🔔 Ήχος ενεργός</span>
        )}
        <span className="ml-auto text-sm text-ink-soft">
          Σήμερα: {today.completed} ολοκληρωμένες · {formatEuro(today.totalCents)}
        </span>
      </div>
      {!soundOn && (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-brand-dark">
          Πατήστε «Ενεργοποίηση ήχου» κάθε φορά που ανοίγετε αυτή τη σελίδα, για να ακούτε τις νέες παραγγελίες. Κρατήστε τη σελίδα ανοιχτή και την οθόνη αναμμένη.
        </p>
      )}

      <section aria-labelledby="new-orders">
        <h2 id="new-orders" className="mb-2 text-lg font-bold">
          Νέες παραγγελίες {pending.length > 0 && <span className="ml-1 rounded-full bg-brand px-2 text-ink">{pending.length}</span>}
        </h2>
        {pending.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {pending.map((o) => (
              <OrderCard key={o.id} order={o} now={now} />
            ))}
          </div>
        ) : (
          <p className="card p-6 text-center text-ink-soft">Καμία νέα παραγγελία. Η σελίδα ελέγχει αυτόματα κάθε 10 δευτερόλεπτα.</p>
        )}
      </section>

      <section aria-labelledby="active-orders" className="mt-8">
        <h2 id="active-orders" className="mb-2 text-lg font-bold">
          Σε εξέλιξη ({inProgress.length})
        </h2>
        {inProgress.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {inProgress.map((o) => (
              <OrderCard key={o.id} order={o} now={now} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Καμία παραγγελία σε εξέλιξη.</p>
        )}
      </section>
    </div>
  );
}
