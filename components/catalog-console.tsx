"use client";

import Image from "next/image";
import {
  type ReactNode,
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useState,
} from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type {
  CatalogResponse,
  CountryOption,
  Order,
  PaymentRecord,
  Service,
} from "@/lib/types";

type CatalogConsoleProps = {
  initialCatalog: CatalogResponse | null;
  initialCountries: CountryOption[];
  initialCountryId: number | null;
};

type ServerId = "bimasakti" | "mars";

type CountriesResponse = {
  updatedAt: string;
  total: number;
  countries: CountryOption[];
};

type TransactionsResponse = {
  updatedAt: string;
  total: number;
  transactions: PaymentRecord[];
};

const serverOptions = [
  {
    id: "bimasakti" as const,
    name: "Skyword",
    code: "api1",
    iconKey: "mars" as const,
    description: "Server utama, stok terbanyak",
  },
  {
    id: "mars" as const,
    name: "Blueverifiy",
    code: "api2",
    iconKey: "saturn" as const,
    description: "Server cadangan, lebih stabil",
  },
];

function ShellIcon({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/14 bg-sky-100/12 text-sky-50 shadow-[0_16px_30px_-22px_rgba(116,195,255,0.95)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function BrandIcon({ className }: { className?: string }) {
  const brandId = useId().replace(/:/g, "");
  const shellGradientId = `${brandId}-shell`;
  const coreGradientId = `${brandId}-core`;
  const auraGradientId = `${brandId}-aura`;
  const flareGradientId = `${brandId}-flare`;

  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <defs>
        <linearGradient id={shellGradientId} x1="4" x2="20" y1="4" y2="20" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8fbff">
            <animate
              attributeName="stop-color"
              dur="6.2s"
              repeatCount="indefinite"
              values="#f8fbff;#9cefff;#f8fbff"
            />
          </stop>
          <stop offset="0.36" stopColor="#7ae3ff">
            <animate
              attributeName="stop-color"
              dur="4.8s"
              repeatCount="indefinite"
              values="#7ae3ff;#67c1ff;#b988ff;#7ae3ff"
            />
          </stop>
          <stop offset="0.7" stopColor="#5b9dff">
            <animate
              attributeName="stop-color"
              dur="5.4s"
              repeatCount="indefinite"
              values="#5b9dff;#63d6ff;#5b9dff"
            />
          </stop>
          <stop offset="1" stopColor="#935dff">
            <animate
              attributeName="stop-color"
              dur="5s"
              repeatCount="indefinite"
              values="#935dff;#ff7db3;#935dff"
            />
          </stop>
        </linearGradient>
        <linearGradient id={coreGradientId} x1="8" x2="16.8" y1="7" y2="17.6" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffe89d">
            <animate
              attributeName="stop-color"
              dur="4.6s"
              repeatCount="indefinite"
              values="#ffe89d;#fff5c8;#ffe89d"
            />
          </stop>
          <stop offset="0.28" stopColor="#ff9f67">
            <animate
              attributeName="stop-color"
              dur="5.4s"
              repeatCount="indefinite"
              values="#ff9f67;#ff7291;#ff9f67"
            />
          </stop>
          <stop offset="0.62" stopColor="#53dbff">
            <animate
              attributeName="stop-color"
              dur="4.2s"
              repeatCount="indefinite"
              values="#53dbff;#9af7ff;#53dbff"
            />
          </stop>
          <stop offset="1" stopColor="#7d67ff">
            <animate
              attributeName="stop-color"
              dur="4.8s"
              repeatCount="indefinite"
              values="#7d67ff;#aa76ff;#7d67ff"
            />
          </stop>
        </linearGradient>
        <radialGradient id={auraGradientId} cx="0" cy="0" r="1" gradientTransform="translate(12 12) rotate(90) scale(9.5)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d8fdff" stopOpacity="0.95" />
          <stop offset="1" stopColor="#d8fdff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={flareGradientId} cx="0" cy="0" r="1" gradientTransform="translate(16.8 7.3) rotate(90) scale(3.2)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff8bf" stopOpacity="0.95" />
          <stop offset="1" stopColor="#fff8bf" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" fill={`url(#${auraGradientId})`} r="9.4">
        <animate
          attributeName="opacity"
          dur="4.2s"
          repeatCount="indefinite"
          values="0.92;0.68;0.96;0.92"
        />
      </circle>
      <circle cx="16.8" cy="7.2" fill={`url(#${flareGradientId})`} r="3.1">
        <animate
          attributeName="opacity"
          dur="3s"
          repeatCount="indefinite"
          values="0.92;0.38;0.92"
        />
      </circle>
      <path
        d="M12 2.8l6.8 2.7v6.1c0 4.7-2.8 8.9-6.8 10.9-4-2-6.8-6.2-6.8-10.9V5.5L12 2.8z"
        fill={`url(#${shellGradientId})`}
        fillOpacity=".2"
      />
      <path
        d="M12 5.1l4.6 1.8v4.4c0 3.5-1.9 6.7-4.6 8.5-2.7-1.8-4.6-5-4.6-8.5V6.9L12 5.1z"
        stroke={`url(#${shellGradientId})`}
        strokeWidth="1.6"
      />
      <path
        d="M9.1 15.1l2.7-6.6 2.1 3.2 2-1"
        stroke={`url(#${coreGradientId})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <path
        d="M11.8 11.7l3.6 3.3"
        stroke={`url(#${coreGradientId})`}
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="16.8" cy="7.2" fill="#fff2ae" r="1.1">
        <animate
          attributeName="r"
          dur="2.6s"
          repeatCount="indefinite"
          values="1.1;1.35;1.1"
        />
      </circle>
      <circle cx="7.1" cy="8.3" fill="#7be8ff" fillOpacity=".95" r="0.9">
        <animate
          attributeName="opacity"
          dur="2.2s"
          repeatCount="indefinite"
          values="0.95;0.4;0.95"
        />
      </circle>
      <circle cx="8.3" cy="16.4" fill="#9ef9ff" fillOpacity=".66" r="0.75">
        <animate
          attributeName="r"
          dur="3.4s"
          repeatCount="indefinite"
          values="0.75;1.05;0.75"
        />
        <animate
          attributeName="opacity"
          dur="3.4s"
          repeatCount="indefinite"
          values="0.66;0.2;0.66"
        />
      </circle>
    </svg>
  );
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <rect
        height="5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        width="16"
        x="4"
        y="5"
      />
      <rect
        height="5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.8"
        width="16"
        x="4"
        y="14"
      />
      <circle cx="8" cy="7.5" fill="currentColor" r="1" />
      <circle cx="8" cy="16.5" fill="currentColor" r="1" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.7 9h14.6M4.7 15h14.6M12 4c2.2 2.2 3.4 5 3.4 8S14.2 17.8 12 20m0-16c-2.2 2.2-3.4 5-3.4 8S9.8 17.8 12 20"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function ServiceIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M4.5 5.5h2.3l1.4 8.2h8.8l2-6H8.7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle cx="10" cy="18" fill="currentColor" r="1.5" />
      <circle cx="17" cy="18" fill="currentColor" r="1.5" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="6.3" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M16 16l3.8 3.8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function ServiceStarIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 4.8l1.9 4 4.4.5-3.2 3 1 4.4-4.1-2.2-4.1 2.2 1-4.4-3.2-3 4.4-.5 1.9-4z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function MarsIcon({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={cn("provider-svg-icon provider-svg-icon-mars", className)}
      height={96}
      src="/mars-provider.svg"
      unoptimized
      width={96}
    />
  );
}

function SaturnIcon({ className }: { className?: string }) {
  return (
    <Image
      alt=""
      aria-hidden="true"
      className={cn("provider-svg-icon provider-svg-icon-saturn", className)}
      height={96}
      src="/saturn-provider.svg"
      unoptimized
      width={96}
    />
  );
}

function MenuOrbIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M8 12h8M9.5 8.7h5M9.5 15.3h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 6.5h14M5 12h14M5 17.5h9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="17.5" cy="17.5" fill="currentColor" r="1.4" />
    </svg>
  );
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 10v5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="7.3" fill="currentColor" r="1.1" />
    </svg>
  );
}

function ChevronIcon({
  className,
  open = false,
}: {
  className?: string;
  open?: boolean;
}) {
  return (
    <svg
      aria-hidden="true"
      className={cn("transition-transform", open && "rotate-180", className)}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M7 10l5 5 5-5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function getServerGlyph(iconKey: (typeof serverOptions)[number]["iconKey"]) {
  if (iconKey === "saturn") {
    return <SaturnIcon className="h-6 w-6" />;
  }

  return <MarsIcon className="h-6 w-6" />;
}

function getServerLabel(serverId?: string) {
  return serverOptions.find((server) => server.id === toServerId(serverId))?.name ?? "Skyword";
}

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

function getCountryGlyph(country?: Pick<CountryOption, "code" | "flagEmoji"> | null) {
  return toFlagEmoji(country?.code) ?? country?.flagEmoji ?? "\u{1F310}";
}

function getSafeCountryGlyph(country?: Pick<CountryOption, "code"> | null) {
  if (hasCountryCode(country)) {
    return getCountryGlyph(country as Pick<CountryOption, "code" | "flagEmoji">);
  }

  return "\u{1F310}";
}

function hasCountryCode(country?: Pick<CountryOption, "code"> | null) {
  return Boolean(country?.code && /^[a-z]{2}$/i.test(country.code));
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const ACTIVE_PAYMENT_STORAGE_KEY = "rahmat-otp-active-payment";
const TRANSACTIONS_STORAGE_KEY = "rahmat-otp-transactions";

type StoredActivePayment = {
  id: string;
  token?: string;
};

function mergeOrders(left?: Order, right?: Order) {
  if (!left) {
    return right;
  }

  if (!right) {
    return left;
  }

  return {
    ...left,
    ...right,
    otpCode: right.otpCode ?? left.otpCode,
    contextToken: right.contextToken ?? left.contextToken,
  };
}

function mergePaymentRecord(left: PaymentRecord, right: PaymentRecord) {
  const leftUpdatedAt = new Date(left.updatedAt || left.createdAt).getTime();
  const rightUpdatedAt = new Date(right.updatedAt || right.createdAt).getTime();
  const newest = rightUpdatedAt >= leftUpdatedAt ? right : left;
  const oldest = newest === right ? left : right;

  return {
    ...oldest,
    ...newest,
    order: mergeOrders(oldest.order, newest.order),
    qrCodeUrl: newest.qrCodeUrl ?? oldest.qrCodeUrl,
    qrString: newest.qrString ?? oldest.qrString,
    sessionToken: newest.sessionToken ?? oldest.sessionToken,
    paidAt: newest.paidAt ?? oldest.paidAt,
    statusMessage: newest.statusMessage ?? oldest.statusMessage,
  } satisfies PaymentRecord;
}

function mergePaymentCollections(...collections: PaymentRecord[][]) {
  const merged = new Map<string, PaymentRecord>();

  for (const collection of collections) {
    for (const payment of collection) {
      if (!payment?.id) {
        continue;
      }

      const current = merged.get(payment.id);
      merged.set(payment.id, current ? mergePaymentRecord(current, payment) : payment);
    }
  }

  return [...merged.values()]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, 20);
}

function readStoredTransactions() {
  if (typeof window === "undefined") {
    return [] as PaymentRecord[];
  }

  try {
    const raw = window.localStorage.getItem(TRANSACTIONS_STORAGE_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (item): item is PaymentRecord =>
        Boolean(item && typeof item === "object" && "id" in item),
    );
  } catch {
    return [];
  }
}

function writeStoredTransactions(payments: PaymentRecord[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    TRANSACTIONS_STORAGE_KEY,
    JSON.stringify(mergePaymentCollections(payments)),
  );
}

function upsertStoredTransaction(payment: PaymentRecord) {
  const merged = mergePaymentCollections([payment], readStoredTransactions());
  writeStoredTransactions(merged);

  return merged;
}

function readStoredActivePayment() {
  if (typeof window === "undefined") {
    return null as StoredActivePayment | null;
  }

  try {
    const raw = window.localStorage.getItem(ACTIVE_PAYMENT_STORAGE_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !("id" in parsed) ||
      typeof parsed.id !== "string"
    ) {
      return null;
    }

    return {
      id: parsed.id,
      token:
        "token" in parsed && typeof parsed.token === "string"
          ? parsed.token
          : undefined,
    } satisfies StoredActivePayment;
  } catch {
    return null;
  }
}

function shouldRememberActivePayment(payment: PaymentRecord | null) {
  if (!payment) {
    return false;
  }

  if (payment.status === "pending") {
    return true;
  }

  if (payment.status === "paid" && !payment.order) {
    return true;
  }

  return payment.order?.status === "pending";
}

function writeStoredActivePayment(payment: PaymentRecord | null) {
  if (typeof window === "undefined") {
    return;
  }

  if (!payment || !shouldRememberActivePayment(payment)) {
    window.localStorage.removeItem(ACTIVE_PAYMENT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(
    ACTIVE_PAYMENT_STORAGE_KEY,
    JSON.stringify({
      id: payment.id,
      token: payment.sessionToken,
    } satisfies StoredActivePayment),
  );
}

function toServerId(serverId?: string): ServerId {
  return serverId === "mars" ? "mars" : "bimasakti";
}

type FeedbackTone = "open" | "select" | "confirm";

function playUiFeedback(tone: FeedbackTone) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(tone === "confirm" ? [14, 18, 12] : 8);
    }
  } catch {
    // Ignore vibration failures on unsupported devices.
  }

  const browserWindow = window as typeof window & {
    webkitAudioContext?: typeof AudioContext;
    __rahmatAudioContext?: AudioContext;
  };
  const AudioCtor = browserWindow.AudioContext ?? browserWindow.webkitAudioContext;

  if (!AudioCtor) {
    return;
  }

  try {
    const audioContext =
      browserWindow.__rahmatAudioContext ?? new AudioCtor();
    browserWindow.__rahmatAudioContext = audioContext;

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const toneMap = {
      open: { start: 520, end: 660, volume: 0.012, type: "triangle" as const, duration: 0.09 },
      select: { start: 660, end: 760, volume: 0.01, type: "sine" as const, duration: 0.07 },
      confirm: { start: 560, end: 880, volume: 0.016, type: "triangle" as const, duration: 0.13 },
    } as const;
    const preset = toneMap[tone];

    if (audioContext.state === "suspended") {
      void audioContext.resume();
    }

    oscillator.type = preset.type;
    oscillator.frequency.setValueAtTime(preset.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(preset.end, now + preset.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(preset.volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + preset.duration + 0.02);
  } catch {
    // Ignore audio failures in restrictive browsers.
  }
}

function hasError(payload: unknown): payload is { error?: string } {
  return Boolean(payload && typeof payload === "object" && "error" in payload);
}

function getPaymentStatusClass(status: PaymentRecord["status"]) {
  switch (status) {
    case "paid":
      return "border-emerald-300/25 bg-emerald-400/15 text-emerald-50";
    case "pending":
      return "border-sky-200/25 bg-sky-300/15 text-sky-50";
    case "expired":
      return "border-amber-200/25 bg-amber-300/15 text-amber-50";
    default:
      return "border-rose-200/25 bg-rose-300/15 text-rose-50";
  }
}

function getOrderStatusClass(status: Order["status"]) {
  switch (status) {
    case "otp_received":
      return "border-emerald-300/25 bg-emerald-400/15 text-emerald-50";
    case "expired":
      return "border-amber-200/25 bg-amber-300/15 text-amber-50";
    case "cancelled":
      return "border-rose-200/25 bg-rose-300/15 text-rose-50";
    default:
      return "border-sky-200/25 bg-sky-300/15 text-sky-50";
  }
}

async function requestCountries(serverId: ServerId) {
  const response = await fetch(`/api/countries?server=${serverId}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as CountriesResponse | { error?: string };

  if (!response.ok || hasError(payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal memuat daftar negara.",
    );
  }

  return payload.countries;
}

async function requestCatalog(serverId: ServerId, countryId: number) {
  const params = new URLSearchParams({
    server: serverId,
    countryId: String(countryId),
  });
  const response = await fetch(`/api/catalog?${params.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as CatalogResponse | { error?: string };

  if (!response.ok || hasError(payload)) {
    throw new Error(hasError(payload) ? payload.error : "Gagal memuat katalog.");
  }

  return payload;
}

async function requestCreatePayment(service: Service, serverId: ServerId) {
  const response = await fetch("/api/payments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      serviceId: service.id,
      serviceCode: service.serviceCode,
      serverId,
      operator: "any",
      service: service.service,
      country: service.country,
      countryId: service.countryId,
      currency: service.currency,
      price: service.price,
      customerName: "Rahmat OTP",
    }),
  });

  const payload = (await response.json()) as
    | { payment: PaymentRecord }
    | { error?: string };

  if (!response.ok || !("payment" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membuat checkout Midtrans.",
    );
  }

  return payload.payment;
}

async function requestPaymentStatus(paymentId: string, sessionToken?: string) {
  const response = await fetch(`/api/payments/${paymentId}`, {
    cache: "no-store",
    headers: sessionToken
      ? {
          "x-payment-token": sessionToken,
        }
      : undefined,
  });
  const payload = (await response.json()) as
    | { payment: PaymentRecord }
    | { error?: string };

  if (!response.ok || !("payment" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membaca status payment.",
    );
  }

  return payload.payment;
}

async function requestActivatePayment(paymentId: string, sessionToken?: string) {
  const response = await fetch(`/api/payments/${paymentId}/activate`, {
    method: "POST",
    headers: sessionToken
      ? {
          "x-payment-token": sessionToken,
        }
      : undefined,
  });
  const payload = (await response.json()) as
    | { order: Order | null; payment: PaymentRecord }
    | { error?: string };

  if (!response.ok || !("payment" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal mengaktifkan order.",
    );
  }

  return payload;
}

async function requestTransactions() {
  const response = await fetch("/api/transactions", {
    cache: "no-store",
  });
  const payload = (await response.json()) as
    | TransactionsResponse
    | { error?: string };

  if (!response.ok || hasError(payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membaca riwayat transaksi.",
    );
  }

  return payload.transactions;
}

async function requestOrderStatus(orderId: string, contextToken?: string) {
  const response = await fetch(`/api/orders/${orderId}`, {
    cache: "no-store",
    headers: contextToken
      ? {
          "x-order-token": contextToken,
        }
      : undefined,
  });
  const payload = (await response.json()) as
    | { order: Order }
    | { error?: string };

  if (!response.ok || !("order" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membaca status order.",
    );
  }

  return payload.order;
}

async function requestCancelOrder(orderId: string, contextToken?: string) {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "DELETE",
    headers: contextToken
      ? {
          "x-order-token": contextToken,
        }
      : undefined,
  });
  const payload = (await response.json()) as
    | { order: Order }
    | { error?: string };

  if (!response.ok || !("order" in payload)) {
    throw new Error(
      hasError(payload) ? payload.error : "Gagal membatalkan order.",
    );
  }

  return payload.order;
}

function SectionTitle({
  icon,
  title,
}: {
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-white/14 bg-sky-100/12 text-sky-50 shadow-[0_16px_30px_-22px_rgba(116,195,255,0.95)]">
        {icon}
      </div>
      <p className="text-[14px] font-medium text-white">
        {title}
      </p>
    </div>
  );
}

export function CatalogConsole({
  initialCatalog,
  initialCountries,
  initialCountryId,
}: CatalogConsoleProps) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(initialCatalog);
  const [countries, setCountries] = useState<CountryOption[]>(initialCountries);
  const [selectedServer, setSelectedServer] = useState<ServerId>("bimasakti");
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(
    initialCountryId,
  );
  const [selectedServiceId, setSelectedServiceId] = useState(
    initialCatalog?.services[0]?.id ?? "",
  );
  const [showIntro, setShowIntro] = useState(true);
  const [introClosing, setIntroClosing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [countryPanelOpen, setCountryPanelOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePanelOpen, setServicePanelOpen] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [transactionsError, setTransactionsError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [transactions, setTransactions] = useState<PaymentRecord[]>([]);
  const [comparisonService, setComparisonService] = useState<Service | null>(null);
  const [selectedProviderServer, setSelectedProviderServer] =
    useState<ServerId>("bimasakti");
  const [isLoadingCountries, setIsLoadingCountries] = useState(
    initialCountries.length === 0,
  );
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(
    initialCountryId !== null && initialCatalog === null,
  );
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);
  const [isRefreshingOrder, setIsRefreshingOrder] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const deferredCountrySearch = useDeferredValue(countrySearch);
  const deferredServiceSearch = useDeferredValue(serviceSearch);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === selectedCountryId) ?? null,
    [countries, selectedCountryId],
  );
  const selectedService =
    catalog?.services.find((service) => service.id === selectedServiceId) ?? null;
  const providerEntries = useMemo(
    () =>
      serverOptions.map((server) => ({
        meta: server,
        service:
          [selectedService, comparisonService].find(
            (service) =>
              Boolean(service) && toServerId(service?.serverId) === server.id,
          ) ?? null,
      })),
    [comparisonService, selectedService],
  );
  const selectedProviderService =
    providerEntries.find((entry) => entry.meta.id === selectedProviderServer)
      ?.service ??
    providerEntries.find((entry) => entry.service)?.service ??
    null;
  const filteredCountries = countries.filter((country) =>
    `${country.name} ${country.code} ${country.id}`
      .toLowerCase()
      .includes(deferredCountrySearch.toLowerCase()),
  );

  async function loadCountries(serverId: ServerId) {
    setIsLoadingCountries(true);
    setCountryError(null);

    try {
      const nextCountries = await requestCountries(serverId);
      setCountries(nextCountries);
      setSelectedCountryId((current) => {
        if (current && nextCountries.some((country) => country.id === current)) {
          return current;
        }

        if (nextCountries.some((country) => country.id === 6)) {
          return 6;
        }

        return nextCountries[0]?.id ?? null;
      });
    } catch (error) {
      setCountries([]);
      setSelectedCountryId(null);
      setCountryError(
        error instanceof Error ? error.message : "Gagal memuat daftar negara.",
      );
    } finally {
      setIsLoadingCountries(false);
    }
  }

  async function loadCatalog(serverId: ServerId, countryId: number | null) {
    if (!countryId) {
      setCatalog(null);
      setSelectedServiceId("");
      setIsLoadingCatalog(false);
      return;
    }

    setIsLoadingCatalog(true);
    setCatalogError(null);

    try {
      const payload = await requestCatalog(serverId, countryId);
      setCatalog(payload);
      setSelectedServiceId((current) => {
        const nextService = payload.services.find((service) => service.id === current);
        return nextService?.id ?? payload.services[0]?.id ?? "";
      });
    } catch (error) {
      setCatalog(null);
      setSelectedServiceId("");
      setCatalogError(
        error instanceof Error ? error.message : "Gagal memuat katalog.",
      );
    } finally {
      setIsLoadingCatalog(false);
    }
  }

  async function loadTransactions() {
    setIsLoadingTransactions(true);
    setTransactionsError(null);
    const cachedTransactions = readStoredTransactions();

    if (cachedTransactions.length > 0) {
      setTransactions(cachedTransactions);
    }

    try {
      const remoteTransactions = await requestTransactions();
      const mergedTransactions = mergePaymentCollections(
        remoteTransactions,
        cachedTransactions,
      );
      setTransactions(mergedTransactions);
      writeStoredTransactions(mergedTransactions);
    } catch (error) {
      if (cachedTransactions.length === 0) {
        setTransactionsError(
          error instanceof Error
            ? error.message
            : "Gagal membaca riwayat transaksi.",
        );
      }
    } finally {
      setIsLoadingTransactions(false);
    }
  }

  function toggleMenu() {
    playUiFeedback("open");
    setMenuOpen((current) => !current);
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  function scrollToSection(sectionId: string) {
    if (typeof window === "undefined") {
      return;
    }

    document.getElementById(sectionId)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    playUiFeedback("select");
    closeMenu();
  }

  function rememberActivePayment(paymentRecord: PaymentRecord | null) {
    writeStoredActivePayment(paymentRecord);
  }

  function persistTransaction(paymentRecord: PaymentRecord) {
    setTransactions(upsertStoredTransaction(paymentRecord));
  }

  function scrollToPaymentZone() {
    if (typeof window === "undefined") {
      return;
    }

    window.setTimeout(() => {
      document.getElementById("payment-zone")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 80);
  }

  async function syncPayment(paymentId: string, sessionToken?: string | null) {
    setIsRefreshingPayment(true);
    setPaymentError(null);

    try {
      const nextPayment = await requestPaymentStatus(
        paymentId,
        sessionToken ?? payment?.sessionToken,
      );

      if (nextPayment.status === "paid" && !nextPayment.order) {
        const activated = await requestActivatePayment(
          paymentId,
          nextPayment.sessionToken ?? sessionToken ?? undefined,
        );
        setPayment(activated.payment);
        persistTransaction(activated.payment);
        rememberActivePayment(activated.payment);

        if (activated.order) {
          setOrder(activated.order);
        }

        return;
      }

      setPayment(nextPayment);
      persistTransaction(nextPayment);
      rememberActivePayment(nextPayment);

      if (nextPayment.order) {
        setOrder(nextPayment.order);
      }
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "Gagal membaca payment.",
      );
    } finally {
      setIsRefreshingPayment(false);
    }
  }

  async function handleCreateCheckout() {
    if (!selectedProviderService) {
      return;
    }

    setIsCreatingPayment(true);
    setPaymentError(null);
    setOrder(null);
    setOrderError(null);

    try {
      const createdPayment = await requestCreatePayment(
        selectedProviderService,
        toServerId(selectedProviderService.serverId),
      );
      setPayment(createdPayment);
      persistTransaction(createdPayment);
      rememberActivePayment(createdPayment);
      scrollToPaymentZone();
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "Gagal membuat checkout.",
      );
      scrollToPaymentZone();
    } finally {
      setIsCreatingPayment(false);
    }
  }

  async function handleRefreshOrder() {
    if (!order?.id) {
      return;
    }

    setIsRefreshingOrder(true);
    setOrderError(null);

    try {
      const nextOrder = await requestOrderStatus(order.id, order.contextToken);
      setOrder(nextOrder);

      if (payment) {
        const nextPayment = {
          ...payment,
          order: nextOrder,
        } satisfies PaymentRecord;
        setPayment(nextPayment);
        persistTransaction(nextPayment);
        rememberActivePayment(nextPayment);
      }
    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : "Gagal membaca status order.",
      );
    } finally {
      setIsRefreshingOrder(false);
    }
  }

  async function handleCancelOrder() {
    if (!order?.id) {
      return;
    }

    setIsRefreshingOrder(true);
    setOrderError(null);

    try {
      const nextOrder = await requestCancelOrder(order.id, order.contextToken);
      setOrder(nextOrder);

      if (payment) {
        const nextPayment = {
          ...payment,
          order: nextOrder,
        } satisfies PaymentRecord;
        setPayment(nextPayment);
        persistTransaction(nextPayment);
        rememberActivePayment(nextPayment);
      }
    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : "Gagal membatalkan order.",
      );
    } finally {
      setIsRefreshingOrder(false);
    }
  }

  useEffect(() => {
    void loadCountries(selectedServer);
    setCountryPanelOpen(false);
    setCountrySearch("");
    setServicePanelOpen(false);
    setSelectedProviderServer(selectedServer);
  }, [selectedServer]);

  useEffect(() => {
    const introFadeTimer = window.setTimeout(() => {
      setIntroClosing(true);
    }, 1120);
    const introHideTimer = window.setTimeout(() => {
      setShowIntro(false);
    }, 1500);

    return () => {
      window.clearTimeout(introFadeTimer);
      window.clearTimeout(introHideTimer);
    };
  }, []);

  useEffect(() => {
    void loadCatalog(selectedServer, selectedCountryId);
  }, [selectedCountryId, selectedServer]);

  useEffect(() => {
    void loadTransactions();
  }, []);

  useEffect(() => {
    if (!selectedService?.serviceCode || !selectedCountryId) {
      setComparisonService(null);
      return;
    }

    let cancelled = false;
    const otherServer = selectedServer === "bimasakti" ? "mars" : "bimasakti";
    setComparisonService(null);

    void requestCatalog(otherServer, selectedCountryId)
      .then((payload) => {
        if (cancelled) {
          return;
        }

        const match =
          payload.services.find(
            (service) => service.serviceCode === selectedService.serviceCode,
          ) ?? null;
        setComparisonService(match);
      })
      .catch(() => {
        if (!cancelled) {
          setComparisonService(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedCountryId, selectedServer, selectedService]);

  useEffect(() => {
    if (!selectedService) {
      return;
    }

    setSelectedProviderServer(toServerId(selectedService.serverId));
  }, [selectedService]);

  useEffect(() => {
    const activeEntries = providerEntries.filter((entry) => Boolean(entry.service));

    if (!activeEntries.length) {
      return;
    }

    const stillAvailable = activeEntries.some(
      (entry) => entry.meta.id === selectedProviderServer,
    );

    if (!stillAvailable) {
      setSelectedProviderServer(activeEntries[0].meta.id);
    }
  }, [providerEntries, selectedProviderServer]);

  const syncPaymentEvent = useEffectEvent(
    (paymentId: string, sessionToken?: string | null) => {
      void syncPayment(paymentId, sessionToken);
    },
  );
  const refreshOrderEvent = useEffectEvent(() => {
    void handleRefreshOrder();
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentFromQuery = params.get("payment");
    const paymentTokenFromQuery = params.get("paymentToken");
    const paymentFromStorage = readStoredActivePayment();
    const targetPayment = paymentFromQuery || paymentFromStorage?.id;
    const targetPaymentToken =
      paymentFromQuery ? paymentTokenFromQuery : paymentFromStorage?.token;

    if (targetPayment) {
      syncPaymentEvent(targetPayment, targetPaymentToken);
    }
  }, []);

  useEffect(() => {
    if (!order?.id || order.status !== "pending") {
      return;
    }

    const intervalId = window.setInterval(() => {
      refreshOrderEvent();
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [order?.id, order?.status]);

  useEffect(() => {
    if (!payment?.id || payment.status !== "pending") {
      return;
    }

    const intervalId = window.setInterval(() => {
      void syncPaymentEvent(payment.id);
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [payment?.id, payment?.status]);

  const filteredServices =
    catalog?.services.filter((service) =>
      `${service.service} ${service.serviceCode}`
        .toLowerCase()
        .includes(deferredServiceSearch.toLowerCase()),
    ) ?? [];

  return (
    <div className="lux-console-shell min-h-[100dvh] text-white">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="lux-orb lux-orb-a" />
        <div className="lux-orb lux-orb-b" />
        <div className="lux-orb lux-orb-c" />
      </div>

      {showIntro ? (
        <div
          className={cn(
            "lux-intro fixed inset-0 z-[70] flex items-center justify-center bg-[radial-gradient(circle_at_top,#dff8ff_0%,#72c7ff_22%,#1f68ea_58%,#06142c_100%)] px-6 transition-all duration-500",
            introClosing
              ? "pointer-events-none scale-[1.04] opacity-0"
              : "opacity-100",
          )}
        >
          <div className="relative flex w-full max-w-[340px] flex-col items-center rounded-[36px] border border-white/16 bg-[linear-gradient(180deg,rgba(6,20,48,0.82),rgba(10,38,84,0.78))] px-6 py-10 text-center shadow-[0_32px_120px_-36px_rgba(2,8,25,0.98)] backdrop-blur-xl">
            <span className="lux-icon-halo" />
            <span className="lux-icon-ring lux-icon-ring-a" />
            <span className="lux-icon-ring lux-icon-ring-b" />
            <div className="lux-brand-frame relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-[linear-gradient(145deg,#f8feff,#b6ecff_42%,#4b96ff)] text-[#0f2d5f] shadow-[0_24px_70px_-34px_rgba(103,201,255,1)]">
              <span className="lux-brand-spark lux-brand-spark-a" />
              <span className="lux-brand-spark lux-brand-spark-b" />
              <BrandIcon className="lux-brand-mark h-10 w-10" />
            </div>
            <p className="mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-sky-100/62">
              Live OTP Console
            </p>
            <h2 className="mt-3 bg-[linear-gradient(135deg,#ffffff,#ddf5ff_45%,#8ed0ff)] bg-clip-text text-[2rem] font-semibold text-transparent">
              Rahmat OTP
            </h2>
            <p className="mt-3 text-sm leading-7 text-sky-50/72">
              Menyiapkan katalog KirimKode dan QRIS Midtrans langsung di halaman.
            </p>
            <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-sky-100/58">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
              Skyword
              <span className="h-1 w-1 rounded-full bg-white/24" />
              Blueverifiy
            </div>
          </div>
        </div>
      ) : null}

      <main className="relative z-10 mx-auto w-full max-w-[470px] px-3 py-4 pb-28 sm:px-4 sm:py-5">
        <div
          id="console-top"
          className="lux-rise relative rounded-[24px] border border-white/16 bg-[linear-gradient(145deg,rgba(10,27,61,0.9),rgba(18,59,124,0.88)_56%,rgba(7,111,196,0.8))] px-4 py-3 shadow-[0_28px_90px_-42px_rgba(2,8,25,0.95)]"
        >
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[15px] font-medium leading-none text-white">
              Rahmat OTP
            </h1>
            <button
              className="lux-menu-trigger h-9 w-9"
              onClick={toggleMenu}
              type="button"
            >
              <MenuOrbIcon className="h-4 w-4" />
            </button>
          </div>

          {menuOpen ? (
            <div className="absolute right-3 top-12 z-30 w-[220px] rounded-[22px] border border-white/14 bg-[linear-gradient(180deg,rgba(8,24,52,0.98),rgba(13,39,82,0.96))] p-3 shadow-[0_26px_70px_-26px_rgba(2,8,25,0.98)] backdrop-blur-xl">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-sky-100/58">
                Menu
              </p>
              <div className="mt-2 space-y-2">
                <button
                  className="flex w-full items-center gap-3 rounded-[16px] border border-white/10 bg-white/6 px-3 py-3 text-left"
                  onClick={() => scrollToSection("history-zone")}
                  type="button"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-sky-100/12 text-sky-50">
                    <HistoryIcon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[12px] font-medium text-white">
                      Riwayat Transaksi
                    </span>
                    <span className="block text-[10px] text-sky-50/55">
                      Lihat transaksi terbaru
                    </span>
                  </span>
                </button>
                <button
                  className="flex w-full items-center gap-3 rounded-[16px] border border-white/10 bg-white/6 px-3 py-3 text-left"
                  onClick={() => scrollToSection("about-zone")}
                  type="button"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-sky-100/12 text-sky-50">
                    <InfoIcon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[12px] font-medium text-white">
                      Tentang
                    </span>
                    <span className="block text-[10px] text-sky-50/55">
                      Info provider dan QRIS
                    </span>
                  </span>
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {countryError ? (
          <div className="lux-rise mt-4 rounded-[24px] border border-rose-200/20 bg-rose-300/12 px-4 py-4 text-sm leading-7 text-rose-50">
            {countryError}
          </div>
        ) : null}

        {catalogError ? (
          <div className="lux-rise mt-4 rounded-[24px] border border-rose-200/20 bg-rose-300/12 px-4 py-4 text-sm leading-7 text-rose-50">
            {catalogError}
          </div>
        ) : null}

        {catalog?.warning && catalog.total === 0 ? (
          <div className="lux-rise mt-4 rounded-[24px] border border-sky-100/20 bg-sky-100/12 px-4 py-4 text-sm leading-7 text-sky-50">
            {catalog.warning}
          </div>
        ) : null}

        <section
          id="server-zone"
          className="lux-rise lux-panel mt-4 rounded-[24px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,46,93,0.95),rgba(10,34,72,0.96))] p-3.5 sm:p-4"
        >
          <SectionTitle
            icon={<ServerIcon className="h-4 w-4" />}
            title="Select Server"
          />
          <div className="mt-3 grid gap-2.5">
            {serverOptions.map((server) => {
              const active = selectedServer === server.id;

              return (
                <button
                  key={server.id}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[18px] border px-3 py-3 text-left transition-colors",
                    active
                      ? "border-sky-100/85 bg-[linear-gradient(135deg,rgba(196,239,255,0.24),rgba(87,164,255,0.32))]"
                      : "border-white/10 bg-[#13315b]",
                  )}
                  onClick={() => {
                    playUiFeedback("select");
                    setSelectedServer(server.id);
                  }}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <ShellIcon className="h-10 w-10 rounded-[14px] bg-[linear-gradient(145deg,#edfaff,#9de0ff_48%,#4e8dff)] text-white">
                      <span className="block animate-[lux-float_3.6s_ease-in-out_infinite]">
                        {getServerGlyph(server.iconKey)}
                      </span>
                    </ShellIcon>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-medium text-white">
                          {server.name}
                        </p>
                        <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.95)]" />
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-sky-50/62">
                        {server.description}
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "rounded-full border px-2.5 py-1.5 text-[10px] font-semibold",
                      active
                        ? "border-sky-100/65 bg-sky-100/12 text-sky-50"
                        : "border-white/10 text-white/45",
                    )}
                  >
                    {active ? "ON" : "OFF"}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section
          id="country-zone"
          className="lux-rise lux-panel mt-4 rounded-[24px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,46,93,0.95),rgba(10,34,72,0.96))] p-3.5 sm:p-4"
        >
          <SectionTitle
            icon={<GlobeIcon className="h-4 w-4" />}
            title="Select Country"
          />
          <button
            className="mt-3 flex min-h-12 w-full items-center justify-between rounded-[18px] border border-sky-100/20 bg-[#102846] px-3 py-2.5 text-left"
            disabled={isLoadingCountries || countries.length === 0}
            onClick={() => {
              playUiFeedback("open");
              setCountryPanelOpen((current) => !current);
            }}
            type="button"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="text-[18px]">{getSafeCountryGlyph(selectedCountry)}</span>
              <span className="block min-w-0 truncate text-[13px] font-medium text-white">
                {isLoadingCountries
                  ? "Memuat negara..."
                  : selectedCountry?.name ?? "Pilih negara"}
              </span>
            </span>
            <ChevronIcon
              className="h-4 w-4 text-sky-100/80"
              open={countryPanelOpen}
            />
          </button>

          {countryPanelOpen ? (
            <div className="mt-3 rounded-[18px] border border-white/10 bg-[#214571]/92 p-3">
              <input
                className="h-11 w-full rounded-[14px] border border-sky-100/20 bg-[#102846] px-3 text-[13px] text-white outline-none placeholder:text-white/35"
                onChange={(event) => setCountrySearch(event.target.value)}
                placeholder="Cari negara..."
                value={countrySearch}
              />

              <div className="mt-3 max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
                {filteredCountries.map((country) => {
                  const active = selectedCountryId === country.id;

                  return (
                    <button
                      key={`${country.serverId}-${country.id}`}
                      className={cn(
                        "flex w-full items-center rounded-[14px] px-3 py-2.5 text-left transition-colors",
                        active ? "bg-sky-100/12" : "bg-transparent",
                      )}
                      onClick={() => {
                        playUiFeedback("select");
                        setSelectedCountryId(country.id);
                        setCountryPanelOpen(false);
                        setCountrySearch("");
                      }}
                      type="button"
                    >
                      <div className="flex min-w-0 items-center gap-3 pr-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-[#102846] text-[18px]">
                          {getSafeCountryGlyph(country)}
                        </div>
                        <p className="truncate text-[13px] font-medium text-white">
                          {country.name}
                        </p>
                      </div>
                    </button>
                  );
                })}

                {!filteredCountries.length && !isLoadingCountries ? (
                  <div className="rounded-[18px] bg-[#102846] px-4 py-6 text-center text-sm text-white/60">
                    Negara untuk pencarian ini belum ditemukan.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>

        <section
          id="service-zone"
          className="lux-rise lux-panel mt-4 rounded-[24px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,46,93,0.95),rgba(10,34,72,0.96))] p-3.5 sm:p-4"
        >
          <SectionTitle
            icon={<ServiceIcon className="h-4 w-4" />}
            title="Select Service"
          />
          <button
            className="mt-3 flex min-h-12 w-full items-center justify-between rounded-[18px] border border-sky-100/20 bg-[#102846] px-3 py-2.5 text-left"
            onClick={() => {
              playUiFeedback("open");
              setServicePanelOpen((current) => !current);
            }}
            type="button"
          >
            <span className="truncate text-[13px] font-medium text-white">
              {selectedService?.service ?? "Select Service"}
            </span>
            <ChevronIcon
              className="h-4 w-4 text-sky-100/80"
              open={servicePanelOpen}
            />
          </button>

          {servicePanelOpen ? (
            <div className="mt-3 rounded-[18px] border border-sky-100/14 bg-[#214571]/92 p-3 shadow-[0_18px_40px_-26px_rgba(52,124,255,0.7)]">
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sky-100/50" />
                <input
                  className="h-12 w-full rounded-[14px] border border-[#12d7a6]/70 bg-[#102846] pl-10 pr-3 text-[13px] text-white outline-none placeholder:text-white/35"
                  onChange={(event) => setServiceSearch(event.target.value)}
                  placeholder="Search service..."
                  value={serviceSearch}
                />
              </div>

              <div className="mt-3 max-h-[320px] overflow-y-auto rounded-[18px] border border-white/10 bg-[#263d5f]/92 pr-1">
                {filteredServices.map((service) => (
                  <button
                    key={service.id}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 border-b border-white/8 px-3 py-3 text-left transition-colors last:border-b-0",
                      selectedServiceId === service.id
                        ? "bg-[linear-gradient(135deg,rgba(28,84,136,0.92),rgba(16,52,93,0.92))]"
                        : "bg-transparent hover:bg-white/5",
                    )}
                    onClick={() => {
                      playUiFeedback("select");
                      setSelectedServiceId(service.id);
                      setSelectedProviderServer(toServerId(service.serverId));
                      setServicePanelOpen(false);
                      setServiceSearch("");
                    }}
                    type="button"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <ServiceStarIcon className="h-4 w-4 shrink-0 text-sky-100/58" />
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#39ddb0]" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[12.5px] font-medium text-white">
                            {service.service}
                          </p>
                          <span className="shrink-0 text-[10px] uppercase tracking-[0.12em] text-sky-100/42">
                            {service.serviceCode}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-right">
                      <p className="text-[10px] text-sky-100/55">{service.stock}</p>
                      <p className="text-[12.5px] font-medium text-[#16f0a9]">
                        {formatCurrency(service.price, service.currency)}
                      </p>
                    </div>
                  </button>
                ))}

                {!filteredServices.length && !isLoadingCatalog ? (
                  <div className="px-4 py-8 text-center text-sm text-white/60">
                    Layanan real dari KirimKode belum masuk untuk pencarian ini.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {selectedService && selectedCountry ? (
            <div className="mt-3 rounded-[18px] bg-[#102846] p-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] text-sky-50/55">Service</p>
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-sky-50/50">
                    Pilih provider:
                  </p>
                </div>
                <p className="text-[14px] font-medium text-white">
                  {selectedService.service}
                </p>
              </div>

              <div className="mt-3 space-y-2.5">
                {providerEntries.map(({ meta, service }) => {
                  const active = selectedProviderService?.id === service?.id;

                  return (
                    <button
                      key={meta.id}
                      className={cn(
                        "flex w-full items-center justify-between gap-4 rounded-[16px] border px-3 py-3 text-left transition-colors",
                        active
                          ? "border-sky-100/24 bg-[linear-gradient(135deg,rgba(29,82,132,0.96),rgba(13,39,82,0.94))]"
                          : "border-white/10 bg-[#0d2240]",
                        !service && "opacity-60",
                      )}
                      disabled={!service}
                      onClick={() => {
                        if (!service) {
                          return;
                        }

                        playUiFeedback("select");
                        setSelectedProviderServer(meta.id);
                      }}
                      type="button"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-sky-100/10 text-sky-50">
                          {getServerGlyph(meta.iconKey)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-white">
                            {selectedService.service}
                          </p>
                          <p className="mt-0.5 text-[10px] text-sky-50/55">
                            {meta.name}
                          </p>
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[13px] font-medium text-[#16f0a9]">
                          {service
                            ? formatCurrency(service.price, service.currency)
                            : "-"}
                        </p>
                        <p className="mt-1 text-[11px] text-sky-50/55">
                          {service ? `stok: ${service.stock}` : "tidak tersedia"}
                        </p>
                      </div>
                    </button>
                  );
                })}

                <div className="px-1 text-[10px] uppercase tracking-[0.12em] text-sky-50/40">
                  {getSafeCountryGlyph(selectedCountry)} {selectedCountry.name} {selectedService.serviceCode}
                </div>
              </div>
            </div>
          ) : null}

          <button
            className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#e2f7ff,#93dcff_34%,#5cadff_67%,#3d7eff)] px-5 text-[13px] font-medium text-[#0b2248] shadow-[0_18px_35px_-22px_rgba(64,129,255,0.95)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedProviderService || isCreatingPayment}
            onClick={() => {
              playUiFeedback("confirm");
              void handleCreateCheckout();
            }}
            type="button"
          >
            {isCreatingPayment ? "Membuat Checkout..." : "Beli Nomor"}
          </button>
        </section>

        {paymentError ? (
          <div className="mt-4 rounded-[24px] border border-rose-200/20 bg-rose-300/12 px-4 py-4 text-sm leading-7 text-rose-50">
            {paymentError}
          </div>
        ) : null}

        {!payment ? <div id="payment-zone" className="h-0" /> : null}

        {payment ? (
          <section
            id="payment-zone"
            className="lux-rise lux-panel lux-premium-card mt-4 rounded-[24px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,46,93,0.95),rgba(10,34,72,0.96))] p-3.5 sm:p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] text-sky-50/55">QRIS Pembayaran</p>
                <p className="mt-1 text-[14px] font-medium text-white">
                  {payment.service}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                  getPaymentStatusClass(payment.status),
                )}
              >
                {payment.status}
              </span>
            </div>

            <p className="mt-3 break-all text-[12px] leading-6 text-sky-50/62">
              {payment.statusMessage ?? payment.id}
            </p>

            <div className="mt-4 grid gap-4">
              <div className="lux-premium-surface p-4">
                <div className="mx-auto flex w-full max-w-[240px] flex-col items-center rounded-[24px] border border-white/10 bg-white px-4 py-4 shadow-[0_20px_48px_-28px_rgba(4,10,24,0.95)]">
                  {payment.qrCodeUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      alt={`QRIS ${payment.service}`}
                      className="h-auto w-full rounded-[16px]"
                      src={payment.qrCodeUrl}
                    />
                  ) : (
                    <div className="flex h-[220px] w-full items-center justify-center rounded-[16px] bg-slate-100 px-4 text-center text-[12px] text-slate-500">
                      QRIS belum tersedia. Coba buat ulang pembayaran.
                    </div>
                  )}
                </div>
                <p className="mt-3 text-center text-[12px] text-sky-50/68">
                  Scan QRIS ini dengan e-wallet atau mobile banking. Nominal
                  harus sama persis.
                </p>
                {payment.expiresAt ? (
                  <p className="mt-1 text-center text-[11px] text-sky-50/48">
                    Berlaku sampai {formatDateTime(payment.expiresAt)}
                  </p>
                ) : null}
              </div>

              <div className="lux-premium-surface p-4">
                <p className="text-[11px] uppercase tracking-[0.18em] text-sky-50/48">
                  Detail Pesanan
                </p>
                <div className="mt-3 space-y-2.5 text-[12px] text-sky-50/72">
                  <div className="flex items-center justify-between gap-4">
                    <span>Layanan</span>
                    <span className="text-right text-white">{payment.service}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Provider</span>
                    <span className="text-right text-white">
                      {getServerLabel(payment.serverId)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Negara</span>
                    <span className="text-right text-white">{payment.country}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Harga nomor</span>
                    <span className="text-right text-white">
                      {formatCurrency(payment.subtotalAmount, payment.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span>Fee Midtrans</span>
                    <span className="text-right text-white">
                      {formatCurrency(payment.feeAmount, payment.currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4 border-t border-white/8 pt-2.5 text-[13px] font-medium">
                    <span>Total bayar</span>
                    <span className="text-right text-[#16f0a9]">
                      {formatCurrency(payment.amount, payment.currency)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/10 bg-[#102846] px-4 text-[12px] font-medium text-white disabled:opacity-60"
                disabled={isRefreshingPayment}
                onClick={() => {
                  playUiFeedback("select");
                  void syncPayment(payment.id, payment.sessionToken);
                }}
                type="button"
              >
                {isRefreshingPayment ? "Mengecek Pembayaran..." : "Cek Pembayaran"}
              </button>
            </div>
          </section>
        ) : null}

        <section
          id="otp-zone"
          className="lux-rise lux-panel lux-premium-card mt-4 rounded-[24px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,46,93,0.95),rgba(10,34,72,0.96))] p-3.5 sm:p-4"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] text-sky-50/55">OTP Result</p>
              <p className="mt-1 text-[14px] font-medium text-white">
                OTP tampil setelah payment sukses
              </p>
            </div>
            {order ? (
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                  getOrderStatusClass(order.status),
                )}
              >
                {order.status}
              </span>
            ) : null}
          </div>

          {orderError ? (
            <div className="mt-4 rounded-[22px] border border-rose-200/20 bg-rose-300/12 px-4 py-4 text-sm leading-7 text-rose-50">
              {orderError}
            </div>
          ) : null}

          {order ? (
            <div className="mt-4">
              <div className="lux-premium-surface p-3">
                <p className="text-[11px] text-sky-50/55">Nomor</p>
                <p className="mt-1 break-all text-[16px] font-medium text-white">
                  {order.phoneNumber}
                </p>

                <p className="mt-4 text-[11px] text-sky-50/55">OTP Code</p>
                <p className="mt-2 break-all text-[24px] font-semibold tracking-[0.08em] text-sky-100 sm:text-[26px]">
                  {order.otpCode ?? "MENUNGGU SMS MASUK"}
                </p>

                <div className="mt-4 grid gap-2 text-[11px] text-sky-50/60">
                  <p>Dibuat: {formatDateTime(order.createdAt)}</p>
                  <p>Kedaluwarsa: {formatDateTime(order.expiresAt)}</p>
                  <p>Harga: {formatCurrency(order.price, order.currency)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-white/10 bg-[#102846] px-4 text-[12px] font-medium text-white disabled:opacity-60"
                  disabled={isRefreshingOrder}
                  onClick={() => {
                    playUiFeedback("select");
                    startTransition(() => {
                      void handleRefreshOrder();
                    });
                  }}
                  type="button"
                >
                  {isRefreshingOrder ? "Refresh..." : "Refresh OTP"}
                </button>
                <button
                  className="inline-flex h-11 w-full items-center justify-center rounded-full border border-rose-200/18 bg-rose-300/12 px-4 text-[12px] font-medium text-rose-50 disabled:opacity-60"
                  disabled={isRefreshingOrder || order.status !== "pending"}
                  onClick={() => {
                    playUiFeedback("select");
                    void handleCancelOrder();
                  }}
                  type="button"
                >
                  Cancel Order
                </button>
              </div>
            </div>
          ) : (
            <div className="lux-premium-surface mt-4 px-4 py-6 text-center text-[12px] leading-6 text-sky-50/58">
              Setelah checkout Midtrans berhasil, website akan membuat order ke
              KirimKode lalu menampilkan nomor dan OTP di sini.
            </div>
          )}
        </section>
        <section
          id="history-zone"
          className="lux-rise lux-panel mt-4 rounded-[24px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,46,93,0.95),rgba(10,34,72,0.96))] p-3.5 sm:p-4"
        >
          <SectionTitle
            icon={<HistoryIcon className="h-4 w-4" />}
            title="Riwayat Transaksi"
          />

          {transactionsError ? (
            <div className="mt-4 rounded-[18px] border border-rose-200/20 bg-rose-300/12 px-4 py-4 text-sm leading-7 text-rose-50">
              {transactionsError}
            </div>
          ) : null}

          <div className="mt-3 space-y-2.5">
            {transactions.map((transaction) => (
              <div
                key={transaction.id}
                className="rounded-[18px] border border-white/10 bg-[#102846] p-3"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-white">
                      {transaction.service}
                    </p>
                    <p className="mt-1 text-[11px] text-sky-50/55">
                      {getServerLabel(transaction.serverId)} • {transaction.country}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]",
                      getPaymentStatusClass(transaction.status),
                    )}
                  >
                    {transaction.status}
                  </span>
                </div>

                <div className="mt-3 grid gap-1 text-[11px] text-sky-50/60">
                  <p>Harga nomor: {formatCurrency(transaction.subtotalAmount, transaction.currency)}</p>
                  <p>Fee Midtrans: {formatCurrency(transaction.feeAmount, transaction.currency)}</p>
                  <p className="text-[12px] font-medium text-[#16f0a9]">
                    Total: {formatCurrency(transaction.amount, transaction.currency)}
                  </p>
                  <p>Dibuat: {formatDateTime(transaction.createdAt)}</p>
                  {transaction.order?.phoneNumber ? (
                    <p>Nomor: {transaction.order.phoneNumber}</p>
                  ) : null}
                  {transaction.order?.otpCode ? (
                    <p>OTP: {transaction.order.otpCode}</p>
                  ) : null}
                </div>
              </div>
            ))}

            {!transactions.length && !isLoadingTransactions ? (
              <div className="rounded-[18px] bg-[#102846] px-4 py-6 text-center text-[12px] leading-6 text-sky-50/58">
                Belum ada transaksi tersimpan. Saat QRIS dibuat, riwayat akan tampil di sini.
              </div>
            ) : null}
          </div>
        </section>

        <section
          id="about-zone"
          className="lux-rise lux-panel mt-4 rounded-[24px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,46,93,0.95),rgba(10,34,72,0.96))] p-3.5 sm:p-4"
        >
          <SectionTitle
            icon={<InfoIcon className="h-4 w-4" />}
            title="Tentang"
          />
          <div className="lux-premium-surface mt-3 p-4 text-[12px] leading-7 text-sky-50/68">
            <p>
              Rahmat OTP mengambil katalog dan order OTP langsung dari KirimKode.
              Pembayaran QRIS dibuat lewat Midtrans Core API agar QR tampil langsung
              di halaman ini tanpa buka tab baru.
            </p>
            <div className="mt-3 grid gap-2 text-[11px] text-sky-50/62">
              <p>Provider 1: Skyword → api1</p>
              <p>Provider 2: Blueverifiy → api2</p>
              <p>Harga: mengikuti harga asli KirimKode</p>
              <p>Riwayat transaksi: saat ini tersimpan di store aplikasi dan siap dipindah ke Vercel DB.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

