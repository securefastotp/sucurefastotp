# Rahmat OTP

Website supplier OTP siap deploy ke GitHub + Vercel.

Project ini dibuat sebagai template untuk model bisnis seperti `kirimkode.com`, tetapi diposisikan sebagai website supplier/reseller Anda sendiri. Aplikasi sudah berisi:

- landing page brandable
- halaman `/console` untuk login member, deposit saldo, beli nomor OTP, dan lihat riwayat transaksi
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
NEXT_PUBLIC_SITE_NAME=Rahmat OTP
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=isi_client_key_midtrans
PAYMENT_SESSION_SECRET=isi_secret_session_stabil
AUTH_SESSION_SECRET=opsional_secret_login_khusus
# POSTGRES_URL akan otomatis tersedia saat Neon Postgres terhubung di Vercel

UPSTREAM_PROVIDER_MODE=rest
UPSTREAM_BASE_URL=https://api.kirimkode.com/v1
UPSTREAM_API_KEY=isi_api_key_anda
UPSTREAM_API_KEY_HEADER=x-api-key
UPSTREAM_BALANCE_PATH=/balance
UPSTREAM_SERVICES_PATH=/services
UPSTREAM_HISTORY_PATH=/orders
UPSTREAM_ORDER_PATH=/order
UPSTREAM_ORDER_STATUS_PATH=/order/{id}/status
UPSTREAM_CANCEL_PATH=/order/{id}/cancel
UPSTREAM_ORDER_METHOD=POST
UPSTREAM_CANCEL_METHOD=POST
UPSTREAM_MARKUP_PERCENT=0
UPSTREAM_MIN_MARGIN=0
UPSTREAM_CURRENCY=IDR
UPSTREAM_TIMEOUT_MS=15000

MIDTRANS_ENVIRONMENT=production
MIDTRANS_SERVER_KEY=isi_server_key_midtrans
MIDTRANS_QRIS_FEE_PERCENT=0.7
MIDTRANS_QRIS_FEE_FLAT=0
MIDTRANS_QRIS_EXPIRY_MINUTES=15
```

## Deploy ke GitHub + Vercel

1. Buat repository GitHub baru.
2. Upload seluruh isi folder ini ke repository tersebut.
3. Import repository ke Vercel.
4. Tambahkan semua environment variables di dashboard Vercel, termasuk Midtrans.
5. Deploy, lalu tes `/api/health`, `/api/payments`, `/api/transactions`, dan halaman `/console`.

## Catatan Produksi

- Jika format API provider berbeda, cukup ubah env path atau sesuaikan normalizer di `lib/provider.ts`.
- Saat `UPSTREAM_PROVIDER_MODE=mock`, aplikasi memakai data demo dan order in-memory.
- Flow Midtrans sekarang dipakai untuk deposit saldo user, bukan hanya checkout per order.
- Saat Neon Postgres terhubung di Vercel, transaksi payment disimpan di tabel `otp_transactions` dan order/OTP disimpan di tabel `otp_orders`.
- Data akun member, session login, wallet, deposit, dan riwayat order member sekarang juga tersimpan di Neon Postgres.
- Riwayat transaksi sekarang bisa mengambil snapshot payment dan status OTP terbaru dari database, bukan hanya memory browser.
- Dari pengujian live 12 April 2026, KirimKode API menerima auth via header `x-api-key`, memakai `GET /balance`, `GET /orders`, `POST /order`, `GET /order/{id}/status`, dan `POST /order/{id}/cancel`.
- Mode live sekarang hanya memakai katalog real dari endpoint `GET /services` KirimKode. Jika upstream kosong atau error, website akan menampilkan status asli upstream tanpa katalog buatan.
- Harga jual sekarang mengikuti harga asli upstream tanpa markup tambahan.
