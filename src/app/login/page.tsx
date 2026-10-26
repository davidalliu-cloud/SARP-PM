import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { LanguageToggle } from "@/components/LanguageToggle";
import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const { error } = await searchParams;
  const t = await getT();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] px-4 py-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-lg border border-line bg-white shadow-sm md:grid-cols-[1fr_420px]">
        {/* Brand panel */}
        <div className="hidden bg-lab-burgundy p-10 text-white md:flex md:flex-col md:justify-between">
          <div>
            <img src="/brand/sarp-logo.png" alt="SARP" className="h-auto w-52 brightness-0 invert" />
            <h1 className="mt-10 text-3xl font-semibold tracking-tight">{t("login.heroTitle")}</h1>
            <p className="mt-4 max-w-md text-sm leading-6 text-white/80">{t("login.heroBody")}</p>
          </div>
          <div className="text-xs text-white/70">{t("login.heroCaption")}</div>
        </div>

        {/* Sign-in form */}
        <div className="p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="md:hidden">
              <img src="/brand/sarp-logo.png" alt="SARP" className="h-auto w-36" />
            </div>
            <div className="ml-auto">
              <LanguageToggle />
            </div>
          </div>
          <div className="mt-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-lab-burgundy md:mt-0">
            {t("brand.eyebrow")}
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{t("login.signInTitle")}</h2>
          <p className="mt-2 text-sm text-muted">{t("login.signInHint")}</p>

          {error ? (
            <div className="mt-6 rounded-md border border-[#f3cdd9] bg-[#fdeef2] p-3 text-sm font-semibold text-lab-burgundy">
              {t("login.invalid")}
            </div>
          ) : null}

          <form action={login} className="mt-8 grid gap-5">
            <label>
              {t("login.email")}
              <input name="email" type="email" required autoComplete="email" placeholder="admin@sarp.local" />
            </label>
            <label>
              {t("login.password")}
              <input name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
            </label>
            <button className="btn btn-primary w-full" type="submit">{t("login.signIn")}</button>
          </form>
        </div>
      </section>
    </main>
  );
}
