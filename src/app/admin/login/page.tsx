"use client";

import {
  Suspense,
  useState,
} from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import AppShell from "@/components/shell/AppShell";

function AdminLoginForm() {
  const router =
    useRouter();
  const searchParams =
    useSearchParams();

  const [secret, setSecret] =
    useState("");
  const [busy, setBusy] =
    useState(false);
  const [message, setMessage] =
    useState<string | null>(null);

  async function login() {
    setBusy(true);
    setMessage(null);

    try {
      const response =
        await fetch(
          "/api/admin/session",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                secret,
              }),
          }
        );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.error ??
            "Unable to sign in"
        );
      }

      const requested =
        searchParams.get("next") ??
        "/admin/competitions";

      const destination =
        requested.startsWith("/admin/")
          ? requested
          : "/admin/competitions";

      router.replace(destination);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <main className="app-shell py-10">
        <section className="mx-auto max-w-lg rounded-[2rem] border border-slate-800 bg-slate-950 p-6 md:p-8">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-400">
            Closing Bell admin
          </div>
          <h1 className="mt-2 text-3xl font-black text-white">
            Admin sign in
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Sign in once to access the protected admin pages. The browser session lasts up to 12 hours.
          </p>

          <div className="mt-6 grid gap-3">
            <input
              type="password"
              value={secret}
              onChange={(event) =>
                setSecret(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" &&
                  secret &&
                  !busy
                ) {
                  login();
                }
              }}
              placeholder="Admin password"
              autoFocus
              className="min-h-12 rounded-xl border border-slate-700 bg-slate-900 px-4 text-sm text-white outline-none focus:border-violet-500"
            />

            <button
              type="button"
              onClick={login}
              disabled={
                busy || !secret
              }
              className="min-h-12 rounded-xl bg-violet-600 px-5 text-sm font-black text-white disabled:opacity-50"
            >
              {busy
                ? "Signing in…"
                : "Sign in"}
            </button>
          </div>

          {message && (
            <div className="mt-4 text-xs font-semibold text-red-300">
              {message}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
}


export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div>Loading admin sign in…</div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
