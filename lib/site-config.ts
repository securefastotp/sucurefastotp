const configuredSiteName = process.env.NEXT_PUBLIC_SITE_NAME?.trim();

export const siteConfig = {
  name:
    configuredSiteName && configuredSiteName !== "SecureFastOTP"
      ? configuredSiteName
      : "Rahmat OTP",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  description:
    "Rahmat OTP siap dipakai di GitHub + Vercel dengan katalog KirimKode, flow Midtrans, dan console supplier mobile.",
};
