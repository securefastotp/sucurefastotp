"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import {
  formatCompactDateTime,
  formatCurrency,
  formatDateTime,
  formatElapsedTimer,
} from "@/lib/format";
import type {
  AdminUserSummary,
  AuthViewer,
  CatalogResponse,
  CountryOption,
  DashboardSummary,
  DepositRecord,
  Order,
  PricingSettings,
  ServicePriceOverride,
  WalletLedgerEntry,
} from "@/lib/types";

type MemberConsoleProps = {
  initialViewer: AuthViewer | null;
  initialSummary: DashboardSummary | null;
  initialCatalog: CatalogResponse | null;
  initialCountries: CountryOption[];
  initialCountryId: number | null;
};

type ServerId = "bimasakti" | "mars";

type SummaryResponse = {
  summary: DashboardSummary;
};

type CountriesResponse = {
  countries: CountryOption[];
};

type ErrorResponse = {
  error?: string;
};

type BalancePayload = {
  balance: {
    amount: number;
    currency: string;
    updatedAt: string;
    mode: string;
  };
};

type AdminPricingStatePayload = {
  config: PricingSettings;
  overrides: ServicePriceOverride[];
};

const CANCEL_COOLDOWN_SECONDS = 180;
const MIN_DEPOSIT_AMOUNT = 1000;

type ToastState =
  | {
      type: "success" | "error" | "info";
      message: string;
    }
  | null;

const serverOptions = [
  {
    id: "bimasakti" as const,
    name: "Skyword",
    description: "Server utama, stok terbanyak",
  },
  {
    id: "mars" as const,
    name: "Blueverifiy",
    description: "Server cadangan, lebih stabil",
  },
];

const operatorOptions = [
  { id: "any", label: "Random" },
  { id: "telkomsel", label: "Telkomsel" },
  { id: "indosat", label: "Indosat" },
  { id: "xl", label: "XL" },
  { id: "axis", label: "Axis" },
  { id: "tri", label: "Tri" },
  { id: "smartfren", label: "Smartfren" },
];

const SUPPORT_LINKS = [
  {
    id: "admin",
    title: "Kontak Admin",
    subtitle: "+1 (289) 446-6453",
    href: "https://wa.me/12894466453?text=Halo%20admin%20Rahmat%20OTP",
  },
  {
    id: "group",
    title: "Grup Store",
    subtitle: "Putri Gmoyy Store",
    href: "https://chat.whatsapp.com/Gpl3XMxuiVTGHbyEkaEoz6?mode=ems_copy_t",
  },
  {
    id: "developer",
    title: "Developers Website",
    subtitle: "+62 82322633452",
    href: "https://wa.me/6282322633452?text=Halo%20developer%20website%20Rahmat%20OTP",
  },
] as const;

const ADMIN_SUPPORT_LINK =
  SUPPORT_LINKS.find((link) => link.id === "admin") ?? SUPPORT_LINKS[0];

function toFlagEmoji(code?: string) {
  if (!code || !/^[a-z]{2}$/i.test(code)) {
    return null;
  }

  return code
    .toUpperCase()
    .split("")
    .map((char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
    .join("");
}

function getCountryLabel(country: CountryOption) {
  const flag = country.flagEmoji ?? toFlagEmoji(country.code);
  return `${flag ? `${flag} ` : ""}${country.name}`;
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function resolveOrderStatusLabel(status: Order["status"]) {
  if (status === "pending") {
    return "Menunggu";
  }

  if (status === "otp_received") {
    return "Berhasil";
  }

  if (status === "cancelled") {
    return "Dibatalkan";
  }

  return "Expired";
}

function resolveOrderStatusTone(status: Order["status"]) {
  if (status === "pending") {
    return "bg-amber-500/20 text-amber-100 border-amber-300/30";
  }

  if (status === "otp_received") {
    return "bg-emerald-500/20 text-emerald-100 border-emerald-300/30";
  }

  if (status === "cancelled") {
    return "bg-rose-500/20 text-rose-100 border-rose-300/30";
  }

  return "bg-slate-500/20 text-slate-100 border-slate-300/30";
}

function hasError(payload: unknown): payload is { error?: string } {
  return Boolean(payload && typeof payload === "object" && "error" in payload);
}

function normalizeOrderErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (
    /(out of stock|sold out|no stock|insufficient stock|stok\s*(habis|kosong))/i.test(
      normalized,
    )
  ) {
    return "Stok layanan habis. Silakan pilih layanan lain.";
  }

  return message;
}

function formatCountdown(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function Spinner({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      {label ? <span>{label}</span> : null}
    </span>
  );
}

function WalletIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h9.2a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5H6.5A2.5 2.5 0 0 1 4 15.5v-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M15.8 11.2h3.7v1.6h-3.7a1.4 1.4 0 0 1 0-2.8h3.7"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path d="M7 9h5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <rect x="4" y="5" width="16" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <rect x="4" y="14" width="16" height="5" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8" cy="7.5" r="0.9" fill="currentColor" />
      <circle cx="8" cy="16.5" r="0.9" fill="currentColor" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4.5 12h15" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 4c2.6 2.2 4 5 4 8s-1.4 5.8-4 8c-2.6-2.2-4-5-4-8s1.4-5.8 4-8Z" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CartIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 6h2l1.5 7.5h8.8l2-5.2H8.1" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      <circle cx="10" cy="18" r="1.2" fill="currentColor" />
      <circle cx="17" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M7 10a5 5 0 0 1 10 0v3.4l1.5 2.1H5.5L7 13.4V10Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
      <path d="M10 18a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="m8.6 12.2 2.2 2.2 4.8-5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="m9.5 9.5 5 5M14.5 9.5l-5 5" stroke="currentColor" strokeLinecap="round" strokeWidth="1.9" />
    </svg>
  );
}

function TrendIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M4.5 16.5 9 12l3.2 3.2L19.5 8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
      <path d="M14.5 8h5v5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="m12 4.2 2.2 4.5 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7L12 4.2Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path d="M20 5 4.7 11.2c-.9.4-.9 1.6.1 1.9l3.9 1.2 1.5 4.4c.3.8 1.4.9 1.9.2l2.1-3 4 2.9c.8.6 1.9.1 2-1l1.7-11.5c.1-.9-.8-1.5-1.9-1.3Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="m8.8 14.3 7.6-5.2-5.8 6.8" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4l2.8 1.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function DashboardStatCard({
  icon,
  label,
  value,
  badge,
  tone = "emerald",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  badge: string;
  tone?: "emerald" | "rose" | "cyan";
}) {
  const badgeTone =
    tone === "rose"
      ? "bg-rose-400/14 text-rose-100"
      : tone === "cyan"
        ? "bg-cyan-400/12 text-cyan-100"
        : "bg-emerald-400/12 text-emerald-100";

  return (
    <div className="min-h-[126px] rounded-[18px] border border-slate-600/35 bg-[#111d30] px-3 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-emerald-400/10 text-emerald-300">
          {icon}
        </div>
        <span className={cn("max-w-[72px] truncate rounded-full px-2 py-0.5 text-[9px] font-medium leading-4", badgeTone)}>
          {badge}
        </span>
      </div>
      <p className="mt-5 break-words text-[20px] font-semibold leading-6 text-slate-100">
        {value}
      </p>
      <p className="mt-1.5 text-[11px] leading-4 text-slate-400">{label}</p>
    </div>
  );
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <rect x="9" y="9" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <rect x="5" y="5" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m19 12-.9.5a1 1 0 0 0-.5.86v.98a1 1 0 0 1-.53.88l-1.04.57a1 1 0 0 1-1.01-.03l-.89-.56a1 1 0 0 0-.97-.04l-.85.43a1 1 0 0 0-.55.9V18a1 1 0 0 1-.73.96l-1.15.3a1 1 0 0 1-1.06-.38l-.63-.82a1 1 0 0 0-.9-.38l-1.01.12a1 1 0 0 1-.96-.42l-.68-.98a1 1 0 0 1 .06-1.09l.62-.77a1 1 0 0 0 .17-.96l-.32-.95a1 1 0 0 0-.75-.66L4.15 12a1 1 0 0 1-.79-.76l-.29-1.16a1 1 0 0 1 .32-1.03l.79-.68a1 1 0 0 0 .33-.91l-.12-1a1 1 0 0 1 .42-.97l.98-.67a1 1 0 0 1 1.09.05l.78.62a1 1 0 0 0 .95.18l.95-.32a1 1 0 0 0 .66-.75l.23-.97a1 1 0 0 1 .76-.79l1.16-.29a1 1 0 0 1 1.03.32l.68.79a1 1 0 0 0 .91.33l1-.12a1 1 0 0 1 .97.42l.67.98a1 1 0 0 1-.05 1.09l-.62.78a1 1 0 0 0-.18.95l.32.95a1 1 0 0 0 .75.66l.97.23a1 1 0 0 1 .79.76l.29 1.16a1 1 0 0 1-.32 1.03Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M12 3.5 18.5 6v5.8c0 4.1-2.5 7.9-6.5 9.7-4-1.8-6.5-5.6-6.5-9.7V6L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M9.8 12.2 11.3 13.7 14.5 10.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5 18.2c1.6-2.6 4-3.9 7-3.9s5.4 1.3 7 3.9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <path
        d="M12 4a8 8 0 0 0-6.9 12l-.7 3.5 3.6-.9A8 8 0 1 0 12 4Z"
        fill="#25D366"
      />
      <path
        d="M9.4 8.5c-.2-.4-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.4s-.8.8-.8 2 .9 2.3 1 2.5c.1.2 1.7 2.7 4.3 3.6 2.1.7 2.6.6 3 .5.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.3-.2-.7-.4-.4-.2-1.1-.5-1.3-.6-.2-.1-.4-.1-.5.1-.2.2-.6.7-.7.8-.1.2-.3.2-.6.1s-1.1-.4-2.1-1.3c-.7-.6-1.2-1.4-1.4-1.6-.1-.2 0-.4.1-.5.1-.1.2-.3.3-.4.1-.1.2-.2.2-.4.1-.1 0-.3 0-.4 0-.1-.5-1.2-.8-1.8Z"
        fill="#fff"
      />
    </svg>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn("relative flex h-11 w-11 items-center justify-center rounded-[16px] bg-[linear-gradient(135deg,#92ebff,#2f87ff)] shadow-[0_16px_36px_-20px_rgba(47,135,255,0.8)]", className)}>
      <div className="absolute inset-[2px] rounded-[14px] bg-[linear-gradient(145deg,rgba(255,255,255,0.26),rgba(8,18,38,0.22))]" />
      <div className="relative h-6 w-6 text-white">
        <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
          <path
            d="M12 3.5 18.5 6v5.8c0 4.1-2.5 7.9-6.5 9.7-4-1.8-6.5-5.6-6.5-9.7V6L12 3.5Z"
            stroke="currentColor"
            strokeWidth="1.8"
          />
          <path
            d="m9.5 14.6 2.3-5 1.6 2.3 1.7-.9"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </svg>
      </div>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-white/14 bg-sky-100/12 text-sky-50">
          {icon}
        </div>
        <p className="text-[14px] font-medium text-white">{title}</p>
      </div>
      {action}
    </div>
  );
}

async function requestSummary() {
  const response = await fetch("/api/account/summary", {
    cache: "no-store",
  });
  const payload = (await response.json()) as SummaryResponse | ErrorResponse;

  if (!response.ok || hasError(payload) || !("summary" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membaca dashboard akun.",
    );
  }

  return payload.summary;
}

async function requestCountries(serverId: ServerId) {
  const response = await fetch(`/api/countries?server=${serverId}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as CountriesResponse | ErrorResponse;

  if (!response.ok || hasError(payload) || !("countries" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal memuat daftar negara.",
    );
  }

  return payload.countries;
}

async function requestCatalog(serverId: ServerId, countryId: number) {
  const response = await fetch(
    `/api/catalog?server=${serverId}&countryId=${countryId}`,
    {
      cache: "no-store",
    },
  );
  const payload = (await response.json()) as CatalogResponse | ErrorResponse;

  if (!response.ok || hasError(payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal memuat katalog layanan.",
    );
  }

  return payload;
}

async function requestRegister(input: {
  name: string;
  email: string;
  password: string;
}) {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as { viewer: AuthViewer } | ErrorResponse;

  if (!response.ok || !("viewer" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membuat akun baru.",
    );
  }

  return payload.viewer;
}

async function requestLogin(input: {
  email: string;
  password: string;
}) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as { viewer: AuthViewer } | ErrorResponse;

  if (!response.ok || !("viewer" in payload)) {
    throw new Error(hasError(payload) ? payload.error : "Gagal login akun.");
  }

  return payload.viewer;
}

async function requestLogout() {
  const response = await fetch("/api/auth/logout", {
    method: "POST",
  });
  const payload = (await response.json()) as { ok: true } | ErrorResponse;

  if (!response.ok || !("ok" in payload)) {
    throw new Error(hasError(payload) ? payload.error : "Gagal logout akun.");
  }

  return true;
}

async function requestCreateDeposit(amount: number) {
  const response = await fetch("/api/account/deposits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount }),
  });
  const payload = (await response.json()) as
    | { deposit: DepositRecord }
    | ErrorResponse;

  if (!response.ok || !("deposit" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membuat deposit QRIS.",
    );
  }

  return payload.deposit;
}

async function requestDepositStatus(depositId: string) {
  const response = await fetch(`/api/account/deposits/${depositId}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as
    | { deposit: DepositRecord }
    | ErrorResponse;

  if (!response.ok || !("deposit" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membaca status deposit.",
    );
  }

  return payload.deposit;
}

async function requestCreateOrder(input: {
  serviceId: string;
  serviceCode: string;
  serverId: ServerId;
  countryId: number;
  operator?: string;
}) {
  const response = await fetch("/api/account/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as { order: Order } | ErrorResponse;

  if (!response.ok || !("order" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membuat order OTP.",
    );
  }

  return payload.order;
}

async function requestOrderStatus(orderId: string) {
  const response = await fetch(`/api/account/orders/${orderId}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as { order: Order } | ErrorResponse;

  if (!response.ok || !("order" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membaca status order OTP.",
    );
  }

  return payload.order;
}

async function requestCancelOrder(orderId: string) {
  const response = await fetch(`/api/account/orders/${orderId}`, {
    method: "DELETE",
  });
  const payload = (await response.json()) as
    | { order: Order; message: string }
    | ErrorResponse;

  if (!response.ok || !("order" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membatalkan order OTP.",
    );
  }

  return payload;
}

async function requestUpdateSettings(input: {
  name: string;
  email: string;
  currentPassword: string;
  newPassword?: string;
}) {
  const response = await fetch("/api/account/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as
    | { viewer: AuthViewer; message: string }
    | ErrorResponse;

  if (!response.ok || !("viewer" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal memperbarui pengaturan akun.",
    );
  }

  return payload;
}

async function requestAdminUsers(search: string) {
  const query = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
  const response = await fetch(`/api/admin/users${query}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as
    | { users: AdminUserSummary[] }
    | ErrorResponse;

  if (!response.ok || !("users" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membaca daftar user admin.",
    );
  }

  return payload.users;
}

async function requestAdminWalletAdjustment(input: {
  userId: string;
  amount: number;
  description?: string;
}) {
  const response = await fetch(`/api/admin/users/${input.userId}/wallet`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: input.amount,
      description: input.description,
    }),
  });
  const payload = (await response.json()) as
    | { viewer: AuthViewer; message: string }
    | ErrorResponse;

  if (!response.ok || !("viewer" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal memperbarui saldo user.",
    );
  }

  return payload;
}

async function requestAdminPasswordReset(input: {
  userId: string;
  newPassword: string;
}) {
  const response = await fetch(`/api/admin/users/${input.userId}/password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      newPassword: input.newPassword,
    }),
  });
  const payload = (await response.json()) as
    | { viewer: AuthViewer; message: string }
    | ErrorResponse;

  if (!response.ok || !("viewer" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal mengganti password user.",
    );
  }

  return payload;
}

async function requestAdminBlockUser(input: { userId: string; blocked: boolean }) {
  const response = await fetch(`/api/admin/users/${input.userId}/block`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      blocked: input.blocked,
    }),
  });
  const payload = (await response.json()) as
    | { viewer: AuthViewer; message: string }
    | ErrorResponse;

  if (!response.ok || !("viewer" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal memperbarui status user.",
    );
  }

  return payload;
}

async function requestAdminDeleteUser(input: { userId: string }) {
  const response = await fetch(`/api/admin/users/${input.userId}`, {
    method: "DELETE",
  });
  const payload = (await response.json()) as
    | { message: string }
    | ErrorResponse;

  if (!response.ok || !("message" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal menghapus user.",
    );
  }

  return payload;
}

async function requestUpstreamBalance() {
  const response = await fetch("/api/balance", {
    cache: "no-store",
  });
  const payload = (await response.json()) as BalancePayload | ErrorResponse;

  if (!response.ok || !("balance" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membaca saldo KirimKode.",
    );
  }

  return payload.balance;
}

async function requestAdminPricingState() {
  const response = await fetch("/api/admin/pricing", {
    cache: "no-store",
  });
  const payload = (await response.json()) as AdminPricingStatePayload | ErrorResponse;

  if (!response.ok || hasError(payload) || !("config" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membaca pengaturan harga admin.",
    );
  }

  return payload;
}

async function requestAdminProfitPercentUpdate(profitPercent: number) {
  const response = await fetch("/api/admin/pricing", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ profitPercent }),
  });
  const payload = (await response.json()) as
    | { config: PricingSettings; message: string }
    | ErrorResponse;

  if (!response.ok || hasError(payload) || !("config" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal memperbarui persentase keuntungan.",
    );
  }

  return payload;
}

async function requestAdminServiceOverrideSave(input: {
  serviceId: string;
  serviceCode: string;
  service: string;
  serverId: ServerId;
  countryId: number;
  country: string;
  customPrice: number;
  upstreamPrice: number;
}) {
  const response = await fetch("/api/admin/pricing/service", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as
    | { override: ServicePriceOverride; message: string }
    | ErrorResponse;

  if (!response.ok || hasError(payload) || !("override" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal menyimpan harga layanan.",
    );
  }

  return payload;
}

async function requestAdminServiceOverrideDelete(serviceId: string) {
  const response = await fetch(
    `/api/admin/pricing/service?serviceId=${encodeURIComponent(serviceId)}`,
    {
      method: "DELETE",
    },
  );
  const payload = (await response.json()) as { message: string } | ErrorResponse;

  if (!response.ok || hasError(payload) || !("message" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal menghapus override harga layanan.",
    );
  }

  return payload;
}


export function MemberConsole({
  initialViewer,
  initialSummary,
  initialCatalog,
  initialCountries,
  initialCountryId,
}: MemberConsoleProps) {
  const [viewer, setViewer] = useState<AuthViewer | null>(initialViewer);
  const [summary, setSummary] = useState<DashboardSummary | null>(initialSummary);
  const [catalog, setCatalog] = useState<CatalogResponse | null>(initialCatalog);
  const [countries, setCountries] = useState<CountryOption[]>(initialCountries);
  const [selectedServer, setSelectedServer] = useState<ServerId>("bimasakti");
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(
    initialCountryId,
  );
  const [selectedServiceId, setSelectedServiceId] = useState(
    initialCatalog?.services[0]?.id ?? "",
  );
  const [selectedOperator, setSelectedOperator] = useState("any");
  const [serviceSearch, setServiceSearch] = useState("");
  const [activeTab, setActiveTab] = useState<
    "dashboard" | "deposit" | "buy" | "history" | "settings" | "admin"
  >("dashboard");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [adminPricingError, setAdminPricingError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [depositAmount, setDepositAmount] = useState("10000");
  const [settingsName, setSettingsName] = useState(initialViewer?.name ?? "");
  const [settingsEmail, setSettingsEmail] = useState(initialViewer?.email ?? "");
  const [settingsCurrentPassword, setSettingsCurrentPassword] = useState("");
  const [settingsNewPassword, setSettingsNewPassword] = useState("");
  const [adminUsers, setAdminUsers] = useState<AdminUserSummary[]>([]);
  const [adminSearch, setAdminSearch] = useState("");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState("");
  const [manualAmount, setManualAmount] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [historyPage, setHistoryPage] = useState(1);
  const [activeDeposit, setActiveDeposit] = useState<DepositRecord | null>(
    initialSummary?.deposits.find((deposit) => deposit.status === "pending") ?? null,
  );
  const [activeOrder, setActiveOrder] = useState<Order | null>(
    initialSummary?.orders.find((order) => order.status === "pending") ?? null,
  );
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isCountriesLoading, setIsCountriesLoading] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isDepositLoading, setIsDepositLoading] = useState(false);
  const [isOrderLoading, setIsOrderLoading] = useState(false);
  const [isOrderCancelling, setIsOrderCancelling] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [isSettingsLoading, setIsSettingsLoading] = useState(false);
  const [isAdminUsersLoading, setIsAdminUsersLoading] = useState(false);
  const [isAdminSaving, setIsAdminSaving] = useState(false);
  const [isAdminPasswordSaving, setIsAdminPasswordSaving] = useState(false);
  const [isAdminBlockSaving, setIsAdminBlockSaving] = useState(false);
  const [isAdminDeleteSaving, setIsAdminDeleteSaving] = useState(false);
  const [isAdminPricingLoading, setIsAdminPricingLoading] = useState(false);
  const [isAdminPricingConfigSaving, setIsAdminPricingConfigSaving] = useState(false);
  const [isAdminPricingServiceSaving, setIsAdminPricingServiceSaving] = useState(false);
  const [isAdminPricingCountriesLoading, setIsAdminPricingCountriesLoading] =
    useState(false);
  const [isAdminPricingCatalogLoading, setIsAdminPricingCatalogLoading] =
    useState(false);
  const [adminNewPassword, setAdminNewPassword] = useState("");
  const [adminPricingConfig, setAdminPricingConfig] =
    useState<PricingSettings | null>(null);
  const [adminPriceOverrides, setAdminPriceOverrides] = useState<ServicePriceOverride[]>(
    [],
  );
  const [adminProfitPercent, setAdminProfitPercent] = useState("");
  const [adminPricingServer, setAdminPricingServer] = useState<ServerId>("bimasakti");
  const [adminPricingCountries, setAdminPricingCountries] = useState<CountryOption[]>(
    [],
  );
  const [adminPricingCountryId, setAdminPricingCountryId] = useState<number | null>(
    null,
  );
  const [adminPricingCatalog, setAdminPricingCatalog] = useState<CatalogResponse | null>(
    null,
  );
  const [adminPricingSearch, setAdminPricingSearch] = useState("");
  const [selectedAdminPricingServiceId, setSelectedAdminPricingServiceId] =
    useState("");
  const [adminCustomPrice, setAdminCustomPrice] = useState("");
  const [adminBalanceOverride, setAdminBalanceOverride] = useState<{
    amount: number;
    currency: string;
    updatedAt: string;
  } | null>(null);
  const [adminBalanceError, setAdminBalanceError] = useState<string | null>(null);
  const [nowTimestamp, setNowTimestamp] = useState(() => Date.now());

  const deferredSearch = useDeferredValue(serviceSearch);
  const deferredAdminSearch = useDeferredValue(adminSearch);
  const deferredAdminPricingSearch = useDeferredValue(adminPricingSearch);
  const canAccessAdmin = viewer?.role === "admin";
  const selectedService = useMemo(
    () => catalog?.services.find((service) => service.id === selectedServiceId) ?? null,
    [catalog, selectedServiceId],
  );
  const isSelectedOutOfStock = Boolean(
    selectedService && Number.isFinite(selectedService.stock) && selectedService.stock <= 0,
  );
  const filteredServices = useMemo(() => {
    const services = catalog?.services ?? [];
    const query = deferredSearch.trim().toLowerCase();

    if (!query) {
      return services;
    }

    return services.filter((service) =>
      `${service.service} ${service.serviceCode}`.toLowerCase().includes(query),
    );
  }, [catalog, deferredSearch]);
  const historyPageSize = 10;
  const totalHistoryPages = Math.max(
    1,
    Math.ceil((summary?.orders.length ?? 0) / historyPageSize),
  );
  const pagedOrders = useMemo(() => {
    if (!summary?.orders.length) {
      return [];
    }

    const start = (historyPage - 1) * historyPageSize;
    return summary.orders.slice(start, start + historyPageSize);
  }, [historyPage, historyPageSize, summary?.orders]);
  const selectedAdminUser = useMemo(
    () =>
      adminUsers.find((item) => item.id === selectedAdminUserId) ??
      adminUsers[0] ??
      null,
    [adminUsers, selectedAdminUserId],
  );
  const filteredAdminPricingServices = useMemo(() => {
    const services = adminPricingCatalog?.services ?? [];
    const query = deferredAdminPricingSearch.trim().toLowerCase();

    if (!query) {
      return services;
    }

    return services.filter((service) =>
      `${service.service} ${service.serviceCode} ${service.country}`
        .toLowerCase()
        .includes(query),
    );
  }, [adminPricingCatalog, deferredAdminPricingSearch]);
  const selectedAdminPricingService = useMemo(
    () =>
      adminPricingCatalog?.services.find(
        (service) => service.id === selectedAdminPricingServiceId,
      ) ??
      adminPricingCatalog?.services[0] ??
      null,
    [adminPricingCatalog, selectedAdminPricingServiceId],
  );
  const selectedAdminServiceOverride = useMemo(
    () =>
      selectedAdminPricingService
        ? adminPriceOverrides.find(
            (override) => override.serviceId === selectedAdminPricingService.id,
          ) ?? null
        : null,
    [adminPriceOverrides, selectedAdminPricingService],
  );
  const todayOrderCount = useMemo(() => {
    const now = new Date();

    return (summary?.orders ?? []).filter((order) => {
      const createdAt = new Date(order.createdAt);

      return (
        createdAt.getFullYear() === now.getFullYear() &&
        createdAt.getMonth() === now.getMonth() &&
        createdAt.getDate() === now.getDate()
      );
    }).length;
  }, [summary?.orders]);
  const failedOrderCount = useMemo(
    () =>
      (summary?.orders ?? []).filter(
        (order) => order.status === "cancelled" || order.status === "expired",
      ).length,
    [summary?.orders],
  );
  const monthlySpend = useMemo(() => {
    const now = new Date();

    return (summary?.orders ?? []).reduce((total, order) => {
      const createdAt = new Date(order.createdAt);
      const isCurrentMonth =
        createdAt.getFullYear() === now.getFullYear() &&
        createdAt.getMonth() === now.getMonth();

      if (
        !isCurrentMonth ||
        order.status === "cancelled" ||
        order.status === "expired"
      ) {
        return total;
      }

      return total + order.price;
    }, 0);
  }, [summary?.orders]);
  const monthLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("id-ID", {
        month: "long",
      }).format(new Date()),
    [],
  );
  const favoriteService = useMemo(() => {
    const counter = new Map<string, number>();

    for (const order of summary?.orders ?? []) {
      counter.set(order.service, (counter.get(order.service) ?? 0) + 1);
    }

    const [name, count] =
      [...counter.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];

    return {
      name: name ?? "-",
      count: count ?? 0,
    };
  }, [summary?.orders]);
  const firstName = useMemo(
    () => (viewer?.name.trim().split(/\s+/)[0] || "Member"),
    [viewer?.name],
  );
  const hasPendingOrderTimer = Boolean(
    activeOrder?.status === "pending" ||
      summary?.orders.some((order) => order.status === "pending"),
  );
  const activeOrderCancelRemainingSeconds = useMemo(() => {
    if (!activeOrder || activeOrder.status !== "pending") {
      return 0;
    }

    const createdAt = new Date(activeOrder.createdAt).getTime();

    if (!Number.isFinite(createdAt)) {
      return 0;
    }

    return Math.max(
      0,
      CANCEL_COOLDOWN_SECONDS - Math.floor((nowTimestamp - createdAt) / 1000),
    );
  }, [activeOrder, nowTimestamp]);
  const canCancelActiveOrder = Boolean(
    activeOrder?.status === "pending" && activeOrderCancelRemainingSeconds === 0,
  );

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      setToast(null);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!viewer) {
      setSettingsName("");
      setSettingsEmail("");
      return;
    }

    setSettingsName(viewer.name);
    setSettingsEmail(viewer.email);
  }, [viewer]);

  useEffect(() => {
    setHistoryPage(1);
  }, [summary?.orders.length]);

  useEffect(() => {
    if (!hasPendingOrderTimer) {
      return;
    }

    setNowTimestamp(Date.now());
    const timer = window.setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [hasPendingOrderTimer]);

  useEffect(() => {
    if (!selectedAdminPricingService) {
      setAdminCustomPrice("");
      return;
    }

    setAdminCustomPrice(
      String(selectedAdminServiceOverride?.customPrice ?? selectedAdminPricingService.price),
    );
  }, [selectedAdminPricingService, selectedAdminServiceOverride]);

  async function refreshSummary() {
    if (!viewer) {
      return null;
    }

    setIsSummaryLoading(true);
    setDashboardError(null);

    try {
      const nextSummary = await requestSummary();
      setViewer(nextSummary.viewer);
      setSummary(nextSummary);
      setActiveDeposit(
        nextSummary.deposits.find((deposit) => deposit.status === "pending") ?? null,
      );
      setActiveOrder(
        nextSummary.orders.find((order) => order.status === "pending") ?? null,
      );
      return nextSummary;
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Gagal memuat dashboard akun.",
      );
      return null;
    } finally {
      setIsSummaryLoading(false);
    }
  }

  function applyMemberCatalogResult(nextCatalog: CatalogResponse) {
    setCatalog(nextCatalog);
    setSelectedServiceId((current) => {
      if (current && nextCatalog.services.some((service) => service.id === current)) {
        return current;
      }

      return nextCatalog.services[0]?.id ?? "";
    });
  }

  function applyAdminCatalogResult(nextCatalog: CatalogResponse) {
    setAdminPricingCatalog(nextCatalog);
    setSelectedAdminPricingServiceId((current) => {
      if (current && nextCatalog.services.some((service) => service.id === current)) {
        return current;
      }

      return nextCatalog.services[0]?.id ?? "";
    });
  }

  const loadAdminPricingState = useCallback(async () => {
    if (!canAccessAdmin) {
      return;
    }

    setIsAdminPricingLoading(true);
    setAdminPricingError(null);

    try {
      const pricing = await requestAdminPricingState();
      setAdminPricingConfig(pricing.config);
      setAdminPriceOverrides(pricing.overrides);
      setAdminProfitPercent(String(pricing.config.profitPercent));
    } catch (error) {
      setAdminPricingError(
        error instanceof Error ? error.message : "Gagal membaca pengaturan harga admin.",
      );
    } finally {
      setIsAdminPricingLoading(false);
    }
  }, [canAccessAdmin]);

  const loadAdminPricingCountries = useCallback(
    async (serverId: ServerId) => {
      if (!canAccessAdmin) {
        return;
      }

      setIsAdminPricingCountriesLoading(true);
      setAdminPricingError(null);

      try {
        const nextCountries = await requestCountries(serverId);
        setAdminPricingCountries(nextCountries);
        setAdminPricingCountryId((current) => {
          if (current && nextCountries.some((country) => country.id === current)) {
            return current;
          }

          return (
            nextCountries.find((country) => country.id === 6)?.id ??
            nextCountries[0]?.id ??
            null
          );
        });
      } catch (error) {
        setAdminPricingCountries([]);
        setAdminPricingCountryId(null);
        setAdminPricingError(
          error instanceof Error ? error.message : "Gagal memuat negara admin.",
        );
      } finally {
        setIsAdminPricingCountriesLoading(false);
      }
    },
    [canAccessAdmin],
  );

  const loadAdminPricingCatalog = useCallback(
    async (serverId: ServerId, countryId: number) => {
      if (!canAccessAdmin) {
        return;
      }

      setIsAdminPricingCatalogLoading(true);
      setAdminPricingError(null);

      try {
        const nextCatalog = await requestCatalog(serverId, countryId);
        applyAdminCatalogResult(nextCatalog);
      } catch (error) {
        setAdminPricingCatalog(null);
        setSelectedAdminPricingServiceId("");
        setAdminPricingError(
          error instanceof Error ? error.message : "Gagal memuat katalog harga admin.",
        );
      } finally {
        setIsAdminPricingCatalogLoading(false);
      }
    },
    [canAccessAdmin],
  );

  const syncDeposit = useEffectEvent(async (depositId: string) => {
    try {
      const deposit = await requestDepositStatus(depositId);
      setActiveDeposit(deposit);

      if (deposit.status === "paid" && deposit.creditedAt) {
        await refreshSummary();
        setToast({
          type: "success",
          message: "Deposit berhasil masuk ke saldo akun.",
        });
      }
    } catch (error) {
      setDepositError(
        error instanceof Error ? error.message : "Gagal sinkron deposit.",
      );
    }
  });

  const syncOrder = useEffectEvent(async (orderId: string) => {
    try {
      const order = await requestOrderStatus(orderId);
      setActiveOrder(order);

      if (order.status !== "pending") {
        await refreshSummary();
        if (order.status === "otp_received") {
          setToast({
            type: "success",
            message: "OTP berhasil diterima dan siap dipakai.",
          });
        }
      }
    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : "Gagal sinkron status order.",
      );
    }
  });

  const loadAdminUsers = useCallback(async (search: string) => {
    if (!canAccessAdmin) {
      return;
    }

    setIsAdminUsersLoading(true);
    setAdminError(null);

    try {
      const users = await requestAdminUsers(search);
      setAdminUsers(users);
      setSelectedAdminUserId((current) => {
        if (current && users.some((item) => item.id === current)) {
          return current;
        }

        return users[0]?.id ?? "";
      });
    } catch (error) {
      setAdminError(
        error instanceof Error ? error.message : "Gagal memuat daftar user.",
      );
    } finally {
      setIsAdminUsersLoading(false);
    }
  }, [canAccessAdmin]);

  useEffect(() => {
    if (!viewer) {
      return;
    }

    let ignoreResult = false;
    setIsCountriesLoading(true);
    void requestCountries(selectedServer)
      .then((result) => {
        if (ignoreResult) {
          return;
        }

        setCountries(result);
        setSelectedCountryId((current) => {
          if (current && result.some((country) => country.id === current)) {
            return current;
          }

          return result.find((country) => country.id === 6)?.id ?? result[0]?.id ?? null;
        });
      })
      .catch((error) => {
        if (ignoreResult) {
          return;
        }

        setCountries([]);
        setSelectedCountryId(null);
        setDashboardError(error instanceof Error ? error.message : "Gagal memuat negara.");
      })
      .finally(() => {
        if (!ignoreResult) {
          setIsCountriesLoading(false);
        }
      });

    return () => {
      ignoreResult = true;
    };
  }, [viewer, selectedServer]);

  useEffect(() => {
    if (!viewer || !selectedCountryId) {
      return;
    }

    let ignoreResult = false;
    setIsCatalogLoading(true);
    void requestCatalog(selectedServer, selectedCountryId)
      .then((result) => {
        if (ignoreResult) {
          return;
        }

        applyMemberCatalogResult(result);
      })
      .catch((error) => {
        if (ignoreResult) {
          return;
        }

        setCatalog(null);
        setSelectedServiceId("");
        setOrderError(
          error instanceof Error ? error.message : "Gagal memuat katalog layanan.",
        );
      })
      .finally(() => {
        if (!ignoreResult) {
          setIsCatalogLoading(false);
        }
      });

    return () => {
      ignoreResult = true;
    };
  }, [viewer, selectedServer, selectedCountryId]);

  useEffect(() => {
    if (!canAccessAdmin || activeTab !== "admin") {
      return;
    }

    void loadAdminUsers(deferredAdminSearch);
  }, [activeTab, canAccessAdmin, deferredAdminSearch, loadAdminUsers]);

  useEffect(() => {
    if (!canAccessAdmin || activeTab !== "admin") {
      return;
    }

    void loadAdminPricingState();
  }, [activeTab, canAccessAdmin, loadAdminPricingState]);

  useEffect(() => {
    if (!canAccessAdmin || activeTab !== "admin") {
      return;
    }

    void loadAdminPricingCountries(adminPricingServer);
  }, [activeTab, adminPricingServer, canAccessAdmin, loadAdminPricingCountries]);

  useEffect(() => {
    if (!canAccessAdmin || activeTab !== "admin" || !adminPricingCountryId) {
      return;
    }

    void loadAdminPricingCatalog(adminPricingServer, adminPricingCountryId);
  }, [
    activeTab,
    adminPricingCountryId,
    adminPricingServer,
    canAccessAdmin,
    loadAdminPricingCatalog,
  ]);

  useEffect(() => {
    if (!activeDeposit?.id || activeDeposit.status !== "pending") {
      return;
    }

    const timer = window.setInterval(() => {
      void syncDeposit(activeDeposit.id);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeDeposit?.id, activeDeposit?.status]);

  useEffect(() => {
    if (!activeOrder?.id || activeOrder.status !== "pending") {
      return;
    }

    const timer = window.setInterval(() => {
      void syncOrder(activeOrder.id);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeOrder?.id, activeOrder?.status]);

  async function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsAuthLoading(true);
    setAuthError(null);

    try {
      const nextViewer =
        authMode === "register"
          ? await requestRegister({
              name: authName,
              email: authEmail,
              password: authPassword,
            })
          : await requestLogin({
              email: authEmail,
              password: authPassword,
            });
      const nextSummary = await requestSummary();
      setViewer(nextViewer);
      setSummary(nextSummary);
      setCountries(initialCountries);
      setSelectedCountryId(
        nextSummary.orders[0]?.countryId ??
          initialCountryId ??
          initialCountries.find((country) => country.id === 6)?.id ??
          initialCountries[0]?.id ??
          null,
      );
      setActiveDeposit(
        nextSummary.deposits.find((deposit) => deposit.status === "pending") ?? null,
      );
      setActiveOrder(
        nextSummary.orders.find((order) => order.status === "pending") ?? null,
      );
      setAuthName("");
      setAuthPassword("");
      setAuthError(null);
      setToast({
        type: "success",
        message:
          authMode === "register"
            ? "Akun berhasil dibuat dan langsung login."
            : "Login berhasil. Dashboard siap dipakai.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal autentikasi akun.";
      setAuthError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await requestLogout();
      setViewer(null);
      setSummary(null);
      setCatalog(null);
      setCountries([]);
      setSelectedCountryId(null);
      setSelectedServiceId("");
      setSelectedOperator("any");
      setActiveDeposit(null);
      setActiveOrder(null);
      setAdminUsers([]);
      setSelectedAdminUserId("");
      setAuthPassword("");
      setActiveTab("dashboard");
      setToast({
        type: "success",
        message: "Logout berhasil.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal logout akun.";
      setDashboardError(message);
      setToast({
        type: "error",
        message,
      });
    }
  }

  async function handleDepositSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(depositAmount);

    if (!Number.isFinite(amount) || amount < MIN_DEPOSIT_AMOUNT) {
      const message = "Minimal deposit Rp1.000.";
      setDepositError(message);
      setToast({
        type: "error",
        message,
      });
      return;
    }

    setIsDepositLoading(true);
    setDepositError(null);

    try {
      const deposit = await requestCreateDeposit(amount);
      setActiveDeposit(deposit);
      await refreshSummary();
      setToast({
        type: "success",
        message: "QRIS deposit berhasil dibuat.",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal membuat deposit.";
      setDepositError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setIsDepositLoading(false);
    }
  }

  async function handleOrderSubmit() {
    if (!selectedService || !selectedCountryId) {
      const message = "Pilih negara dan layanan dulu sebelum membeli nomor.";
      setOrderError(message);
      setToast({
        type: "error",
        message,
      });
      return;
    }

    if (isSelectedOutOfStock) {
      const message = "Stok layanan habis. Silakan pilih layanan lain.";
      setOrderError(message);
      setToast({
        type: "error",
        message,
      });
      return;
    }

    setIsOrderLoading(true);
    setOrderError(null);

    try {
      const order = await requestCreateOrder({
        serviceId: selectedService.id,
        serviceCode: selectedService.serviceCode,
        serverId: selectedServer,
        countryId: selectedCountryId,
        operator: selectedOperator,
      });
      setActiveOrder(order);
      await refreshSummary();
      setToast({
        type: "success",
        message: "Order OTP berhasil dibuat. Menunggu kode OTP masuk.",
      });
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : "Gagal membuat order OTP.";
      const message = normalizeOrderErrorMessage(rawMessage);
      setOrderError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setIsOrderLoading(false);
    }
  }

  async function handleCancelOrder() {
    if (!activeOrder?.id) {
      return;
    }

    setIsOrderCancelling(true);
    setOrderError(null);

    try {
      const payload = await requestCancelOrder(activeOrder.id);
      setActiveOrder(payload.order);
      await refreshSummary();
      setToast({
        type: "success",
        message: payload.message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal membatalkan order OTP.";
      setOrderError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setIsOrderCancelling(false);
    }
  }

  async function handleRefreshOrder() {
    if (!activeOrder?.id) {
      return;
    }

    try {
      const order = await requestOrderStatus(activeOrder.id);
      setActiveOrder(order);

      if (order.status !== "pending") {
        await refreshSummary();
        if (order.status === "otp_received") {
          setToast({
            type: "success",
            message: "OTP berhasil diterima dan siap dipakai.",
          });
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal refresh status order.";
      setOrderError(message);
      setToast({
        type: "error",
        message,
      });
    }
  }

  async function handleCopy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setToast({
        type: "success",
        message: `${label} berhasil disalin.`,
      });
    } catch {
      setToast({
        type: "error",
        message: "Gagal menyalin ke clipboard.",
      });
    }
  }

  async function handleSettingsSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSettingsLoading(true);
    setSettingsError(null);

    try {
      const payload = await requestUpdateSettings({
        name: settingsName,
        email: settingsEmail,
        currentPassword: settingsCurrentPassword,
        newPassword: settingsNewPassword,
      });
      setViewer(payload.viewer);
      setSummary((current) =>
        current
          ? {
              ...current,
              viewer: payload.viewer,
            }
          : current,
      );
      setSettingsCurrentPassword("");
      setSettingsNewPassword("");
      setToast({
        type: "success",
        message: payload.message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal memperbarui akun.";
      setSettingsError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setIsSettingsLoading(false);
    }
  }

  async function handleAdminBalanceSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAdminUser) {
      setAdminError("Pilih user tujuan terlebih dulu.");
      return;
    }

    const amount = Number(manualAmount);

    if (!Number.isFinite(amount) || amount === 0) {
      setAdminError("Nominal manual wajib diisi dan tidak boleh 0.");
      return;
    }

    setIsAdminSaving(true);
    setAdminError(null);

    try {
      const payload = await requestAdminWalletAdjustment({
        userId: selectedAdminUser.id,
        amount,
        description: manualDescription,
      });
      const users = await requestAdminUsers(deferredAdminSearch);
      setAdminUsers(users);
      setSelectedAdminUserId((current) => {
        if (current && users.some((item) => item.id === current)) {
          return current;
        }

        return users[0]?.id ?? "";
      });

      if (viewer?.id === payload.viewer.id) {
        setViewer(payload.viewer);
        await refreshSummary();
      }

      setManualAmount("");
      setManualDescription("");
      setToast({
        type: "success",
        message: payload.message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal mengubah saldo user.";
      setAdminError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setIsAdminSaving(false);
    }
  }

  async function handleAdminPasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedAdminUser) {
      setAdminError("Pilih user tujuan terlebih dulu.");
      return;
    }

    if (!adminNewPassword.trim()) {
      setAdminError("Password baru wajib diisi.");
      return;
    }

    setIsAdminPasswordSaving(true);
    setAdminError(null);

    try {
      const payload = await requestAdminPasswordReset({
        userId: selectedAdminUser.id,
        newPassword: adminNewPassword,
      });

      if (viewer?.id === payload.viewer.id) {
        setViewer(payload.viewer);
        await refreshSummary();
      }

      setAdminNewPassword("");
      setToast({
        type: "success",
        message: payload.message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal mengganti password user.";
      setAdminError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setIsAdminPasswordSaving(false);
    }
  }

  async function handleAdminBlockToggle() {
    if (!selectedAdminUser) {
      setAdminError("Pilih user tujuan terlebih dulu.");
      return;
    }

    setIsAdminBlockSaving(true);
    setAdminError(null);

    try {
      const payload = await requestAdminBlockUser({
        userId: selectedAdminUser.id,
        blocked: !selectedAdminUser.isBlocked,
      });

      const users = await requestAdminUsers(deferredAdminSearch);
      setAdminUsers(users);
      setSelectedAdminUserId(payload.viewer.id);
      setToast({
        type: "success",
        message: payload.message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal mengubah status user.";
      setAdminError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setIsAdminBlockSaving(false);
    }
  }

  async function handleAdminDeleteUser() {
    if (!selectedAdminUser) {
      setAdminError("Pilih user tujuan terlebih dulu.");
      return;
    }

    const confirmed = window.confirm(
      `Hapus akun ${selectedAdminUser.email}? Data transaksi akan ikut terhapus.`,
    );

    if (!confirmed) {
      return;
    }

    setIsAdminDeleteSaving(true);
    setAdminError(null);

    try {
      const payload = await requestAdminDeleteUser({
        userId: selectedAdminUser.id,
      });

      const users = await requestAdminUsers(deferredAdminSearch);
      setAdminUsers(users);
      setSelectedAdminUserId(users[0]?.id ?? "");
      setToast({
        type: "success",
        message: payload.message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal menghapus user.";
      setAdminError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setIsAdminDeleteSaving(false);
    }
  }

  async function handleRefreshAdminBalance() {
    setAdminBalanceError(null);

    try {
      const balance = await requestUpstreamBalance();
      setAdminBalanceOverride(balance);
    } catch (error) {
      setAdminBalanceError(
        error instanceof Error ? error.message : "Gagal membaca saldo KirimKode.",
      );
    }
  }

  async function handleAdminProfitSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const profitPercent = Number(adminProfitPercent);

    if (!Number.isFinite(profitPercent) || profitPercent < 0) {
      setAdminPricingError("Persentase keuntungan wajib diisi angka 0 atau lebih.");
      return;
    }

    setIsAdminPricingConfigSaving(true);
    setAdminPricingError(null);

    try {
      const payload = await requestAdminProfitPercentUpdate(profitPercent);
      setAdminPricingConfig(payload.config);
      setAdminProfitPercent(String(payload.config.profitPercent));
      const refreshTasks: Promise<unknown>[] = [loadAdminPricingState()];

      if (adminPricingCountryId) {
        refreshTasks.push(loadAdminPricingCatalog(adminPricingServer, adminPricingCountryId));
      }

      if (selectedCountryId) {
        refreshTasks.push(
          requestCatalog(selectedServer, selectedCountryId).then((nextCatalog) => {
            applyMemberCatalogResult(nextCatalog);
          }),
        );
      }

      await Promise.allSettled(refreshTasks);

      setToast({
        type: "success",
        message: payload.message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal menyimpan keuntungan global.";
      setAdminPricingError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setIsAdminPricingConfigSaving(false);
    }
  }

  async function handleAdminServicePriceSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedAdminPricingService || !adminPricingCountryId) {
      setAdminPricingError("Pilih layanan yang ingin diatur terlebih dahulu.");
      return;
    }

    const customPrice = Number(adminCustomPrice);

    if (!Number.isFinite(customPrice) || customPrice <= 0) {
      setAdminPricingError("Harga website wajib diisi angka lebih dari 0.");
      return;
    }

    setIsAdminPricingServiceSaving(true);
    setAdminPricingError(null);

    try {
      const payload = await requestAdminServiceOverrideSave({
        serviceId: selectedAdminPricingService.id,
        serviceCode: selectedAdminPricingService.serviceCode,
        service: selectedAdminPricingService.service,
        serverId: adminPricingServer,
        countryId: adminPricingCountryId,
        country: selectedAdminPricingService.country,
        customPrice,
        upstreamPrice: selectedAdminPricingService.upstreamPrice,
      });
      const refreshTasks: Promise<unknown>[] = [
        loadAdminPricingState(),
        loadAdminPricingCatalog(adminPricingServer, adminPricingCountryId),
      ];

      if (selectedCountryId) {
        refreshTasks.push(
          requestCatalog(selectedServer, selectedCountryId).then((nextCatalog) => {
            applyMemberCatalogResult(nextCatalog);
          }),
        );
      }

      await Promise.allSettled(refreshTasks);

      setToast({
        type: "success",
        message: payload.message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal menyimpan harga layanan.";
      setAdminPricingError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setIsAdminPricingServiceSaving(false);
    }
  }

  async function handleAdminServicePriceReset() {
    if (!selectedAdminPricingService) {
      setAdminPricingError("Pilih layanan yang ingin dikembalikan ke harga otomatis.");
      return;
    }

    setIsAdminPricingServiceSaving(true);
    setAdminPricingError(null);

    try {
      const payload = await requestAdminServiceOverrideDelete(selectedAdminPricingService.id);
      const refreshTasks: Promise<unknown>[] = [loadAdminPricingState()];

      if (adminPricingCountryId) {
        refreshTasks.push(loadAdminPricingCatalog(adminPricingServer, adminPricingCountryId));
      }

      if (selectedCountryId) {
        refreshTasks.push(
          requestCatalog(selectedServer, selectedCountryId).then((nextCatalog) => {
            applyMemberCatalogResult(nextCatalog);
          }),
        );
      }

      await Promise.allSettled(refreshTasks);

      setToast({
        type: "success",
        message: payload.message,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Gagal menghapus harga custom layanan.";
      setAdminPricingError(message);
      setToast({
        type: "error",
        message,
      });
    } finally {
      setIsAdminPricingServiceSaving(false);
    }
  }


  if (!viewer || !summary) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8">
        {toast ? (
          <div
            className={cn(
              "fixed left-1/2 top-5 z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-[18px] border px-4 py-3 text-[13px] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.75)] backdrop-blur-xl",
              toast.type === "success"
                ? "border-emerald-300/20 bg-emerald-500/12 text-emerald-50"
                : toast.type === "error"
                  ? "border-rose-300/20 bg-rose-500/12 text-rose-50"
                  : "border-sky-300/20 bg-sky-500/12 text-sky-50",
            )}
          >
            {toast.message}
          </div>
        ) : null}
        <div className="w-full max-w-[430px] rounded-[28px] border border-white/12 bg-[#0d1a2d]/88 p-5 shadow-[0_28px_90px_-46px_rgba(0,0,0,0.82)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-[18px] font-semibold text-white">Rahmat OTP</p>
              <p className="text-[12px] text-sky-100/70">
                Login member, deposit saldo, lalu order OTP
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 rounded-[18px] border border-white/10 bg-white/5 p-1 text-[13px]">
            <button
              className={cn(
                "rounded-[14px] px-3 py-2 transition",
                authMode === "login"
                  ? "bg-[linear-gradient(135deg,#72eeff,#348cff)] font-medium text-[#071321]"
                  : "text-sky-100/70",
              )}
              onClick={() => setAuthMode("login")}
              type="button"
            >
              Login
            </button>
            <button
              className={cn(
                "rounded-[14px] px-3 py-2 transition",
                authMode === "register"
                  ? "bg-[linear-gradient(135deg,#72eeff,#348cff)] font-medium text-[#071321]"
                  : "text-sky-100/70",
              )}
              onClick={() => setAuthMode("register")}
              type="button"
            >
              Register
            </button>
          </div>

          <form className="mt-5 space-y-3" onSubmit={handleAuthSubmit}>
            {authMode === "register" ? (
              <input
                className="w-full rounded-[16px] border border-white/12 bg-[#091425] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                onChange={(event) => setAuthName(event.target.value)}
                placeholder="Nama akun"
                value={authName}
              />
            ) : null}
            <input
              className="w-full rounded-[16px] border border-white/12 bg-[#091425] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
              onChange={(event) => setAuthEmail(event.target.value)}
              placeholder="Email"
              type="email"
              value={authEmail}
            />
            <input
              className="w-full rounded-[16px] border border-white/12 bg-[#091425] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
              onChange={(event) => setAuthPassword(event.target.value)}
              placeholder="Password"
              type="password"
              value={authPassword}
            />
            {authMode === "login" ? (
              <div className="flex items-center justify-between text-[12px] text-sky-100/70">
                <button
                  className="text-sky-100/80 underline-offset-4 hover:underline"
                  onClick={() => setShowForgotPassword((current) => !current)}
                  type="button"
                >
                  Lupa sandi?
                </button>
                <span>{showForgotPassword ? "Hubungi admin di bawah" : ""}</span>
              </div>
            ) : null}
            {authMode === "login" && showForgotPassword ? (
              <a
                className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3 text-[12px] text-sky-100/80 transition hover:border-emerald-300/30 hover:bg-emerald-500/10"
                href={ADMIN_SUPPORT_LINK.href}
                rel="noreferrer"
                target="_blank"
              >
                <span className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-white">
                    <WhatsAppIcon className="h-5 w-5" />
                  </span>
                  Hubungi admin untuk password sementara
                </span>
                <span className="text-[11px] font-medium text-emerald-200">
                  Chat Admin
                </span>
              </a>
            ) : null}
            {authError ? (
              <div className="rounded-[16px] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
                {authError}
              </div>
            ) : null}
            <button
              className="flex w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#80f0ff,#348cff)] px-4 py-3 text-[14px] font-semibold text-[#06101d]"
              disabled={isAuthLoading}
              type="submit"
            >
              {isAuthLoading ? (
                <Spinner
                  className="text-[#06101d]"
                  label={authMode === "register" ? "Membuat akun..." : "Masuk..."}
                />
              ) : authMode === "register" ? (
                "Buat Akun"
              ) : (
                "Masuk ke Dashboard"
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#0a1325] text-white">
      {toast ? (
        <div
          className={cn(
            "fixed left-1/2 top-5 z-50 w-[calc(100%-2rem)] max-w-[420px] -translate-x-1/2 rounded-[18px] border px-4 py-3 text-[13px] shadow-[0_20px_50px_-28px_rgba(0,0,0,0.75)] backdrop-blur-xl",
            toast.type === "success"
              ? "border-emerald-300/20 bg-emerald-500/12 text-emerald-50"
              : toast.type === "error"
                ? "border-rose-300/20 bg-rose-500/12 text-rose-50"
                : "border-sky-300/20 bg-sky-500/12 text-sky-50",
          )}
        >
          {toast.message}
        </div>
      ) : null}
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col bg-[#0b1426] pb-20 shadow-[0_0_80px_rgba(0,0,0,0.28)]">
        <div className="sticky top-0 z-30 border-b border-slate-600/30 bg-[#101b2d]/98 px-3 py-2.5 backdrop-blur-xl">
          <div className="flex h-10 items-center gap-1.5">
            <button
              aria-controls="member-side-menu"
              aria-expanded={isMenuOpen}
              aria-label="Buka menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-slate-300 transition hover:bg-white/6"
              onClick={() => setIsMenuOpen((current) => !current)}
              type="button"
            >
              <MenuIcon className="h-5 w-5" />
            </button>

            <button
              className="inline-flex h-9 shrink-0 items-center rounded-full border border-emerald-300/24 bg-emerald-400/12 px-3 text-[12px] font-semibold text-emerald-300 shadow-[0_10px_30px_-24px_rgba(16,185,129,0.9)]"
              onClick={() => setActiveTab("deposit")}
              type="button"
            >
              <span className="max-w-[96px] truncate">
                {formatCurrency(summary.viewer.walletBalance, "IDR")}
              </span>
            </button>

            <button
              className="hidden h-9 shrink-0 items-center rounded-[12px] border border-slate-500/24 bg-white/4 px-2.5 text-[12px] font-semibold text-slate-300 min-[340px]:inline-flex"
              type="button"
            >
              <span className="text-emerald-300">ID</span>
              <span className="mx-1.5 text-slate-500">/</span>
              EN
            </button>

            <button
              aria-label="Tema"
              className="ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-slate-400 transition hover:bg-white/6"
              type="button"
            >
              <SunIcon className="h-[18px] w-[18px]" />
            </button>

            <button
              aria-label="Notifikasi"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-slate-400 transition hover:bg-white/6"
              type="button"
            >
              <BellIcon className="h-[18px] w-[18px]" />
            </button>

            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#55d9ef,#5263d6)] text-[15px] font-semibold text-white shadow-[0_12px_30px_-22px_rgba(74,124,255,0.9)]">
              {firstName.slice(0, 1).toUpperCase()}
            </div>
          </div>

          {isMenuOpen ? (
          <div className="fixed inset-0 z-50">
            <button
              aria-label="Tutup menu"
              className="absolute inset-0 bg-black/45"
              onClick={() => setIsMenuOpen(false)}
              type="button"
            />
            <aside
              className="absolute left-0 top-0 h-full w-[80vw] max-w-[304px] border-r border-slate-600/35 bg-[#101b2d] px-4 py-4 shadow-[24px_0_80px_-36px_rgba(0,0,0,0.9)]"
              id="member-side-menu"
            >
              <div className="flex items-center gap-3 border-b border-slate-600/30 pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#55d9ef,#5263d6)] text-[16px] font-semibold text-white">
                  {firstName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-slate-100">
                    {viewer.name}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">
                    {viewer.email}
                  </p>
                </div>
                <button
                  aria-label="Tutup menu"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white/5 text-[15px] font-semibold text-slate-300"
                  onClick={() => setIsMenuOpen(false)}
                  type="button"
                >
                  x
                </button>
              </div>
              <div className="mt-4 grid gap-1.5">
              {[
                { id: "dashboard", label: "Dashboard", icon: <ServerIcon className="h-4 w-4" /> },
                { id: "deposit", label: "Deposit", icon: <WalletIcon className="h-4 w-4" /> },
                { id: "buy", label: "Beli Nomor", icon: <CartIcon className="h-4 w-4" /> },
                { id: "history", label: "Riwayat", icon: <ClockIcon className="h-4 w-4" /> },
                { id: "settings", label: "Pengaturan", icon: <SettingsIcon className="h-4 w-4" /> },
                ...(canAccessAdmin
                  ? [{ id: "admin", label: "Admin", icon: <ShieldIcon className="h-4 w-4" /> }]
                  : []),
              ].map((item) => (
                <button
                  key={item.id}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-[14px] px-3 text-left text-[13px] transition",
                    activeTab === item.id
                      ? "bg-emerald-400/13 text-emerald-100"
                      : "text-slate-300 hover:bg-white/5",
                  )}
                  onClick={() => {
                    setActiveTab(item.id as typeof activeTab);
                    setIsMenuOpen(false);
                  }}
                  type="button"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px] bg-white/5 text-slate-400">
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[12px] text-slate-500">&gt;</span>
                </button>
              ))}
              </div>
            </aside>
          </div>
          ) : null}
        </div>

        {canAccessAdmin ? (
          <div className="mx-4 mt-4 rounded-[18px] border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(95,216,255,0.12),rgba(56,110,255,0.14))] px-4 py-3 text-[12px] text-cyan-50">
            Menu admin aktif untuk akun <span className="font-semibold text-white">{viewer.email}</span>
          </div>
        ) : null}

        <div className="flex-1 px-3 py-4 sm:px-4">

        {dashboardError ? (
          <div className="rounded-[16px] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
            {dashboardError}
          </div>
        ) : null}

        {activeTab === "dashboard" ? (
          <div className="space-y-4 pt-2">
            <div className="px-0.5">
              <h1 className="text-[28px] font-semibold leading-tight text-slate-100">
                Dashboard
              </h1>
              <p className="mt-1.5 text-[14px] leading-6 text-slate-400">
                Selamat datang kembali, {firstName}!
              </p>
              <button
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-emerald-400 px-5 text-[14px] font-semibold text-[#071321] shadow-[0_14px_36px_-22px_rgba(52,211,153,0.9)] transition active:scale-[0.98]"
                onClick={() => setActiveTab("buy")}
                type="button"
              >
                <CartIcon className="h-4 w-4" />
                Beli Nomor
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <DashboardStatCard
                badge="Saldo aktif"
                icon={<WalletIcon className="h-4 w-4" />}
                label="Saldo"
                value={formatCurrency(summary.viewer.walletBalance, "IDR")}
              />
              <DashboardStatCard
                badge={`${todayOrderCount} hari ini`}
                icon={<CartIcon className="h-4 w-4" />}
                label="Total Pembelian"
                value={String(summary.metrics.totalOrders)}
              />
              <DashboardStatCard
                badge={
                  summary.metrics.totalOrders > 0
                    ? `${Math.round((summary.metrics.successfulOtps / summary.metrics.totalOrders) * 100)}% success rate`
                    : "0% success rate"
                }
                icon={<CheckCircleIcon className="h-4 w-4" />}
                label="OTP Berhasil"
                value={String(summary.metrics.successfulOtps)}
              />
              <DashboardStatCard
                badge="Refund otomatis"
                icon={<XCircleIcon className="h-4 w-4" />}
                label="OTP Gagal/Batal"
                tone="rose"
                value={String(failedOrderCount)}
              />
              <DashboardStatCard
                badge={monthLabel}
                icon={<TrendIcon className="h-4 w-4" />}
                label="Pengeluaran Bulan Ini"
                tone="cyan"
                value={formatCurrency(monthlySpend, "IDR")}
              />
              <DashboardStatCard
                badge={`${favoriteService.count}x order`}
                icon={<StarIcon className="h-4 w-4" />}
                label="Layanan Favorit"
                tone="cyan"
                value={favoriteService.name}
              />
            </div>

            <div className="rounded-[20px] border border-slate-600/35 bg-[#111d30] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-[18px] font-semibold text-slate-100">
                  Transaksi Terakhir
                </h2>
                <button
                  className="text-[12px] font-medium text-slate-200"
                  onClick={() => setActiveTab("history")}
                  type="button"
                >
                  Lihat Semua
                </button>
              </div>
              <div className="mt-4 grid grid-cols-[1.1fr_0.8fr_0.9fr] border-b border-slate-500/28 pb-2.5 text-[11px] text-slate-400">
                <span>Layanan</span>
                <span>OTP</span>
                <span>Status</span>
              </div>
              <div className="divide-y divide-slate-500/16">
                {summary.orders.slice(0, 4).map((order) => (
                  <div
                    key={order.id}
                    className="grid grid-cols-[1.1fr_0.8fr_0.9fr] items-center gap-2.5 py-3 text-[11px]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-100">
                        {order.service}
                      </p>
                      <p className="mt-1 truncate text-[10px] text-slate-500">
                        {order.phoneNumber}
                      </p>
                    </div>
                    <span className="truncate font-semibold text-emerald-200">
                      {order.otpCode ?? "-"}
                    </span>
                    <span
                      className={cn(
                        "w-fit rounded-full border px-2 py-0.5 text-[9px] font-semibold",
                        resolveOrderStatusTone(order.status),
                      )}
                    >
                      {resolveOrderStatusLabel(order.status)}
                    </span>
                  </div>
                ))}
                {!summary.orders.length ? (
                  <div className="py-8 text-center text-[13px] text-slate-500">
                    Belum ada transaksi OTP.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "deposit" ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle icon={<WalletIcon className="h-4.5 w-4.5" />} title="Deposit" />
              <form className="mt-4 space-y-3" onSubmit={handleDepositSubmit}>
                <input
                  className="w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                  inputMode="numeric"
                  min={MIN_DEPOSIT_AMOUNT}
                  onChange={(event) => setDepositAmount(event.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Nominal deposit"
                  value={depositAmount}
                />
                <div className="flex flex-wrap gap-2">
                  {[10000, 25000, 50000, 100000].map((amount) => (
                    <button
                      key={amount}
                      className="rounded-full border border-white/10 bg-white/6 px-3 py-1.5 text-[12px] text-sky-100/80"
                      onClick={() => setDepositAmount(String(amount))}
                      type="button"
                    >
                      {formatCurrency(amount, "IDR")}
                    </button>
                  ))}
                </div>
                {depositError ? (
                  <div className="rounded-[16px] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
                    {depositError}
                  </div>
                ) : null}
                <button
                  className="flex w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#7af1ff,#358cff)] px-4 py-3 text-[14px] font-semibold text-[#08101c]"
                  disabled={isDepositLoading}
                  type="submit"
                >
                  {isDepositLoading ? (
                    <Spinner className="text-[#08101c]" label="Membuat QRIS..." />
                  ) : (
                    "Deposit"
                  )}
                </button>
              </form>

              {activeDeposit ? (
                <div className="mt-4 rounded-[22px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(54,140,255,0.14),rgba(255,255,255,0.03))] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[12px] font-medium text-sky-100">QRIS Deposit</p>
                      <p className="mt-1 text-[11px] text-sky-100/65">
                        Status {activeDeposit.status}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] capitalize text-sky-100/80">
                      {activeDeposit.status}
                    </span>
                  </div>
                  {activeDeposit.qrCodeUrl ? (
                    <div className="mt-4 flex justify-center rounded-[18px] bg-white p-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        alt="QRIS Deposit"
                        className="h-56 w-56 rounded-[14px] object-contain"
                        src={activeDeposit.qrCodeUrl}
                      />
                    </div>
                  ) : null}
                  <div className="mt-4 space-y-2 text-[12px] text-sky-100/72">
                    <div className="flex items-center justify-between gap-3">
                      <span>Nominal saldo</span>
                      <span className="text-white">{formatCurrency(activeDeposit.amount, activeDeposit.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Fee</span>
                      <span className="text-white">{formatCurrency(activeDeposit.feeAmount, activeDeposit.currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2">
                      <span>Total bayar</span>
                      <span className="font-semibold text-cyan-100">{formatCurrency(activeDeposit.totalAmount, activeDeposit.currency)}</span>
                    </div>
                    {activeDeposit.expiresAt ? (
                      <div className="text-[11px] text-sky-100/58">
                        Berlaku sampai {formatDateTime(activeDeposit.expiresAt)}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeTab === "buy" ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle icon={<ServerIcon className="h-4.5 w-4.5" />} title="Pilih Server" />
              <div className="mt-4 space-y-2.5">
                {serverOptions.map((server) => (
                  <button
                    key={server.id}
                    className={cn(
                      "w-full rounded-[18px] border px-4 py-3 text-left transition",
                      selectedServer === server.id
                        ? "border-sky-300/55 bg-sky-300/12"
                        : "border-white/10 bg-white/4",
                    )}
                    onClick={() => {
                      setSelectedServer(server.id);
                      setCountries([]);
                      setCatalog(null);
                      setSelectedCountryId(null);
                      setSelectedServiceId("");
                      setSelectedOperator("any");
                    }}
                    type="button"
                  >
                    <p className="text-[13px] font-semibold text-white">{server.name}</p>
                    <p className="mt-1 text-[10px] text-sky-100/62">{server.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<GlobeIcon className="h-4.5 w-4.5" />}
                title="Pilih Negara"
                action={isCountriesLoading ? <span className="text-[11px] text-sky-100/60">Loading...</span> : null}
              />
              <select
                className="mt-4 w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                onChange={(event) => {
                  setSelectedCountryId(Number(event.target.value));
                  setSelectedOperator("any");
                }}
                value={selectedCountryId ?? ""}
              >
                <option value="" disabled>
                  Pilih negara
                </option>
                {countries.map((country) => (
                  <option key={`${country.serverId}-${country.id}`} value={country.id}>
                    {getCountryLabel(country)}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<GlobeIcon className="h-4.5 w-4.5" />}
                title="Operator"
              />
              <div className="mt-4 grid grid-cols-2 gap-2">
                {operatorOptions.map((operator) => (
                  <button
                    key={operator.id}
                    className={cn(
                      "h-10 rounded-[14px] border px-3 text-[12px] font-medium transition",
                      selectedOperator === operator.id
                        ? "border-emerald-300/50 bg-emerald-400/13 text-emerald-100"
                        : "border-white/10 bg-white/4 text-sky-100/72",
                    )}
                    onClick={() => setSelectedOperator(operator.id)}
                    type="button"
                  >
                    {operator.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<CartIcon className="h-4.5 w-4.5" />}
                title="Pilih Layanan"
                action={isCatalogLoading ? <span className="text-[11px] text-sky-100/60">Loading...</span> : null}
              />
              <input
                className="mt-4 w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                onChange={(event) => setServiceSearch(event.target.value)}
                placeholder="Search service..."
                value={serviceSearch}
              />
              <div className="mt-3 max-h-[290px] overflow-y-auto rounded-[18px] border border-white/10 bg-white/4">
                {filteredServices.map((service) => (
                  <button
                    key={service.id}
                    disabled={service.stock <= 0}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 border-b border-white/6 px-4 py-3 text-left last:border-b-0",
                      selectedServiceId === service.id ? "bg-sky-300/10" : "",
                      service.stock <= 0 ? "cursor-not-allowed opacity-60" : "",
                    )}
                    onClick={() => setSelectedServiceId(service.id)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-white">{service.service}</p>
                      <p className="mt-1 text-[11px] text-sky-100/60">
                        {service.serviceCode.toUpperCase()} | {service.stock <= 0 ? "stok habis" : `stok ${service.stock}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-[14px] font-semibold text-cyan-100">
                      {formatCurrency(service.price, service.currency)}
                    </span>
                  </button>
                ))}
                {!filteredServices.length && !isCatalogLoading ? (
                  <div className="px-4 py-6 text-center text-[12px] text-sky-100/56">
                    Layanan belum tersedia untuk pilihan ini.
                  </div>
                ) : null}
              </div>
            </div>

            {selectedService ? (
              <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
                <SectionTitle icon={<WalletIcon className="h-4.5 w-4.5" />} title="Detail Pesanan" />
                <div className="mt-4 space-y-2 text-[12px] text-sky-100/72">
                  <div className="flex items-center justify-between gap-3">
                    <span>Layanan</span>
                    <span className="text-white">{selectedService.service}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Harga</span>
                    <span className="text-white">{formatCurrency(selectedService.price, selectedService.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Operator</span>
                    <span className="text-white">
                      {operatorOptions.find((operator) => operator.id === selectedOperator)?.label ?? "Random"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-2">
                    <span>Saldo Anda</span>
                    <span className="font-semibold text-cyan-100">{formatCurrency(summary.viewer.walletBalance, "IDR")}</span>
                  </div>
                </div>
                {orderError ? (
                  <div className="mt-3 rounded-[16px] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
                    {orderError}
                  </div>
                ) : null}
                <button
                  className={cn(
                    "mt-4 flex w-full items-center justify-center rounded-[18px] px-4 py-3 text-[14px] font-semibold transition",
                    summary.viewer.walletBalance >= selectedService.price && !isSelectedOutOfStock
                      ? "bg-[linear-gradient(135deg,#7af1ff,#358cff)] text-[#08101c]"
                      : "bg-white/8 text-sky-100/55",
                  )}
                  disabled={isOrderLoading || summary.viewer.walletBalance < selectedService.price || isSelectedOutOfStock}
                  onClick={() => {
                    void handleOrderSubmit();
                  }}
                  type="button"
                >
                  {isOrderLoading ? (
                    <Spinner className="text-[#08101c]" label="Memproses order..." />
                  ) : summary.viewer.walletBalance < selectedService.price ? (
                    "Saldo tidak cukup"
                  ) : isSelectedOutOfStock ? (
                    "Stok habis"
                  ) : (
                    "Beli Nomor"
                  )}
                </button>
              </div>
            ) : null}

            {activeOrder ? (
              <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
                <SectionTitle icon={<ClockIcon className="h-4.5 w-4.5" />} title="Status OTP" />
                <div className="mt-4 space-y-2 text-[12px] text-sky-100/72">
                  <div className="flex items-center justify-between gap-3">
                    <span>Status</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold",
                          resolveOrderStatusTone(activeOrder.status),
                        )}
                      >
                        {resolveOrderStatusLabel(activeOrder.status)}
                      </span>
                      {activeOrder.status === "pending" ? (
                        <span className="text-[11px] tabular-nums text-amber-100/82">
                          {formatElapsedTimer(activeOrder.createdAt, nowTimestamp)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Dibuat</span>
                    <span className="text-white">
                      {formatCompactDateTime(activeOrder.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Nomor</span>
                    <span className="max-w-[55%] break-all text-right text-white">
                      {activeOrder.phoneNumber}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>OTP</span>
                    <span className="max-w-[55%] break-all text-right text-[16px] font-semibold text-cyan-100">
                      {activeOrder.otpCode ?? "Menunggu OTP..."}
                    </span>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    className="flex items-center justify-center rounded-[16px] border border-white/10 bg-white/4 px-4 py-3 text-[13px] font-medium text-sky-100/82"
                    disabled={isOrderLoading}
                    onClick={() => {
                      void handleRefreshOrder();
                    }}
                    type="button"
                  >
                    Refresh OTP
                  </button>
                  <button
                    className="flex items-center justify-center rounded-[16px] border border-amber-300/20 bg-amber-500/10 px-4 py-3 text-[13px] font-medium text-amber-100 disabled:opacity-60"
                    disabled={
                      isOrderCancelling ||
                      activeOrder.status !== "pending" ||
                      !canCancelActiveOrder
                    }
                    onClick={() => {
                      void handleCancelOrder();
                    }}
                    type="button"
                  >
                    {isOrderCancelling
                      ? "Membatalkan..."
                      : activeOrder.status !== "pending"
                        ? "Pesanan Selesai"
                        : !canCancelActiveOrder
                          ? `Batalkan ${formatCountdown(activeOrderCancelRemainingSeconds)}`
                          : "Batalkan Pesanan"}
                  </button>
                </div>
                {activeOrder.status === "pending" ? (
                  <p className="mt-3 text-[11px] text-sky-100/58">
                    Saldo otomatis kembali jika pesanan berhasil dibatalkan.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "history" ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<ClockIcon className="h-4.5 w-4.5" />}
                title="Riwayat Deposit"
              />
              <div className="mt-4 space-y-2">
                {summary.deposits.map((deposit) => (
                  <div
                    key={deposit.id}
                    className="rounded-[18px] border border-white/8 bg-white/4 px-3.5 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-medium text-white">
                          Deposit saldo
                        </p>
                        <p className="mt-1 text-[10px] text-sky-100/56">
                          {formatCompactDateTime(deposit.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] font-semibold text-cyan-100">
                          {formatCurrency(deposit.amount, deposit.currency)}
                        </p>
                        <p className="mt-1 text-[10px] capitalize text-sky-100/56">
                          {deposit.status}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {!summary.deposits.length ? (
                  <div className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-6 text-center text-[12px] text-sky-100/56">
                    Belum ada riwayat deposit.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<WalletIcon className="h-4.5 w-4.5" />}
                title="Mutasi Saldo"
                action={<span className="text-[10px] text-sky-100/56">5 terbaru</span>}
              />
              <div className="mt-4 space-y-2">
                {summary.ledger.map((entry: WalletLedgerEntry) => (
                  <div
                    key={entry.id}
                    className="rounded-[18px] border border-white/8 bg-white/4 px-3.5 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[12px] font-medium text-white">
                          {entry.description}
                        </p>
                        <p className="mt-1 text-[10px] text-sky-100/56">
                          {formatCompactDateTime(entry.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-[12px] font-semibold",
                            entry.amount >= 0 ? "text-emerald-200" : "text-amber-100",
                          )}
                        >
                          {entry.amount >= 0 ? "+" : "-"}{formatCurrency(Math.abs(entry.amount), "IDR")}
                        </p>
                        <p className="mt-1 text-[10px] text-sky-100/56">
                          Saldo {formatCurrency(entry.balanceAfter, "IDR")}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {!summary.ledger.length ? (
                  <div className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-6 text-center text-[12px] text-sky-100/56">
                    Belum ada mutasi saldo.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<CartIcon className="h-4.5 w-4.5" />}
                title="Riwayat Order OTP"
              />
              <div className="mt-4 overflow-hidden rounded-[18px] border border-white/10">
                <div className="grid grid-cols-[1.32fr_0.8fr_1fr] gap-2 border-b border-white/10 bg-white/4 px-3 py-2 text-[10px] uppercase tracking-[0.14em] text-sky-100/60">
                  <span>Nomor</span>
                  <span>OTP</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-white/8">
                  {pagedOrders.map((order) => (
                    <div
                      key={order.id}
                      className="grid grid-cols-[1.32fr_0.8fr_1fr] items-center gap-2 px-3 py-3 text-[11px] text-sky-100/80"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-medium text-white">
                            {order.phoneNumber}
                          </span>
                          <button
                            className="shrink-0 rounded-full border border-white/10 bg-white/5 p-1 text-sky-100/70"
                            onClick={() => void handleCopy(order.phoneNumber, "Nomor")}
                            type="button"
                          >
                            <CopyIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <p className="mt-1 text-[10px] text-sky-100/52">
                          {formatCompactDateTime(order.createdAt)}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-emerald-100">
                          <span className="truncate font-semibold tabular-nums">
                            {order.otpCode ?? "-"}
                          </span>
                          {order.otpCode ? (
                            <button
                              className="shrink-0 rounded-full border border-white/10 bg-white/5 p-1 text-sky-100/70"
                              onClick={() => void handleCopy(order.otpCode ?? "", "OTP")}
                              type="button"
                            >
                              <CopyIcon className="h-3.5 w-3.5" />
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold",
                              resolveOrderStatusTone(order.status),
                            )}
                          >
                            {resolveOrderStatusLabel(order.status)}
                          </span>
                          {order.status === "pending" ? (
                            <span className="text-[10px] tabular-nums text-amber-100/84">
                              {formatElapsedTimer(order.createdAt, nowTimestamp)}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-[10px] text-sky-100/52">
                          {formatCompactDateTime(order.updatedAt ?? order.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!pagedOrders.length ? (
                    <div className="px-4 py-6 text-center text-[12px] text-sky-100/56">
                      Belum ada riwayat order OTP.
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between text-[12px] text-sky-100/70">
                <span>
                  Halaman {historyPage} dari {totalHistoryPages}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-sky-100/70 disabled:opacity-40"
                    disabled={historyPage === 1}
                    onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
                    type="button"
                  >
                    Sebelumnya
                  </button>
                  <button
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-sky-100/70 disabled:opacity-40"
                    disabled={historyPage === totalHistoryPages}
                    onClick={() =>
                      setHistoryPage((current) =>
                        Math.min(totalHistoryPages, current + 1),
                      )
                    }
                    type="button"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "settings" ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<SettingsIcon className="h-4.5 w-4.5" />}
                title="Pengaturan Akun"
              />
              <form className="mt-4 space-y-3" onSubmit={handleSettingsSubmit}>
                <input
                  className="w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                  onChange={(event) => setSettingsName(event.target.value)}
                  placeholder="Username"
                  value={settingsName}
                />
                <input
                  className="w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                  onChange={(event) => setSettingsEmail(event.target.value)}
                  placeholder="Email"
                  type="email"
                  value={settingsEmail}
                />
                <input
                  className="w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                  onChange={(event) => setSettingsCurrentPassword(event.target.value)}
                  placeholder="Password saat ini"
                  type="password"
                  value={settingsCurrentPassword}
                />
                <input
                  className="w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                  onChange={(event) => setSettingsNewPassword(event.target.value)}
                  placeholder="Password baru (opsional)"
                  type="password"
                  value={settingsNewPassword}
                />
                {settingsError ? (
                  <div className="rounded-[16px] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
                    {settingsError}
                  </div>
                ) : null}
                <button
                  className="flex w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#7af1ff,#358cff)] px-4 py-3 text-[14px] font-semibold text-[#08101c]"
                  disabled={isSettingsLoading}
                  type="submit"
                >
                  {isSettingsLoading ? (
                    <Spinner className="text-[#08101c]" label="Menyimpan..." />
                  ) : (
                    "Simpan Pengaturan"
                  )}
                </button>
              </form>
            </div>

            <div className="space-y-3 rounded-[24px] border border-white/10 bg-[#0a1525] p-4 text-[13px] leading-6 text-sky-100/72">
              <SectionTitle
                icon={<ShieldIcon className="h-4.5 w-4.5" />}
                title="Keamanan"
              />
              <button
                className="w-full rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-[13px] font-medium text-sky-100/80"
                onClick={() => {
                  void handleLogout();
                }}
                type="button"
              >
                Logout Akun
              </button>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<WhatsAppIcon className="h-5 w-5" />}
                title="Kontak WhatsApp"
              />
              <div className="mt-4 space-y-3">
                {SUPPORT_LINKS.map((item) => (
                  <a
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 transition hover:border-emerald-300/30 hover:bg-emerald-500/10"
                    href={item.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-white">
                        <WhatsAppIcon className="h-6 w-6" />
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold text-white">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-sky-100/62">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-medium text-emerald-200">
                      Buka Chat
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {activeTab === "admin" && canAccessAdmin ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<WalletIcon className="h-4.5 w-4.5" />}
                title="Saldo KirimKode"
                action={
                  <button
                    className="rounded-[12px] border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-sky-100/70 transition hover:border-sky-300/40"
                    onClick={() => void handleRefreshAdminBalance()}
                    type="button"
                  >
                    Refresh
                  </button>
                }
              />
              <div className="mt-4 rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                <p className="text-[11px] uppercase tracking-[0.16em] text-sky-100/55">
                  Upstream Balance
                </p>
                <p className="mt-3 text-[20px] font-semibold text-cyan-100">
                  {adminBalanceOverride ?? summary.admin?.upstreamBalance
                    ? formatCurrency(
                        (adminBalanceOverride ?? summary.admin?.upstreamBalance)?.amount ?? 0,
                        (adminBalanceOverride ?? summary.admin?.upstreamBalance)?.currency ??
                          "IDR",
                      )
                    : "Tidak tersedia"}
                </p>
                <p className="mt-2 text-[11px] text-sky-100/58">
                  {adminBalanceOverride
                    ? `Update ${formatDateTime(adminBalanceOverride.updatedAt)}`
                    : summary.admin?.upstreamBalance
                      ? `Update ${formatDateTime(summary.admin.upstreamBalance.updatedAt)}`
                      : adminBalanceError ??
                        summary.admin?.upstreamBalanceError ??
                      "Saldo akun KirimKode belum bisa dibaca."}
                </p>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<CartIcon className="h-4.5 w-4.5" />}
                title="Pengaturan Harga"
                action={
                  isAdminPricingLoading ? (
                    <span className="text-[11px] text-sky-100/60">Loading...</span>
                  ) : null
                }
              />
              <form className="mt-4 space-y-3" onSubmit={handleAdminProfitSubmit}>
                <div className="rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                  <p className="text-[12px] font-medium text-white">
                    Persentase keuntungan global
                  </p>
                  <p className="mt-1 text-[11px] text-sky-100/58">
                    Harga website mengikuti harga asli KirimKode lalu ditambah profit
                    persen ini.
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      className="w-full rounded-[14px] border border-white/10 bg-[#07111f] px-4 py-3 text-[13px] text-white outline-none transition focus:border-sky-300/60"
                      inputMode="decimal"
                      onChange={(event) =>
                        setAdminProfitPercent(event.target.value.replace(/[^\d.]/g, ""))
                      }
                      placeholder="Contoh 100"
                      value={adminProfitPercent}
                    />
                    <button
                      className="shrink-0 rounded-[14px] bg-[linear-gradient(135deg,#7af1ff,#358cff)] px-4 py-3 text-[12px] font-semibold text-[#08101c]"
                      disabled={isAdminPricingConfigSaving}
                      type="submit"
                    >
                      {isAdminPricingConfigSaving ? "Simpan..." : "Simpan"}
                    </button>
                  </div>
                  {adminPricingConfig ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-sky-100/68">
                      <div className="rounded-[14px] border border-white/8 bg-[#0a1525] px-3 py-2">
                        Profit aktif {adminPricingConfig.profitPercent}%
                      </div>
                      <div className="rounded-[14px] border border-white/8 bg-[#0a1525] px-3 py-2">
                        Override aktif {adminPriceOverrides.length}
                      </div>
                    </div>
                  ) : null}
                </div>
              </form>

              <div className="mt-4 rounded-[18px] border border-white/10 bg-white/4 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <select
                    className="w-full rounded-[14px] border border-white/10 bg-[#07111f] px-3 py-3 text-[12px] text-white outline-none transition focus:border-sky-300/60"
                    onChange={(event) => {
                      setAdminPricingServer(event.target.value as ServerId);
                      setAdminPricingCountries([]);
                      setAdminPricingCountryId(null);
                      setAdminPricingCatalog(null);
                      setSelectedAdminPricingServiceId("");
                    }}
                    value={adminPricingServer}
                  >
                    {serverOptions.map((server) => (
                      <option key={server.id} value={server.id}>
                        {server.name}
                      </option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded-[14px] border border-white/10 bg-[#07111f] px-3 py-3 text-[12px] text-white outline-none transition focus:border-sky-300/60"
                    disabled={isAdminPricingCountriesLoading}
                    onChange={(event) => setAdminPricingCountryId(Number(event.target.value))}
                    value={adminPricingCountryId ?? ""}
                  >
                    <option value="" disabled>
                      {isAdminPricingCountriesLoading ? "Memuat negara..." : "Pilih negara"}
                    </option>
                    {adminPricingCountries.map((country) => (
                      <option key={`${country.serverId}-${country.id}`} value={country.id}>
                        {getCountryLabel(country)}
                      </option>
                    ))}
                  </select>
                </div>
                <input
                  className="mt-3 w-full rounded-[14px] border border-white/10 bg-[#07111f] px-4 py-3 text-[12px] text-white outline-none transition focus:border-sky-300/60"
                  onChange={(event) => setAdminPricingSearch(event.target.value)}
                  placeholder="Cari layanan untuk harga custom..."
                  value={adminPricingSearch}
                />

                <div className="mt-3 max-h-[220px] space-y-2 overflow-y-auto rounded-[16px] border border-white/10 bg-[#0a1525] p-2">
                  {filteredAdminPricingServices.map((service) => (
                    <button
                      key={service.id}
                      className={cn(
                        "w-full rounded-[14px] border px-3 py-3 text-left transition",
                        selectedAdminPricingServiceId === service.id
                          ? "border-sky-300/55 bg-sky-300/12"
                          : "border-white/10 bg-white/4",
                      )}
                      onClick={() => setSelectedAdminPricingServiceId(service.id)}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-white">
                            {service.service}
                          </p>
                          <p className="mt-1 text-[10px] text-sky-100/56">
                            {service.serviceCode.toUpperCase()} | stok {service.stock}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[12px] font-semibold text-cyan-100">
                            {formatCurrency(service.price, service.currency)}
                          </p>
                          <p className="mt-1 text-[10px] text-sky-100/56">
                            Asli {formatCurrency(service.upstreamPrice, service.currency)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                  {!filteredAdminPricingServices.length && !isAdminPricingCatalogLoading ? (
                    <div className="rounded-[14px] border border-white/8 bg-white/4 px-4 py-5 text-center text-[12px] text-sky-100/56">
                      Layanan belum tersedia untuk negara ini.
                    </div>
                  ) : null}
                  {isAdminPricingCatalogLoading ? (
                    <div className="rounded-[14px] border border-white/8 bg-white/4 px-4 py-5 text-center text-[12px] text-sky-100/56">
                      <Spinner label="Memuat katalog harga..." />
                    </div>
                  ) : null}
                </div>

                {selectedAdminPricingService ? (
                  <form
                    className="mt-3 rounded-[16px] border border-white/10 bg-[#0a1525] px-4 py-3"
                    onSubmit={handleAdminServicePriceSubmit}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-semibold text-white">
                          {selectedAdminPricingService.service}
                        </p>
                        <p className="mt-1 text-[10px] text-sky-100/58">
                          {selectedAdminPricingService.country} -{" "}
                          {selectedAdminPricingService.serviceCode.toUpperCase()}
                        </p>
                      </div>
                      {selectedAdminServiceOverride ? (
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-medium text-emerald-100">
                          Custom aktif
                        </span>
                      ) : (
                        <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-[10px] font-medium text-sky-100/68">
                          Auto
                        </span>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-sky-100/68">
                      <div className="rounded-[14px] border border-white/8 bg-white/4 px-3 py-2">
                        Harga asli{" "}
                        <span className="font-semibold text-white">
                          {formatCurrency(
                            selectedAdminPricingService.upstreamPrice,
                            selectedAdminPricingService.currency,
                          )}
                        </span>
                      </div>
                      <div className="rounded-[14px] border border-white/8 bg-white/4 px-3 py-2">
                        Harga website{" "}
                        <span className="font-semibold text-cyan-100">
                          {formatCurrency(
                            selectedAdminPricingService.price,
                            selectedAdminPricingService.currency,
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <input
                        className="w-full rounded-[14px] border border-white/10 bg-[#07111f] px-4 py-3 text-[13px] text-white outline-none transition focus:border-sky-300/60"
                        inputMode="numeric"
                        onChange={(event) =>
                          setAdminCustomPrice(event.target.value.replace(/[^\d]/g, ""))
                        }
                        placeholder="Harga custom website"
                        value={adminCustomPrice}
                      />
                      <button
                        className="shrink-0 rounded-[14px] bg-[linear-gradient(135deg,#7af1ff,#358cff)] px-4 py-3 text-[12px] font-semibold text-[#08101c]"
                        disabled={isAdminPricingServiceSaving}
                        type="submit"
                      >
                        {isAdminPricingServiceSaving ? "Simpan..." : "Simpan"}
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        className="rounded-[14px] border border-white/10 bg-white/6 px-3 py-2 text-[11px] text-sky-100/78 disabled:opacity-50"
                        disabled={isAdminPricingServiceSaving || !selectedAdminServiceOverride}
                        onClick={() => {
                          void handleAdminServicePriceReset();
                        }}
                        type="button"
                      >
                        Hapus custom
                      </button>
                      <span className="text-[10px] text-sky-100/52">
                        Jika dihapus, harga kembali mengikuti profit global.
                      </span>
                    </div>
                  </form>
                ) : null}
              </div>

              {adminPricingError ? (
                <div className="mt-3 rounded-[16px] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
                  {adminPricingError}
                </div>
              ) : null}

              <div className="mt-4 rounded-[18px] border border-white/10 bg-white/4 p-3">
                <p className="text-[12px] font-medium text-white">Override Harga Aktif</p>
                <div className="mt-3 space-y-2">
                  {adminPriceOverrides.slice(0, 8).map((override) => (
                    <div
                      key={override.serviceId}
                      className="flex items-center justify-between gap-3 rounded-[14px] border border-white/8 bg-[#0a1525] px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-white">
                          {override.service}
                        </p>
                        <p className="mt-1 text-[10px] text-sky-100/56">
                          {override.country} - {override.serviceCode.toUpperCase()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] font-semibold text-cyan-100">
                          {formatCurrency(override.customPrice, "IDR")}
                        </p>
                        <p className="mt-1 text-[10px] text-sky-100/56">
                          Asli {formatCurrency(override.upstreamPrice, "IDR")}
                        </p>
                      </div>
                    </div>
                  ))}
                  {!adminPriceOverrides.length ? (
                    <div className="rounded-[14px] border border-white/8 bg-[#0a1525] px-4 py-5 text-center text-[12px] text-sky-100/56">
                      Belum ada override harga custom.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<ShieldIcon className="h-4.5 w-4.5" />}
                title="Admin Panel"
                action={
                  isAdminUsersLoading ? (
                    <span className="text-[11px] text-sky-100/60">Loading...</span>
                  ) : (
                    <button
                      className="rounded-[12px] border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-sky-100/70 transition hover:border-sky-300/40"
                      onClick={() => void loadAdminUsers(deferredAdminSearch)}
                      type="button"
                    >
                      Refresh
                    </button>
                  )
                }
              />
              <input
                className="mt-4 w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                onChange={(event) => setAdminSearch(event.target.value)}
                placeholder="Cari user berdasarkan nama atau email..."
                value={adminSearch}
              />
              <div className="mt-3 max-h-[240px] space-y-2 overflow-y-auto rounded-[18px] border border-white/10 bg-white/4 p-2">
                {adminUsers.map((user) => (
                  <button
                    key={user.id}
                    className={cn(
                      "w-full rounded-[16px] border px-3 py-3 text-left transition",
                      selectedAdminUserId === user.id
                        ? "border-sky-300/55 bg-sky-300/12"
                        : "border-white/10 bg-[#0a1525]",
                    )}
                    onClick={() => setSelectedAdminUserId(user.id)}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-white">
                          {user.name}
                        </p>
                        <p className="mt-1 truncate text-[11px] text-sky-100/60">
                          {user.email}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] font-semibold text-cyan-100">
                          {formatCurrency(user.walletBalance, "IDR")}
                        </p>
                        <p className="mt-1 text-[10px] uppercase text-sky-100/55">
                          {user.isBlocked ? "blocked" : user.role}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
                {!adminUsers.length && !isAdminUsersLoading ? (
                  <div className="rounded-[16px] border border-white/8 bg-[#0a1525] px-4 py-5 text-center text-[12px] text-sky-100/56">
                    Data user belum ada.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<UserIcon className="h-4.5 w-4.5" />}
                title="Kelola User"
              />
              {selectedAdminUser ? (
                <div className="mt-4 rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                  <p className="text-[13px] font-semibold text-white">
                    {selectedAdminUser.name}
                  </p>
                  <p className="mt-1 text-[11px] text-sky-100/60">
                    {selectedAdminUser.email}
                  </p>
                  <p className="mt-2 text-[12px] text-sky-100/70">
                    Status: {selectedAdminUser.isBlocked ? "Diblokir" : "Aktif"}
                  </p>
                </div>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  className="flex items-center justify-center rounded-[16px] border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-medium text-sky-100/80"
                  disabled={!selectedAdminUser || isAdminBlockSaving}
                  onClick={() => void handleAdminBlockToggle()}
                  type="button"
                >
                  {isAdminBlockSaving
                    ? "Menyimpan..."
                    : selectedAdminUser?.isBlocked
                      ? "Buka Blokir"
                      : "Blokir"}
                </button>
                <button
                  className="flex items-center justify-center rounded-[16px] border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-[12px] font-semibold text-rose-100"
                  disabled={!selectedAdminUser || isAdminDeleteSaving}
                  onClick={() => void handleAdminDeleteUser()}
                  type="button"
                >
                  {isAdminDeleteSaving ? "Menghapus..." : "Hapus Akun"}
                </button>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<UserIcon className="h-4.5 w-4.5" />}
                title="Saldo Manual User"
              />
              {selectedAdminUser ? (
                <div className="mt-4 rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                  <p className="text-[13px] font-semibold text-white">
                    {selectedAdminUser.name}
                  </p>
                  <p className="mt-1 text-[11px] text-sky-100/60">
                    {selectedAdminUser.email}
                  </p>
                  <p className="mt-2 text-[12px] text-cyan-100">
                    Saldo sekarang{" "}
                    {formatCurrency(selectedAdminUser.walletBalance, "IDR")}
                  </p>
                </div>
              ) : null}
              <form className="mt-4 space-y-3" onSubmit={handleAdminBalanceSubmit}>
                <input
                  className="w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                  inputMode="numeric"
                  onChange={(event) =>
                    setManualAmount(event.target.value.replace(/[^\d-]/g, ""))
                  }
                  placeholder="Nominal. Contoh 10000 atau -5000"
                  value={manualAmount}
                />
                <input
                  className="w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                  onChange={(event) => setManualDescription(event.target.value)}
                  placeholder="Keterangan manual admin"
                  value={manualDescription}
                />
                <p className="text-[11px] text-sky-100/58">
                  Angka positif menambah saldo. Angka negatif memotong saldo.
                </p>
                {adminError ? (
                  <div className="rounded-[16px] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
                    {adminError}
                  </div>
                ) : null}
                <button
                  className="flex w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#7af1ff,#358cff)] px-4 py-3 text-[14px] font-semibold text-[#08101c]"
                  disabled={isAdminSaving || !selectedAdminUser}
                  type="submit"
                >
                  {isAdminSaving ? (
                    <Spinner className="text-[#08101c]" label="Menyimpan..." />
                  ) : (
                    "Simpan Saldo Manual"
                  )}
                </button>
              </form>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<ShieldIcon className="h-4.5 w-4.5" />}
                title="Reset Password User"
              />
              {selectedAdminUser ? (
                <div className="mt-4 rounded-[18px] border border-white/10 bg-white/4 px-4 py-3">
                  <p className="text-[13px] font-semibold text-white">
                    {selectedAdminUser.name}
                  </p>
                  <p className="mt-1 text-[11px] text-sky-100/60">
                    {selectedAdminUser.email}
                  </p>
                </div>
              ) : null}
              <form className="mt-4 space-y-3" onSubmit={handleAdminPasswordReset}>
                <input
                  className="w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                  onChange={(event) => setAdminNewPassword(event.target.value)}
                  placeholder="Password baru untuk user"
                  type="password"
                  value={adminNewPassword}
                />
                <p className="text-[11px] text-sky-100/58">
                  Password minimal 6 karakter. Informasikan ke user setelah diganti.
                </p>
                {adminError ? (
                  <div className="rounded-[16px] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
                    {adminError}
                  </div>
                ) : null}
                <button
                  className="flex w-full items-center justify-center rounded-[18px] bg-[linear-gradient(135deg,#7af1ff,#358cff)] px-4 py-3 text-[14px] font-semibold text-[#08101c]"
                  disabled={isAdminPasswordSaving || !selectedAdminUser}
                  type="submit"
                >
                  {isAdminPasswordSaving ? (
                    <Spinner className="text-[#08101c]" label="Menyimpan..." />
                  ) : (
                    "Simpan Password Baru"
                  )}
                </button>
              </form>
            </div>
          </div>
        ) : null}

        {isSummaryLoading ? (
          <div className="rounded-[16px] border border-white/8 bg-white/4 px-4 py-3 text-center text-[12px] text-sky-100/56">
            <Spinner label="Memuat ulang dashboard..." />
          </div>
        ) : null}
        </div>

        <a
          aria-label="Hubungi admin"
          className="fixed bottom-6 right-5 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-[#1397d6] text-white shadow-[0_24px_70px_-24px_rgba(19,151,214,0.95)] transition active:scale-95"
          href={ADMIN_SUPPORT_LINK.href}
          rel="noreferrer"
          target="_blank"
        >
          <TelegramIcon className="h-8 w-8" />
        </a>
      </div>
    </div>
  );
}
