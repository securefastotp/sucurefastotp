import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { formatCurrency } from "@/lib/format";
import {
  apiCapabilities,
  platformMetrics,
  supplierBenefits,
  workflowSteps,
} from "@/lib/marketing";
import { getCatalog } from "@/lib/provider";
import { siteConfig } from "@/lib/site-config";

export const dynamic = "force-dynamic";

export default async function Home() {
  const featuredCatalog = await getCatalog({
    serverId: "bimasakti",
    countryId: 6,
  }).catch(() => null);
  const featuredServices = featuredCatalog?.services.slice(0, 6) ?? [];
  const supportedServices = [...new Set(featuredServices.map((service) => service.service))];
  const baseUrl = siteConfig.url.replace(/\/$/, "");

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="pb-20">
        <section className="section-shell pt-8 pb-14 sm:pt-12 sm:pb-18">
          <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-stretch">
            <div className="panel relative overflow-hidden p-7 sm:p-10">
              <div className="absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top_left,_rgba(255,107,61,0.28),_transparent_55%),radial-gradient(circle_at_top_right,_rgba(11,143,119,0.18),_transparent_45%)]" />
              <div className="relative space-y-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-ink/70">
                  Supplier OTP White-label
                </div>
                <div className="space-y-4">
                  <h1 className="max-w-3xl font-display text-5xl leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
                    Bangun website OTP sendiri, ambil supply via API key.
                  </h1>
                  <p className="max-w-2xl text-lg leading-8 text-ink/72 sm:text-xl">
                    Website ini sekarang membaca katalog real dari KirimKode,
                    menampilkan harga jual markup 100%, lalu memproses order
                    setelah pembayaran Midtrans berhasil.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link className="hero-button" href="/console">
                    Buka Console Supplier
                  </Link>
                  <Link className="hero-button-muted" href="/docs">
                    Lihat Docs & Env
                  </Link>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  {platformMetrics.map((metric) => (
                    <div
                      key={metric.label}
                      className="rounded-[24px] border border-ink/8 bg-white/72 p-4 shadow-[0_20px_40px_-32px_rgba(19,34,54,0.5)] backdrop-blur"
                    >
                      <p className="text-3xl font-display font-semibold text-ink">
                        {metric.value}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-ink/65">
                        {metric.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="panel p-6 sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
                      Relay API
                    </p>
                    <h2 className="mt-2 font-display text-2xl text-ink">
                      Arsitektur supplier yang siap dijual ulang
                    </h2>
                  </div>
                  <div className="rounded-full bg-brand px-3 py-1 text-sm font-semibold text-white">
                    Vercel Ready
                  </div>
                </div>
                <div className="mt-6 space-y-4">
                  {apiCapabilities.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-[22px] border border-ink/8 bg-paper px-5 py-4"
                    >
                      <p className="font-display text-lg text-ink">{item.title}</p>
                      <p className="mt-1 text-sm leading-6 text-ink/68">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel p-6 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-2">
                      Preview API
                    </p>
                    <h2 className="mt-2 font-display text-2xl text-ink">
                      Route internal untuk website Anda
                    </h2>
                  </div>
                </div>
                <pre className="code-block mt-5 overflow-x-auto text-sm">
{`curl "${baseUrl}/api/catalog?server=bimasakti&countryId=6"

curl -X POST ${baseUrl}/api/orders \\
  -H "Content-Type: application/json" \\
  -d '{"serviceId":"bimasakti-6-wa","serviceCode":"wa","serverId":"bimasakti","service":"WhatsApp","country":"Indonesia","countryId":6,"price":3000,"currency":"IDR"}'

curl ${baseUrl}/api/orders/order_xxxxx`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        <section className="section-shell py-8">
          <div className="panel overflow-hidden p-6 sm:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ink/55">
                  Layanan populer
                </p>
                <h2 className="mt-2 font-display text-3xl text-ink">
                  Stok dan harga real dari katalog KirimKode
                </h2>
              </div>
              <p className="max-w-2xl text-sm leading-7 text-ink/68">
                Harga jual di website ini dihitung otomatis dengan markup 100%
                dari harga upstream.
              </p>
            </div>

            {featuredServices.length > 0 ? (
              <div className="mt-8 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {featuredServices.map((service) => (
                  <div
                    key={service.id}
                    className="rounded-[24px] border border-ink/8 bg-white/80 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
                          {service.category}
                        </p>
                        <h3 className="mt-2 font-display text-2xl text-ink">
                          {service.service}
                        </h3>
                        <p className="mt-1 text-sm text-ink/65">
                          {service.country} | code {service.serviceCode}
                        </p>
                      </div>
                      <div className="rounded-full bg-ink px-3 py-1 text-sm font-semibold text-white">
                        {service.stock} stok
                      </div>
                    </div>

                    <div className="mt-5 flex items-end justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-ink/45">
                          Harga jual
                        </p>
                        <p className="mt-1 font-display text-3xl text-ink">
                          {formatCurrency(service.price, service.currency)}
                        </p>
                      </div>
                      <div className="text-right text-sm leading-6 text-ink/55">
                        <p>
                          Modal {formatCurrency(service.upstreamPrice, service.currency)}
                        </p>
                        <p>{service.tags.join(" | ")}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-8 rounded-[24px] border border-ink/8 bg-white/80 px-5 py-6 text-sm leading-7 text-ink/68">
                Katalog real KirimKode sedang kosong atau belum merespons, jadi
                preview layanan di landing page belum bisa ditampilkan.
              </div>
            )}

            {supportedServices.length > 0 ? (
              <div className="mt-8 flex flex-wrap gap-3">
                {supportedServices.map((service) => (
                  <span
                    key={service}
                    className="rounded-full border border-ink/10 bg-paper px-4 py-2 text-sm font-medium text-ink/75"
                  >
                    {service}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="section-shell py-8">
          <div className="grid gap-5 lg:grid-cols-3">
            {supplierBenefits.map((benefit) => (
              <div key={benefit.title} className="panel p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
                  {benefit.kicker}
                </p>
                <h2 className="mt-3 font-display text-2xl text-ink">
                  {benefit.title}
                </h2>
                <p className="mt-3 text-sm leading-7 text-ink/68">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="section-shell py-8">
          <div className="panel p-6 sm:p-8">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-2">
                Cara kerja
              </p>
              <h2 className="mt-2 font-display text-3xl text-ink">
                Dari provider upstream ke website Anda dalam 3 langkah
              </h2>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {workflowSteps.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-[26px] border border-ink/8 bg-white/75 p-5"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white">
                    0{index + 1}
                  </div>
                  <h3 className="mt-5 font-display text-2xl text-ink">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-ink/68">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section-shell pt-8">
          <div className="panel overflow-hidden bg-ink p-8 text-white sm:p-10">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">
                  Siap Deploy
                </p>
                <h2 className="mt-3 font-display text-4xl leading-tight">
                  Push ke GitHub, sambungkan ke Vercel, lalu isi env provider.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-white/70">
                  Project ini sudah disusun untuk flow yang Anda minta: katalog
                  real dari KirimKode, payment Midtrans, dan order OTP live
                  dari website Anda sendiri.
                </p>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/6 p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/55">
                  Deployment Checklist
                </p>
                <div className="mt-4 space-y-3 text-sm leading-7 text-white/78">
                  <p>1. Upload folder ini ke repository GitHub baru.</p>
                  <p>2. Import project ke Vercel sebagai Next.js app.</p>
                  <p>3. Isi `UPSTREAM_*` env dan atur domain brand Anda.</p>
                  <p>4. Gunakan `/console` untuk tes order nomor secara live.</p>
                </div>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                  <Link className="hero-button-light" href="/docs">
                    Buka Dokumentasi
                  </Link>
                  <Link className="hero-button-outline" href="/console">
                    Tes Console
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
