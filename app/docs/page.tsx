import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { siteConfig } from "@/lib/site-config";

const envFields = [
  {
    name: "NEXT_PUBLIC_SITE_NAME",
    required: "No",
    description: "Nama brand yang muncul di website.",
  },
  {
    name: "NEXT_PUBLIC_SITE_URL",
    required: "No",
    description: "URL public website Anda untuk contoh API dan metadata.",
  },
  {
    name: "UPSTREAM_PROVIDER_MODE",
    required: "No",
    description: "Isi `rest` untuk provider asli atau biarkan `mock` untuk demo.",
  },
  {
    name: "UPSTREAM_BASE_URL",
    required: "Ya",
    description: "Base URL provider supply upstream Anda.",
  },
  {
    name: "UPSTREAM_API_KEY",
    required: "Ya",
    description: "API key provider upstream. Disimpan aman di server Vercel.",
  },
  {
    name: "UPSTREAM_API_KEY_HEADER",
    required: "No",
    description: "Header auth upstream. Default `x-api-key`.",
  },
  {
    name: "UPSTREAM_BALANCE_PATH",
    required: "No",
    description: "Path endpoint cek saldo upstream. Default `/balance`.",
  },
  {
    name: "UPSTREAM_SERVICES_PATH",
    required: "No",
    description: "Path endpoint katalog layanan. Default `/services`.",
  },
  {
    name: "UPSTREAM_HISTORY_PATH",
    required: "No",
    description: "Path endpoint riwayat order upstream. Default `/orders/history`.",
  },
  {
    name: "UPSTREAM_ORDER_PATH",
    required: "No",
    description: "Path endpoint buat order. Default `/orders`.",
  },
  {
    name: "UPSTREAM_ORDER_STATUS_PATH",
    required: "No",
    description: "Path endpoint cek status order. Gunakan `{id}` atau `:id`.",
  },
  {
    name: "UPSTREAM_CANCEL_PATH",
    required: "No",
    description: "Path endpoint cancel order. Gunakan `{id}` atau `:id`.",
  },
  {
    name: "UPSTREAM_ORDER_METHOD",
    required: "No",
    description: "Method order upstream. Default `POST`.",
  },
  {
    name: "UPSTREAM_CANCEL_METHOD",
    required: "No",
    description: "Method cancel upstream. Default `POST` atau ubah `DELETE`.",
  },
  {
    name: "UPSTREAM_MARKUP_PERCENT",
    required: "No",
    description: "Persentase markup jual di atas harga modal.",
  },
  {
    name: "UPSTREAM_MIN_MARGIN",
    required: "No",
    description: "Margin minimum dalam rupiah agar harga jual tetap aman.",
  },
];

const baseUrl = siteConfig.url.replace(/\/$/, "");

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="section-shell py-8 sm:py-10">
        <section className="panel p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
            Dokumentasi
          </p>
          <h1 className="mt-3 font-display text-4xl text-ink sm:text-5xl">
            Cara menyambungkan supplier website ini ke provider upstream.
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-ink/68">
            Template ini memakai server route internal sebagai relay, jadi API
            key provider tetap aman. Browser pelanggan hanya bicara ke endpoint
            website Anda sendiri.
          </p>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-ink/58">
            Catatan: pada pengecekan publik tanggal 12 April 2026, halaman
            `https://kirimkode.com/api-docs` diarahkan ke login. Dari aset
            publiknya tetap terlihat bahwa API docs mereka mencakup balance,
            services, countries, order, status, cancel, dan history.
          </p>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.05fr]">
          <div className="panel p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-2">
              Alur integrasi
            </p>
            <div className="mt-5 space-y-4 text-sm leading-7 text-ink/72">
              <p>1. User membuka website Anda dan memilih layanan OTP.</p>
              <p>
                2. Browser memanggil route internal seperti `/api/catalog`,
                `/api/balance`, `/api/history`, atau `/api/orders`.
              </p>
              <p>
                3. Route server Next.js menambahkan `API key` dan meneruskan
                request ke provider upstream.
              </p>
              <p>
                4. Response upstream dinormalisasi agar UI Anda tetap konsisten
                meski format provider berubah.
              </p>
              <p>
                5. Markup supplier diterapkan di server agar harga jual aman dan
                mudah diatur dari env.
              </p>
            </div>

            <pre className="code-block mt-6 overflow-x-auto text-sm">
{`Browser -> /api/catalog -> Next.js Route -> Upstream Provider
Browser -> /api/balance -> Next.js Route -> Upstream Provider
Browser -> /api/history -> Next.js Route -> Upstream Provider
Browser -> /api/orders  -> Next.js Route -> Upstream Provider
Browser -> /api/orders/:id -> Next.js Route -> Upstream Provider`}
            </pre>
          </div>

          <div className="panel p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
              GitHub + Vercel
            </p>
            <div className="mt-5 space-y-4 text-sm leading-7 text-ink/72">
              <p>1. Buat repository baru, lalu upload isi folder ini.</p>
              <p>
                2. Import repository ke Vercel. Framework akan otomatis terbaca
                sebagai Next.js.
              </p>
              <p>
                3. Tambahkan semua env `UPSTREAM_*` di dashboard Vercel.
              </p>
              <p>
                4. Setelah deploy, uji endpoint `GET /api/health` dan halaman
                `/console`.
              </p>
              <p>
                5. Jika provider Anda punya path berbeda, sesuaikan env path
                tanpa perlu ubah kode utama.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link className="hero-button" href="/console">
                Uji Console
              </Link>
              <Link className="hero-button-muted" href="/">
                Kembali ke Landing
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-6 panel p-6 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
            Environment Variables
          </p>
          <div className="mt-6 overflow-hidden rounded-[24px] border border-ink/8">
            <div className="grid grid-cols-[1.2fr_100px_1.8fr] gap-px bg-ink/8 text-sm">
              <div className="bg-paper px-4 py-3 font-semibold text-ink">
                Nama
              </div>
              <div className="bg-paper px-4 py-3 font-semibold text-ink">
                Wajib
              </div>
              <div className="bg-paper px-4 py-3 font-semibold text-ink">
                Keterangan
              </div>
              {envFields.map((field) => (
                <div key={field.name} className="contents">
                  <div
                    className="bg-white px-4 py-3 font-mono text-xs text-ink"
                  >
                    {field.name}
                  </div>
                  <div
                    className="bg-white px-4 py-3 text-sm text-ink/72"
                  >
                    {field.required}
                  </div>
                  <div
                    className="bg-white px-4 py-3 text-sm leading-6 text-ink/72"
                  >
                    {field.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-2">
          <div className="panel p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-2">
              Example Request
            </p>
            <pre className="code-block mt-5 overflow-x-auto text-sm">
{`curl ${baseUrl}/api/catalog

curl ${baseUrl}/api/balance

curl ${baseUrl}/api/history

curl -X POST ${baseUrl}/api/orders \\
  -H "Content-Type: application/json" \\
  -d '{
    "serviceId": "wa-id",
    "service": "WhatsApp",
    "country": "Indonesia",
    "price": 2025,
    "currency": "IDR"
  }'

curl ${baseUrl}/api/orders/order_xxxxx

curl -X DELETE ${baseUrl}/api/orders/order_xxxxx`}
            </pre>
          </div>

          <div className="panel p-6 sm:p-8">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand">
              Example Response
            </p>
            <pre className="code-block mt-5 overflow-x-auto text-sm">
{`{
  "order": {
    "id": "order_g6t2xv9m",
    "serviceId": "wa-id",
    "service": "WhatsApp",
    "country": "Indonesia",
    "phoneNumber": "+6283821984456",
    "price": 2025,
    "currency": "IDR",
    "status": "pending",
    "createdAt": "2026-04-12T10:32:15.000Z",
    "expiresAt": "2026-04-12T10:52:15.000Z",
    "providerRef": "MOCK-99817"
  }
}`}
            </pre>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
