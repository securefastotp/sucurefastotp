# SecureFastOTP

Website supplier OTP siap deploy ke GitHub + Vercel.

Project ini dibuat sebagai template untuk model bisnis seperti `kirimkode.com`, tetapi diposisikan sebagai website supplier/reseller Anda sendiri. Aplikasi sudah berisi:

- landing page brandable
- halaman `/console` untuk cari service, order nomor, cek OTP, dan cancel
- route internal `/api/catalog`, `/api/balance`, `/api/history`, `/api/orders`, `/api/orders/:id`, `/api/payments`, `/api/payments/:id`, `/api/health`
- adapter upstream berbasis `API key`
- flow pembayaran Midtrans sebelum aktivasi order OTP
- `mock mode` agar website tetap bisa ditest sebelum provider asli disambungkan

## Jalankan Lokal

```bash
npm install
npm run dev
```

Salin `.env.example` menjadi `.env.local`, lalu isi credential provider Anda.

## Environment Penting

```bash
NEXT_PUBLIC_SITE_NAME=SecureFastOTP
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=isi_client_key_midtrans

UPSTREAM_PROVIDER_MODE=rest
UPSTREAM_BASE_URL=https://api.kirimkode.com/v1
UPSTREAM_API_KEY=isi_api_key_anda
UPSTREAM_API_KEY_HEADER=x-api-key
UPSTREAM_BALANCE_PATH=/balance
UPSTREAM_SERVICES_PATH=/services?page=1&limit=200
UPSTREAM_HISTORY_PATH=/orders
UPSTREAM_ORDER_PATH=/order
UPSTREAM_ORDER_STATUS_PATH=/order/{id}/status
UPSTREAM_CANCEL_PATH=/order/{id}/cancel
UPSTREAM_ORDER_METHOD=POST
UPSTREAM_CANCEL_METHOD=POST
UPSTREAM_MARKUP_PERCENT=15
UPSTREAM_MIN_MARGIN=500
UPSTREAM_CURRENCY=IDR
UPSTREAM_TIMEOUT_MS=15000

MIDTRANS_ENVIRONMENT=sandbox
MIDTRANS_SERVER_KEY=isi_server_key_midtrans
```

## Deploy ke GitHub + Vercel

1. Buat repository GitHub baru.
2. Upload seluruh isi folder ini ke repository tersebut.
3. Import repository ke Vercel.
4. Tambahkan semua environment variables di dashboard Vercel, termasuk Midtrans.
5. Deploy, lalu tes `/api/health`, `/api/payments`, dan halaman `/console`.

## Catatan Produksi

- Jika format API provider berbeda, cukup ubah env path atau sesuaikan normalizer di `lib/provider.ts`.
- Saat `UPSTREAM_PROVIDER_MODE=mock`, aplikasi memakai data demo dan order in-memory.
- Flow Midtrans di template ini memakai Snap + in-memory payment store. Untuk production serius, simpan payment session dan aktivasi order ke database.
- Untuk production volume tinggi, simpan context order ke database atau Redis agar status order tetap stabil antar serverless instance.
- Dari pengujian live 12 April 2026, KirimKode API menerima auth via header `x-api-key`, memakai `GET /balance`, `GET /orders`, `POST /order`, `GET /order/{id}/status`, dan `POST /order/{id}/cancel`.
- Endpoint `GET /services` dari KirimKode saat diuji sempat mengembalikan `FETCH_FAILED`, sehingga default di project ini menggunakan query `?page=1&limit=200` agar respons lebih stabil.
