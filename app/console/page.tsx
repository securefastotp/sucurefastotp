import { CatalogConsole } from "@/components/catalog-console";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getBalance, getRuntimeStatus } from "@/lib/provider";

export const dynamic = "force-dynamic";

export default async function ConsolePage() {
  const runtime = await getRuntimeStatus();
  const balance = await getBalance().catch(() => null);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="section-shell py-8 sm:py-10">
        <div className="mb-6 panel p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
            Console Supplier
          </p>
          <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
            Kelola stok, ambil nomor, dan pantau OTP secara live.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-ink/68">
            Halaman ini dipakai untuk menguji supply upstream Anda. Saat env
            provider belum diisi, console otomatis memakai mock mode agar alur
            order tetap bisa dicoba end-to-end.
          </p>
        </div>

        <CatalogConsole initialRuntime={runtime} initialBalance={balance} />
      </main>
      <SiteFooter />
    </div>
  );
}
