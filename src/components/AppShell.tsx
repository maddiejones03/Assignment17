import Link from "next/link";
import { AppNav } from "@/components/AppNav";
import { BackButton } from "@/components/BackButton";

export function AppShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-100 to-zinc-200/80 dark:from-zinc-950 dark:to-zinc-900">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <header className="mb-8 rounded-2xl border border-zinc-200/80 bg-white/90 p-5 shadow-sm ring-1 ring-zinc-950/5 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90 dark:ring-white/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <span aria-hidden>⌂</span>
                Home
              </Link>
              <BackButton />
            </div>
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              ML pipeline · shop ops
            </p>
          </div>
          <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <AppNav />
          </div>
        </header>

        <main className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-md ring-1 ring-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900/80 dark:ring-white/10 sm:p-8">
          <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-3xl">
            {title}
          </h1>
          {children}
        </main>

        <footer className="mt-8 text-center text-xs text-zinc-500 dark:text-zinc-500">
          Assignment 17 · Deployed pipeline demo
        </footer>
      </div>
    </div>
  );
}
