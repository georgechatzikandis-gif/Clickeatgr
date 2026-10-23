import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions/auth";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/server/auth";

export const metadata: Metadata = { title: "Σύνδεση επιχειρήσεων" };

export default async function LoginPage(props: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/dashboard");
  const { next } = await props.searchParams;
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="card w-full max-w-sm p-6">
        <Logo className="h-6 w-auto" />
        <h1 className="mt-5 text-xl font-bold">Σύνδεση</h1>
        <p className="text-sm text-ink-soft">Για συνεργαζόμενα καταστήματα και διαχειριστές.</p>
        <ActionForm action={loginAction} className="mt-5 space-y-3">
          <input type="hidden" name="next" value={typeof next === "string" ? next : ""} />
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="username" required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="password">Κωδικός</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="input" />
          </div>
          <SubmitButton className="btn-dark w-full">Σύνδεση</SubmitButton>
        </ActionForm>
        <p className="mt-4 text-xs text-ink-soft">Ξεχάσατε τον κωδικό; Επικοινωνήστε με τον διαχειριστή του ClickEat.</p>
      </div>
    </div>
  );
}
