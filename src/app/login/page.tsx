import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { error } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-white px-5 py-10">
      <form action={login} className="panel grid w-full max-w-md gap-4 p-8 shadow-[0_16px_34px_rgba(55,52,85,0.10)]">
        <div>
          <div className="mb-6 border-b border-line pb-6">
            <img src="/brand/sarp-logo.png" alt="SARP Building the Future" className="h-auto w-48 max-w-full" />
          </div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy">SARP · LAB</div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.02em] text-ink">Sign in</h1>
          <p className="mt-2 text-sm text-muted">Use your company account to access projects, costs, and reports.</p>
        </div>
        {error ? (
          <div className="rounded-lg border border-[#f3cdd9] bg-[#fdeef2] px-3 py-2 text-sm font-semibold text-lab-burgundy">
            Email or password is incorrect.
          </div>
        ) : null}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" placeholder="admin@sarp.local" />
        </label>
        <label>
          Password
          <input name="password" type="password" required autoComplete="current-password" placeholder="Enter password" />
        </label>
        <button className="btn btn-primary" type="submit">Sign in</button>
      </form>
    </main>
  );
}
