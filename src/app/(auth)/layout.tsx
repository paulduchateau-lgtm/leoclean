import Link from "next/link";

import { SITE } from "@/lib/site";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-secondary/40">
      <header className="px-6 py-6">
        <Link href="/" className="text-xl font-extrabold">
          {SITE.name}
        </Link>
      </header>

      <main className="flex flex-1 items-start justify-center px-6 pb-16">
        <div className="w-full max-w-sm rounded-xl border border-border bg-card p-8 shadow-sm">
          {children}
        </div>
      </main>
    </div>
  );
}
