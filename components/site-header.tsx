import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/console", label: "Console" },
  { href: "/docs", label: "Docs" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40">
      <div className="section-shell py-5">
        <div className="flex items-center justify-between gap-4 rounded-full border border-black/6 bg-white/75 px-4 py-3 shadow-[0_20px_60px_-42px_rgba(19,34,54,0.75)] backdrop-blur sm:px-6">
          <Link className="flex items-center gap-3" href="/">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-ink font-display text-sm font-semibold text-white">
              SO
            </div>
            <div>
              <p className="font-display text-lg font-semibold text-ink">
                {siteConfig.name}
              </p>
              <p className="text-xs uppercase tracking-[0.18em] text-ink/48">
                Supplier OTP Hub
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-ink/72 md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <Link className="hero-button hidden sm:inline-flex" href="/console">
            Mulai Test API
          </Link>
        </div>
      </div>
    </header>
  );
}
