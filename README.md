# SupplyOTP

Website supplier OTP siap deploy ke GitHub + Vercel.

Project ini dibuat sebagai template untuk model bisnis seperti `kirimkode.com`, tetapi diposisikan sebagai website supplier/reseller Anda sendiri. Aplikasi sudah berisi:

- landing page brandable
- halaman `/console` untuk cari service, order nomor, cek OTP, dan cancel
- route internal `/api/catalog`, `/api/balance`, `/api/history`, `/api/orders`, `/api/orders/:id`, `/api/health`
- adapter upstream berbasis `API key`
- `mock mode` agar website tetap bisa ditest sebelum provider asli disambungkan

## Jalankan Lokal

```bash
npm install
npm run dev
```

Salin `.env.example` menjadi `.env.local`, lalu isi credential provider Anda.

## Environment Penting

```bash
NEXT_PUBLIC_SITE_NAME=SupplyOTP
NEXT_PUBLIC_SITE_URL=http://localhost:3000

UPSTREAM_PROVIDER_MODE=rest
UPSTREAM_BASE_URL=https://provider-anda.example.com/api
UPSTREAM_API_KEY=isi_api_key_anda
UPSTREAM_API_KEY_HEADER=x-api-key
UPSTREAM_BALANCE_PATH=/balance
UPSTREAM_SERVICES_PATH=/services
UPSTREAM_HISTORY_PATH=/orders/history
UPSTREAM_ORDER_PATH=/orders
UPSTREAM_ORDER_STATUS_PATH=/orders/{id}
UPSTREAM_CANCEL_PATH=/orders/{id}/cancel
UPSTREAM_ORDER_METHOD=POST
UPSTREAM_CANCEL_METHOD=POST
UPSTREAM_MARKUP_PERCENT=15
UPSTREAM_MIN_MARGIN=500
UPSTREAM_CURRENCY=IDR
UPSTREAM_TIMEOUT_MS=15000
```

## Deploy ke GitHub + Vercel

1. Buat repository GitHub baru.
2. Upload seluruh isi folder ini ke repository tersebut.
3. Import repository ke Vercel.
4. Tambahkan semua environment variables di dashboard Vercel.
5. Deploy, lalu tes `/api/health` dan halaman `/console`.

## Catatan Produksi

- Jika format API provider berbeda, cukup ubah env path atau sesuaikan normalizer di `lib/provider.ts`.
- Saat `UPSTREAM_PROVIDER_MODE=mock`, aplikasi memakai data demo dan order in-memory.
- Untuk production volume tinggi, simpan context order ke database atau Redis agar status order tetap stabil antar serverless instance.
- Berdasarkan aset publik KirimKode, dokumentasi mereka menyinggung endpoint untuk balance, services, countries, order, status, cancel, dan history. Contoh request detailnya tetap login-protected, jadi path exact perlu Anda samakan dari akun Anda sendiri.
