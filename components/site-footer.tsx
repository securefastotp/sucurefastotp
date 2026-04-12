import Link from "next/link";
import { siteConfig } from "@/lib/site-config";

export function SiteFooter() {
  return (
    <footer className="section-shell mt-10 pb-10">
      <div className="panel px-6 py-6 sm:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="font-display text-2xl text-ink">{siteConfig.name}</p>
            <p className="mt-2 max-w-xl text-sm leading-7 text-ink/65">
              Website supplier OTP dengan landing page, dashboard supply, dan
              server route aman untuk integrasi provider upstream via API key.
            </p>
          </div>
          <div className="flex gap-5 text-sm font-medium text-ink/70">
            <Link href="/">Home</Link>
            <Link href="/console">Console</Link>
            <Link href="/docs">Docs</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
