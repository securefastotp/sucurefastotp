export const platformMetrics = [
  { value: "200+", label: "Negara yang bisa Anda tampilkan sebagai katalog jual" },
  { value: "500+", label: "Layanan OTP populer yang siap dijual ulang" },
  { value: "24/7", label: "Monitoring order dan refresh status sepanjang waktu" },
];

export const supplierBenefits = [
  {
    kicker: "Brand Sendiri",
    title: "White-label penuh untuk domain dan nama usaha Anda",
    description:
      "Landing page, copywriting, dan dokumentasi API bisa langsung diganti dengan branding Anda tanpa tergantung nama provider upstream.",
  },
  {
    kicker: "Markup Aman",
    title: "Harga supplier dikendalikan di server, bukan di browser",
    description:
      "Harga jual dihitung di server dengan markup 100%, jadi user hanya melihat harga final yang sudah Anda tentukan.",
  },
  {
    kicker: "Reseller Flow",
    title: "Katalog, order, cek OTP, dan cancel sudah satu alur",
    description:
      "Project ini dirancang untuk alur jual ulang nomor virtual: tarik stok dari provider, tampilkan ke user, lalu pantau OTP masuk dari dashboard Anda sendiri.",
  },
];

export const workflowSteps = [
  {
    title: "Hubungkan provider",
    description:
      "Masukkan base URL, API key, dan path endpoint provider upstream ke environment variable Vercel.",
  },
  {
    title: "Tampilkan katalog real",
    description:
      "Route `/api/catalog` mengambil data langsung dari KirimKode sesuai server dan negara yang dipilih user.",
  },
  {
    title: "Terima order & OTP",
    description:
      "User order lewat `/api/orders`, lalu status OTP dipantau di `/api/orders/:id` sampai kode diterima atau dibatalkan.",
  },
];

export const apiCapabilities = [
  {
    title: "Server-side relay",
    description:
      "API key provider tidak pernah dikirim ke browser. Semua request lewat route handler Next.js.",
  },
  {
    title: "Flexible endpoint mapping",
    description:
      "Path katalog, order, status, dan cancel dapat diubah lewat env tanpa rombak struktur app.",
  },
  {
    title: "Live catalog relay",
    description:
      "Katalog live diambil langsung dari KirimKode sementara API key tetap aman di route Next.js Anda.",
  },
];
