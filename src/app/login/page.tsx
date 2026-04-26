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
    <main className="grid min-h-screen place-items-center bg-[#eef1f4] px-5 py-10">
      <form action={login} className="panel grid w-full max-w-md gap-4 p-6">
        <div>
          <div className="text-xs font-black uppercase text-[#7b2636]">SARP PM</div>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-[#20262d]">Sign in</h1>
          <p className="mt-2 text-sm font-semibold text-[#687482]">Use your company account to access projects, costs, and reports.</p>
        </div>
        {error ? (
          <div className="rounded-lg border border-[#e0b7c0] bg-[#f9eef1] px-3 py-2 text-sm font-bold text-[#7b2636]">
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
