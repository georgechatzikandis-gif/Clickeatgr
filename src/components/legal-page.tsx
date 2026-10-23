export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-4 py-8 [&_h2]:mt-6 [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_p]:mt-2 [&_ul]:mt-2">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="rounded-lg bg-amber-50 p-2 text-sm text-brand-dark">
        Προσχέδιο — πρέπει να ελεγχθεί από νομικό σύμβουλο και να συμπληρωθούν τα στοιχεία της εταιρείας πριν τη λειτουργία.
      </p>
      {children}
    </article>
  );
}
