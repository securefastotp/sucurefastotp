"use client";

import Script from "next/script";
import {
  type ReactNode,
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type {
  CatalogResponse,
  CountryOption,
  Order,
  PaymentRecord,
  RuntimeStatus,
  Service,
} from "@/lib/types";

type CatalogConsoleProps = {
  initialCatalog: CatalogResponse | null;
  initialCountries: CountryOption[];
  initialCountryId: number | null;
  initialRuntime: RuntimeStatus;
};

type ServerId = "bimasakti" | "mars";

type CountriesResponse = {
  updatedAt: string;
  total: number;
  countries: CountryOption[];
};

declare global {
  interface Window {
    snap?: {
      pay: (
        token: string,
        options?: {
          onClose?: () => void;
          onError?: () => void;
          onPending?: () => void;
          onSuccess?: () => void;
        },
      ) => void;
    };
  }
}

const serverOptions = [
  {
    id: "bimasakti" as const,
    name: "Skyguard",
    code: "api1",
    iconKey: "skyguard" as const,
    description: "Jalur utama yang paling agresif dan stabil",
  },
  {
    id: "mars" as const,
    name: "Blueverifiy",
    code: "api2",
    iconKey: "blueverifiy" as const,
    description: "Jalur cadangan premium untuk verifikasi cepat",
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
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 2.8l6.8 2.7v6.1c0 4.7-2.8 8.9-6.8 10.9-4-2-6.8-6.2-6.8-10.9V5.5L12 2.8z"
        fill="currentColor"
        fillOpacity=".18"
      />
      <path
        d="M12 5.1l4.6 1.8v4.4c0 3.5-1.9 6.7-4.6 8.5-2.7-1.8-4.6-5-4.6-8.5V6.9L12 5.1z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M10 14.6V8.4h2.6c1.7 0 2.7 1 2.7 2.5 0 1.4-1 2.4-2.7 2.4h-1.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M11.4 12.3l3.3 3.2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
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

function SkyguardIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 2.7l6.5 2.5v5.6c0 4.4-2.7 8.5-6.5 10.6-3.8-2.1-6.5-6.2-6.5-10.6V5.2L12 2.7z"
        fill="currentColor"
        fillOpacity=".18"
      />
      <path
        d="M12 4.8l4.2 1.6v4.1c0 3.2-1.8 6.1-4.2 7.8-2.4-1.7-4.2-4.6-4.2-7.8V6.4L12 4.8z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M12 7.8l1.3 2.5 2.8.4-2 1.9.5 2.8-2.6-1.4-2.6 1.4.5-2.8-2-1.9 2.8-.4L12 7.8z"
        fill="currentColor"
      />
    </svg>
  );
}

function BlueverifiyIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" fill="currentColor" fillOpacity=".18" r="7.2" />
      <circle cx="12" cy="12" r="5.8" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M9.2 12.2l1.9 1.9 3.8-4.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.9"
      />
      <path d="M17.5 6.4l1.8-1.7" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
      <path d="M18.8 6.3v1.9" stroke="currentColor" strokeLinecap="round" strokeWidth="1.4" />
    </svg>
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

function OtpBurstIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12 3.8l1.5 4.1 4.4 1.5-4.4 1.5L12 15l-1.5-4.1-4.4-1.5 4.4-1.5L12 3.8z"
        fill="currentColor"
      />
      <path
        d="M17.4 15.8l.7 1.9 1.9.6-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.6.7-1.9z"
        fill="currentColor"
        fillOpacity=".85"
      />
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
  if (iconKey === "blueverifiy") {
    return <BlueverifiyIcon className="h-8 w-8" />;
  }

  return <SkyguardIcon className="h-8 w-8" />;
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

function getCountryCaption(country?: CountryOption | null) {
  if (!country) {
    return "";
  }

  if (hasCountryCode(country)) {
    return `${country.code.toUpperCase()} - ${country.availableServices} layanan`;
  }

  return `KirimKode ID ${country.id} - ${country.availableServices} layanan`;
}

function getCountryListCaption(country: CountryOption) {
  if (hasCountryCode(country)) {
    return `KirimKode ID ${country.id} - ${country.code.toUpperCase()}`;
  }

  return `KirimKode ID ${country.id}`;
}

function getServiceBadge(serviceName: string) {
  const compact = serviceName
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return compact || serviceName.slice(0, 2).toUpperCase() || "OT";
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
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

async function requestPaymentStatus(paymentId: string) {
  const response = await fetch(`/api/payments/${paymentId}`, {
    cache: "no-store",
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

async function requestActivatePayment(paymentId: string) {
  const response = await fetch(`/api/payments/${paymentId}/activate`, {
    method: "POST",
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

async function requestOrderStatus(orderId: string) {
  const response = await fetch(`/api/orders/${orderId}`, {
    cache: "no-store",
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

async function requestCancelOrder(orderId: string) {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "DELETE",
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
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/14 bg-sky-100/12 text-sky-50 shadow-[0_16px_30px_-22px_rgba(116,195,255,0.95)]">
        {icon}
      </div>
      <p className="text-[1.12rem] font-semibold text-white sm:text-[1.2rem]">
        {title}
      </p>
    </div>
  );
}

export function CatalogConsole({
  initialCatalog,
  initialCountries,
  initialCountryId,
  initialRuntime,
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
  const [quickMenuOpen, setQuickMenuOpen] = useState(false);
  const [countryPanelOpen, setCountryPanelOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePanelOpen, setServicePanelOpen] = useState(false);
  const [swipeStartY, setSwipeStartY] = useState<number | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoadingCountries, setIsLoadingCountries] = useState(
    initialCountries.length === 0,
  );
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(
    initialCountryId !== null && initialCatalog === null,
  );
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);
  const [isRefreshingOrder, setIsRefreshingOrder] = useState(false);
  const [isSnapReady, setIsSnapReady] = useState(false);
  const deferredCountrySearch = useDeferredValue(countrySearch);
  const deferredServiceSearch = useDeferredValue(serviceSearch);

  const midtransClientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "";
  const snapScriptUrl =
    initialRuntime.midtransEnvironment === "production"
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
  const isPaymentReady =
    initialRuntime.midtransConfigured &&
    initialRuntime.midtransClientKeyAvailable &&
    Boolean(midtransClientKey);

  const selectedCountry = useMemo(
    () => countries.find((country) => country.id === selectedCountryId) ?? null,
    [countries, selectedCountryId],
  );
  const selectedService =
    catalog?.services.find((service) => service.id === selectedServiceId) ?? null;
  const selectedServerMeta = serverOptions.find(
    (server) => server.id === selectedServer,
  );
  const filteredCountries = countries.filter((country) =>
    `${country.name} ${country.code} ${country.id}`
      .toLowerCase()
      .includes(deferredCountrySearch.toLowerCase()),
  );
  const quickMenuItems = [
    {
      id: "console-top",
      label: "Overview",
      caption: "Rahmat OTP",
      icon: <OtpBurstIcon className="h-4 w-4" />,
    },
    {
      id: "server-zone",
      label: "Server",
      caption: selectedServerMeta?.name ?? "Skyguard",
      icon: <ServerIcon className="h-4 w-4" />,
    },
    {
      id: "country-zone",
      label: "Country",
      caption: selectedCountry?.name ?? "Pilih negara",
      icon: <GlobeIcon className="h-4 w-4" />,
    },
    {
      id: "service-zone",
      label: "Service",
      caption: selectedService?.service ?? "Pilih layanan",
      icon: <ServiceIcon className="h-4 w-4" />,
    },
    {
      id: "payment-zone",
      label: "Payment",
      caption: payment?.status ?? "Siap checkout",
      icon: <MenuOrbIcon className="h-4 w-4" />,
    },
    {
      id: "otp-zone",
      label: "OTP",
      caption: order?.otpCode ?? "Menunggu hasil",
      icon: <OtpBurstIcon className="h-4 w-4" />,
    },
  ] as const;

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

  function openQuickMenuSheet(withFeedback = true) {
    if (withFeedback) {
      playUiFeedback("open");
    }

    setQuickMenuOpen(true);
  }

  function closeQuickMenuSheet() {
    setQuickMenuOpen(false);
  }

  function toggleQuickMenuSheet() {
    if (quickMenuOpen) {
      closeQuickMenuSheet();
      return;
    }

    openQuickMenuSheet();
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
    closeQuickMenuSheet();
  }

  function handleSwipeStart(clientY: number) {
    setSwipeStartY(clientY);
  }

  function handleSwipeEnd(clientY: number) {
    if (swipeStartY === null) {
      return;
    }

    const delta = swipeStartY - clientY;

    if (delta > 48) {
      openQuickMenuSheet();
    }

    if (delta < -48) {
      closeQuickMenuSheet();
    }

    setSwipeStartY(null);
  }

  function rememberPaymentId(paymentId: string | null) {
    if (typeof window === "undefined") {
      return;
    }

    if (!paymentId) {
      window.localStorage.removeItem("otp-payment-id");
      return;
    }

    window.localStorage.setItem("otp-payment-id", paymentId);
  }

  async function syncPayment(paymentId: string) {
    setIsRefreshingPayment(true);
    setPaymentError(null);

    try {
      const nextPayment = await requestPaymentStatus(paymentId);

      if (nextPayment.status === "paid" && !nextPayment.order) {
        const activated = await requestActivatePayment(paymentId);
        setPayment(activated.payment);

        if (activated.order) {
          setOrder(activated.order);
          rememberPaymentId(null);
        } else {
          rememberPaymentId(activated.payment.id);
        }

        return;
      }

      setPayment(nextPayment);

      if (nextPayment.order) {
        setOrder(nextPayment.order);
        rememberPaymentId(null);
      } else {
        rememberPaymentId(nextPayment.id);
      }
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "Gagal membaca payment.",
      );
    } finally {
      setIsRefreshingPayment(false);
    }
  }

  function openSnap(currentPayment: PaymentRecord) {
    if (!currentPayment.snapToken) {
      setPaymentError("Snap token Midtrans belum tersedia.");
      return;
    }

    if (!window.snap) {
      setPaymentError("Snap Midtrans belum siap dimuat.");
      return;
    }

    window.snap.pay(currentPayment.snapToken, {
      onClose: () => void syncPayment(currentPayment.id),
      onError: () => void syncPayment(currentPayment.id),
      onPending: () => void syncPayment(currentPayment.id),
      onSuccess: () => void syncPayment(currentPayment.id),
    });
  }

  async function handleCreateCheckout() {
    if (!selectedService) {
      return;
    }

    setIsCreatingPayment(true);
    setPaymentError(null);

    try {
      const createdPayment = await requestCreatePayment(
        selectedService,
        selectedServer,
      );
      setPayment(createdPayment);
      rememberPaymentId(createdPayment.id);
      openSnap(createdPayment);
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "Gagal membuat checkout.",
      );
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
      setOrder(await requestOrderStatus(order.id));
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
      setOrder(await requestCancelOrder(order.id));
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
  }, [selectedServer]);

  useEffect(() => {
    const introFadeTimer = window.setTimeout(() => {
      setIntroClosing(true);
    }, 1120);
    const introHideTimer = window.setTimeout(() => {
      setShowIntro(false);
    }, 1500);
    const menuTimer = window.setTimeout(() => {
      setQuickMenuOpen(true);
    }, 1750);

    return () => {
      window.clearTimeout(introFadeTimer);
      window.clearTimeout(introHideTimer);
      window.clearTimeout(menuTimer);
    };
  }, []);

  useEffect(() => {
    void loadCatalog(selectedServer, selectedCountryId);
  }, [selectedCountryId, selectedServer]);

  const syncPaymentEvent = useEffectEvent((paymentId: string) => {
    void syncPayment(paymentId);
  });
  const refreshOrderEvent = useEffectEvent(() => {
    void handleRefreshOrder();
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentFromQuery = params.get("payment");
    const paymentFromStorage = window.localStorage.getItem("otp-payment-id");
    const targetPayment = paymentFromQuery || paymentFromStorage;

    if (targetPayment) {
      syncPaymentEvent(targetPayment);
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
      {isPaymentReady ? (
        <Script
          data-client-key={midtransClientKey}
          onReady={() => setIsSnapReady(true)}
          src={snapScriptUrl}
          strategy="afterInteractive"
        />
      ) : null}

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
            <div className="relative flex h-20 w-20 items-center justify-center rounded-[28px] bg-[linear-gradient(145deg,#f8feff,#b6ecff_42%,#4b96ff)] text-[#0f2d5f] shadow-[0_24px_70px_-34px_rgba(103,201,255,1)]">
              <BrandIcon className="h-10 w-10 animate-[lux-float_2.9s_ease-in-out_infinite]" />
            </div>
            <p className="mt-6 text-[0.7rem] font-semibold uppercase tracking-[0.32em] text-sky-100/62">
              Luxury Access
            </p>
            <h2 className="mt-3 bg-[linear-gradient(135deg,#ffffff,#ddf5ff_45%,#8ed0ff)] bg-clip-text text-[2rem] font-semibold text-transparent">
              Rahmat OTP
            </h2>
            <p className="mt-3 text-sm leading-7 text-sky-50/72">
              Menyiapkan lane premium, popup menu, dan jalur order real-time.
            </p>
            <div className="mt-6 flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-sky-100/58">
              <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.9)]" />
              Skyguard
              <span className="h-1 w-1 rounded-full bg-white/24" />
              Blueverifiy
            </div>
          </div>
        </div>
      ) : null}

      <main className="relative z-10 mx-auto w-full max-w-[470px] px-3 py-4 pb-28 sm:px-4 sm:py-5">
        <div
          id="console-top"
          className="lux-rise rounded-[34px] border border-white/16 bg-[linear-gradient(145deg,rgba(10,27,61,0.9),rgba(18,59,124,0.88)_56%,rgba(7,111,196,0.8))] px-4 py-5 shadow-[0_28px_90px_-42px_rgba(2,8,25,0.95)] sm:px-5"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-4">
              <div className="relative">
                <span className="lux-icon-halo" />
                <span className="lux-icon-ring lux-icon-ring-a" />
                <span className="lux-icon-ring lux-icon-ring-b" />
                <ShellIcon className="relative h-15 w-15 rounded-[24px] bg-[linear-gradient(145deg,#f3fdff,#a8e8ff_44%,#4b93ff)] text-[#113663] shadow-[0_20px_40px_-26px_rgba(76,171,255,0.95)]">
                  <BrandIcon className="h-8 w-8 animate-[lux-float_3.4s_ease-in-out_infinite]" />
                </ShellIcon>
              </div>
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/14 bg-white/7 px-3 py-1 text-[0.62rem] font-semibold uppercase tracking-[0.28em] text-sky-100/80">
                  <span className="h-2 w-2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,0.9)]" />
                  Premium Mobile Console
                </div>
                <h1 className="mt-3 bg-[linear-gradient(135deg,#ffffff,#dff6ff_38%,#9fd6ff_72%,#73a7ff)] bg-clip-text text-[2rem] font-semibold leading-none text-transparent sm:text-[2.25rem]">
                  Rahmat OTP
                </h1>
                <p className="mt-2 max-w-[240px] text-sm leading-7 text-sky-50/80 sm:text-base">
                  Flow beli nomor sekarang tampil lebih premium, tetap langsung ke Midtrans dan KirimKode.
                </p>
              </div>
            </div>

            <button
              className="lux-menu-trigger"
              onClick={() => openQuickMenuSheet()}
              type="button"
            >
              <MenuOrbIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-sky-100/56">
                Active Lane
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[linear-gradient(145deg,rgba(255,255,255,0.22),rgba(106,196,255,0.22))] text-sky-50">
                  {getServerGlyph(selectedServerMeta?.iconKey ?? "skyguard")}
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">
                    {selectedServerMeta?.name ?? "Skyguard"}
                  </p>
                  <p className="text-xs text-sky-100/58">
                    {selectedServerMeta?.code ?? "api1"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/8 px-4 py-3 backdrop-blur">
              <p className="text-[0.66rem] font-semibold uppercase tracking-[0.22em] text-sky-100/56">
                Payment Core
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[linear-gradient(145deg,rgba(255,255,255,0.22),rgba(106,196,255,0.22))] text-sky-50">
                  <OtpBurstIcon className="h-5 w-5 animate-[lux-pulse_2.8s_ease-in-out_infinite]" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-white">Midtrans Live</p>
                  <p className="text-xs text-sky-100/58">
                    {isSnapReady ? "Snap siap dibuka" : "Memuat snap..."}
                  </p>
                </div>
              </div>
            </div>
          </div>
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
          className="lux-rise lux-panel mt-4 rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,46,93,0.95),rgba(10,34,72,0.96))] p-4 sm:p-5"
        >
          <SectionTitle
            icon={<ServerIcon className="h-5 w-5" />}
            title="Select Server"
          />
          <div className="mt-4 grid gap-3">
            {serverOptions.map((server) => {
              const active = selectedServer === server.id;

              return (
                <button
                  key={server.id}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[24px] border px-4 py-4 text-left transition-colors",
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
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <span className="lux-icon-halo lux-icon-halo-soft" />
                      <span className="lux-icon-ring lux-icon-ring-a" />
                      <ShellIcon className="relative h-14 w-14 rounded-[20px] bg-[linear-gradient(145deg,#edfaff,#9de0ff_48%,#4e8dff)] text-white">
                        <span className="block animate-[lux-float_3.6s_ease-in-out_infinite]">
                          {getServerGlyph(server.iconKey)}
                        </span>
                      </ShellIcon>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[1.08rem] font-semibold text-white">
                          {server.name}
                        </p>
                        <span className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_16px_rgba(103,232,249,0.95)]" />
                      </div>
                      <p className="mt-1 text-sm leading-6 text-sky-50/62">
                        {server.description} ({server.code})
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "rounded-full border px-3 py-2 text-xs font-bold",
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
          className="lux-rise lux-panel mt-4 rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,46,93,0.95),rgba(10,34,72,0.96))] p-4 sm:p-5"
        >
          <SectionTitle
            icon={<GlobeIcon className="h-5 w-5" />}
            title="Select Country"
          />
          <button
            className="mt-4 flex min-h-14 w-full items-center justify-between rounded-[22px] border border-sky-100/20 bg-[#102846] px-4 py-3 text-left"
            disabled={isLoadingCountries || countries.length === 0}
            onClick={() => {
              playUiFeedback("open");
              setCountryPanelOpen((current) => !current);
            }}
            type="button"
          >
            <span className="flex min-w-0 items-center gap-3">
              <span className="text-2xl">{getSafeCountryGlyph(selectedCountry)}</span>
              <span className="min-w-0">
                <span className="block truncate text-base font-medium text-white">
                  {isLoadingCountries
                    ? "Memuat negara..."
                    : selectedCountry?.name ?? "Pilih negara"}
                </span>
                {selectedCountry ? (
                  <span className="mt-1 block text-xs uppercase tracking-[0.16em] text-sky-50/55">
                    {getCountryCaption(selectedCountry)}
                  </span>
                ) : null}
              </span>
            </span>
            <ChevronIcon
              className="h-5 w-5 text-sky-100/80"
              open={countryPanelOpen}
            />
          </button>

          {countryPanelOpen ? (
            <div className="mt-4 rounded-[24px] border border-white/10 bg-[#214571]/92 p-4">
              <input
                className="h-13 w-full rounded-[18px] border border-sky-100/20 bg-[#102846] px-4 text-base text-white outline-none placeholder:text-white/35"
                onChange={(event) => setCountrySearch(event.target.value)}
                placeholder="Cari negara atau kode..."
                value={countrySearch}
              />

              <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {filteredCountries.map((country) => {
                  const active = selectedCountryId === country.id;

                  return (
                    <button
                      key={`${country.serverId}-${country.id}`}
                      className={cn(
                        "flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left transition-colors",
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
                        <div className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[#102846] text-[1.4rem]">
                          {getSafeCountryGlyph(country)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[1rem] font-medium text-white">
                            {country.name}
                          </p>
                          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-sky-50/50">
                            {getCountryListCaption(country)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-sky-100">
                          {country.availableServices}
                        </p>
                        <p className="text-xs text-sky-50/50">layanan</p>
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

          {selectedCountry ? (
            <div className="mt-4 rounded-[22px] border border-white/10 bg-[#102846] px-4 py-4 text-sm leading-7 text-sky-50/76">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{getSafeCountryGlyph(selectedCountry)}</div>
                <div>
                  <p className="font-semibold text-white">{selectedCountry.name}</p>
                  <p className="text-sky-50/58">
                    {getCountryCaption(selectedCountry)}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section
          id="service-zone"
          className="lux-rise lux-panel mt-4 rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,46,93,0.95),rgba(10,34,72,0.96))] p-4 sm:p-5"
        >
          <SectionTitle
            icon={<ServiceIcon className="h-5 w-5" />}
            title="Select Service"
          />
          <button
            className="mt-4 flex min-h-14 w-full items-center justify-between rounded-[22px] border border-sky-100/20 bg-[#102846] px-4 py-3 text-left"
            onClick={() => {
              playUiFeedback("open");
              setServicePanelOpen((current) => !current);
            }}
            type="button"
          >
            <span className="truncate text-base font-medium text-white">
              {selectedService?.service ?? "Select Service"}
            </span>
            <ChevronIcon
              className="h-5 w-5 text-sky-100/80"
              open={servicePanelOpen}
            />
          </button>

          {servicePanelOpen ? (
            <div className="fixed inset-0 z-[45]">
              <button
                className="absolute inset-0 bg-[#020614]/56 backdrop-blur-sm"
                onClick={() => {
                  setServicePanelOpen(false);
                  setServiceSearch("");
                }}
                type="button"
              />
              <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-[470px] px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
                <div className="rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(8,24,54,0.98),rgba(12,39,83,0.96))] p-4 shadow-[0_32px_90px_-30px_rgba(2,8,25,0.98)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-sky-100/58">
                        Premium Service Sheet
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        Pilih layanan OTP
                      </p>
                      <p className="mt-1 text-sm leading-6 text-sky-50/62">
                        {selectedServerMeta?.name} • {selectedCountry?.name ?? "Pilih negara"} • {catalog?.total ?? 0} layanan
                      </p>
                    </div>
                    <button
                      className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-50"
                      onClick={() => {
                        setServicePanelOpen(false);
                        setServiceSearch("");
                      }}
                      type="button"
                    >
                      Tutup
                    </button>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3">
                    <div className="rounded-[18px] border border-white/10 bg-white/7 px-3 py-3">
                      <p className="text-[0.62rem] uppercase tracking-[0.2em] text-sky-100/52">
                        Active
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {selectedServerMeta?.name}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-white/7 px-3 py-3">
                      <p className="text-[0.62rem] uppercase tracking-[0.2em] text-sky-100/52">
                        Country
                      </p>
                      <p className="mt-2 truncate text-sm font-semibold text-white">
                        {selectedCountry?.name ?? "-"}
                      </p>
                    </div>
                    <div className="rounded-[18px] border border-white/10 bg-white/7 px-3 py-3">
                      <p className="text-[0.62rem] uppercase tracking-[0.2em] text-sky-100/52">
                        Results
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">
                        {filteredServices.length}
                      </p>
                    </div>
                  </div>

                  <input
                    className="mt-4 h-13 w-full rounded-[18px] border border-sky-100/20 bg-[#102846] px-4 text-base text-white outline-none placeholder:text-white/35"
                    onChange={(event) => setServiceSearch(event.target.value)}
                    placeholder="Cari layanan premium..."
                    value={serviceSearch}
                  />

                  <div className="mt-4 max-h-[55dvh] space-y-2 overflow-y-auto pr-1">
                    {filteredServices.map((service) => (
                      <button
                        key={service.id}
                        className={cn(
                          "flex w-full items-center justify-between rounded-[22px] border px-3 py-3 text-left transition-all duration-200",
                          selectedServiceId === service.id
                            ? "border-sky-100/28 bg-[linear-gradient(135deg,rgba(194,238,255,0.18),rgba(64,123,255,0.2))]"
                            : "border-white/8 bg-white/6",
                        )}
                        onClick={() => {
                          playUiFeedback("select");
                          setSelectedServiceId(service.id);
                          setServicePanelOpen(false);
                          setServiceSearch("");
                        }}
                        type="button"
                      >
                        <div className="flex min-w-0 items-center gap-3 pr-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] bg-[linear-gradient(145deg,rgba(229,248,255,0.28),rgba(116,190,255,0.28))] text-sm font-semibold text-sky-50 shadow-[0_18px_35px_-24px_rgba(92,176,255,0.9)]">
                            {getServiceBadge(service.service)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[1rem] font-semibold text-white">
                              {service.service}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-sky-50/50">
                              {service.serviceCode} • stok {service.stock}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[1rem] font-semibold text-sky-100">
                            {formatCurrency(service.price, service.currency)}
                          </p>
                          <p className="text-xs text-sky-50/50">
                            modal {formatCurrency(service.upstreamPrice, service.currency)}
                          </p>
                        </div>
                      </button>
                    ))}

                    {!filteredServices.length && !isLoadingCatalog ? (
                      <div className="rounded-[22px] border border-white/8 bg-white/6 px-4 py-8 text-center text-sm text-white/60">
                        Layanan real dari KirimKode belum masuk untuk pencarian ini.
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {selectedService && selectedServerMeta && selectedCountry ? (
            <div className="mt-4 rounded-[24px] bg-[#102846] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-sky-50/55">Service</p>
                  <p className="mt-1 text-[1.2rem] font-semibold text-white">
                    {selectedService.service}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-[1.02rem] font-semibold text-white">
                  <span className="flex h-9 w-9 items-center justify-center rounded-[14px] bg-sky-100/10">
                    {getServerGlyph(selectedServerMeta.iconKey)}
                  </span>
                  <span>{selectedServerMeta.name}</span>
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-[#0d2240] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-sky-50/55">Negara</p>
                    <p className="mt-1 text-base font-semibold text-white">
                      {getSafeCountryGlyph(selectedCountry)} {selectedCountry.name}
                    </p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-sky-50/50">
                      code {selectedService.serviceCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[1.08rem] font-semibold text-sky-100">
                      {formatCurrency(selectedService.price, selectedService.currency)}
                    </p>
                    <p className="mt-1 text-sm text-sky-50/55">
                      stok: {selectedService.stock}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <button
            className="mt-5 inline-flex h-14 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#e2f7ff,#93dcff_34%,#5cadff_67%,#3d7eff)] px-5 text-base font-semibold text-[#0b2248] shadow-[0_18px_35px_-22px_rgba(64,129,255,0.95)] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedService || !isPaymentReady || isCreatingPayment || !isSnapReady}
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
            className="lux-rise lux-panel mt-4 rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,46,93,0.95),rgba(10,34,72,0.96))] p-4 sm:p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-sky-50/55">Payment Status</p>
                <p className="mt-1 text-[1.15rem] font-semibold text-white">
                  {payment.service}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                  getPaymentStatusClass(payment.status),
                )}
              >
                {payment.status}
              </span>
            </div>

            <p className="mt-4 break-all text-sm leading-7 text-sky-50/62">
              {payment.statusMessage ?? payment.id}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/10 bg-[#102846] px-4 text-sm font-semibold text-white disabled:opacity-60"
                disabled={isRefreshingPayment}
                onClick={() => {
                  playUiFeedback("select");
                  void syncPayment(payment.id);
                }}
                type="button"
              >
                {isRefreshingPayment ? "Mengecek..." : "Cek Pembayaran"}
              </button>
              <button
                className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/10 bg-[#102846] px-4 text-sm font-semibold text-white disabled:opacity-60"
                disabled={!payment.snapToken || !isSnapReady}
                onClick={() => {
                  playUiFeedback("confirm");
                  openSnap(payment);
                }}
                type="button"
              >
                Buka Midtrans
              </button>
            </div>
          </section>
        ) : null}

        <section
          id="otp-zone"
          className="lux-rise lux-panel mt-4 rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(15,46,93,0.95),rgba(10,34,72,0.96))] p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-sky-50/55">OTP Result</p>
              <p className="mt-1 text-[1.15rem] font-semibold text-white">
                OTP tampil setelah payment sukses
              </p>
            </div>
            {order ? (
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
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
              <div className="rounded-[24px] bg-[#102846] p-4">
                <p className="text-sm text-sky-50/55">Nomor</p>
                <p className="mt-1 break-all text-xl font-semibold text-white">
                  {order.phoneNumber}
                </p>

                <p className="mt-5 text-sm text-sky-50/55">OTP Code</p>
                <p className="mt-2 break-all text-[1.85rem] font-semibold tracking-[0.08em] text-sky-100 sm:text-[2rem]">
                  {order.otpCode ?? "MENUNGGU SMS MASUK"}
                </p>

                <div className="mt-5 grid gap-3 text-sm text-sky-50/60">
                  <p>Dibuat: {formatDateTime(order.createdAt)}</p>
                  <p>Kedaluwarsa: {formatDateTime(order.expiresAt)}</p>
                  <p>Harga: {formatCurrency(order.price, order.currency)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/10 bg-[#102846] px-4 text-sm font-semibold text-white disabled:opacity-60"
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
                  className="inline-flex h-13 w-full items-center justify-center rounded-full border border-rose-200/18 bg-rose-300/12 px-4 text-sm font-semibold text-rose-50 disabled:opacity-60"
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
            <div className="mt-4 rounded-[24px] bg-[#102846] px-4 py-8 text-center text-sm leading-7 text-sky-50/58">
              Setelah checkout Midtrans berhasil, website akan membuat order ke
              KirimKode lalu menampilkan nomor dan OTP di sini.
            </div>
          )}
        </section>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          className="lux-swipe-pill"
          onClick={toggleQuickMenuSheet}
          onTouchEnd={(event) => handleSwipeEnd(event.changedTouches[0]?.clientY ?? 0)}
          onTouchStart={(event) => handleSwipeStart(event.changedTouches[0]?.clientY ?? 0)}
          type="button"
        >
          <span className="h-1.5 w-10 rounded-full bg-white/30" />
          <span className="flex items-center gap-2">
            <MenuOrbIcon className="h-4 w-4" />
            Quick Menu
          </span>
          <span className="text-[0.65rem] uppercase tracking-[0.24em] text-sky-100/55">
            swipe
          </span>
        </button>
      </div>

      <div
        aria-hidden={!quickMenuOpen}
        className={cn(
          "fixed inset-0 z-50 transition-all duration-300",
          quickMenuOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          className={cn(
            "absolute inset-0 bg-[#020614]/48 backdrop-blur-sm transition-opacity duration-300",
            quickMenuOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={closeQuickMenuSheet}
          type="button"
        />

        <div
          className={cn(
            "absolute inset-x-0 bottom-0 mx-auto w-full max-w-[470px] px-3 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-300",
            quickMenuOpen ? "translate-y-0" : "translate-y-[110%]",
          )}
        >
          <div className="rounded-[32px] border border-white/14 bg-[linear-gradient(180deg,rgba(7,21,48,0.98),rgba(12,37,78,0.95))] p-4 shadow-[0_32px_90px_-30px_rgba(2,8,25,0.98)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-sky-100/58">
                  Luxury Menu
                </p>
                <p className="mt-2 text-xl font-semibold text-white">
                  Navigasi cepat console
                </p>
                <p className="mt-1 text-sm leading-6 text-sky-50/62">
                  Geser ke atas atau tap menu untuk pindah bagian dengan cepat.
                </p>
              </div>
              <button
                className="rounded-full border border-white/12 bg-white/8 px-3 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-sky-50"
                onClick={closeQuickMenuSheet}
                type="button"
              >
                Tutup
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {quickMenuItems.map((item) => (
                <button
                  key={item.id}
                  className="rounded-[22px] border border-white/10 bg-white/7 p-4 text-left transition-transform duration-200 hover:-translate-y-0.5"
                  onClick={() => scrollToSection(item.id)}
                  type="button"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[linear-gradient(145deg,rgba(255,255,255,0.24),rgba(86,159,255,0.2))] text-sky-50">
                    {item.icon}
                  </span>
                  <p className="mt-3 text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-sky-100/52">
                    {item.caption}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
