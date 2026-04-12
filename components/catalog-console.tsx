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
    name: "Bimasakti",
    code: "api1",
    iconKey: "bimasakti" as const,
    description: "Server utama KirimKode",
  },
  {
    id: "mars" as const,
    name: "Mars",
    code: "api2",
    iconKey: "mars" as const,
    description: "Server cadangan KirimKode",
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
        d="M12 2.5L5.8 12.1h4.3l-1.3 9.4 7.9-11h-4.5L12 2.5z"
        fill="currentColor"
      />
      <path
        d="M5 6.5h3.3M15.8 17.5H19"
        stroke="currentColor"
        strokeLinecap="round"
        strokeOpacity=".55"
        strokeWidth="1.5"
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

function BimasaktiIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M12.8 3.8l-4.1 7h3l-.8 9.4 4.6-7.8h-3.1l.4-8.6z"
        fill="currentColor"
      />
    </svg>
  );
}

function MarsIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" fill="currentColor" r="5.2" />
      <path
        d="M14.8 9.2l3-3m0 0h-2.1m2.1 0v2.1"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
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
  if (iconKey === "mars") {
    return <MarsIcon className="h-8 w-8" />;
  }

  return <BimasaktiIcon className="h-8 w-8" />;
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
  const [countryPanelOpen, setCountryPanelOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePanelOpen, setServicePanelOpen] = useState(false);
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
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,#effbff_0%,#bfeaff_16%,#7cc8ff_38%,#4f9aff_68%,#3c78f5_100%)] text-white">
      {isPaymentReady ? (
        <Script
          data-client-key={midtransClientKey}
          onReady={() => setIsSnapReady(true)}
          src={snapScriptUrl}
          strategy="afterInteractive"
        />
      ) : null}

      <main className="mx-auto w-full max-w-[470px] px-3 py-4 sm:px-4 sm:py-5">
        <div className="rounded-[30px] border border-white/16 bg-[linear-gradient(180deg,rgba(20,59,111,0.96),rgba(17,48,93,0.93))] px-4 py-5 shadow-[0_24px_80px_-40px_rgba(7,18,52,0.95)] sm:px-5">
          <div className="flex items-start gap-4">
            <ShellIcon className="h-14 w-14 rounded-[22px] bg-[linear-gradient(145deg,#edfaff,#9de0ff_48%,#4e8dff)] text-[#113663]">
              <BrandIcon className="h-8 w-8" />
            </ShellIcon>
            <div>
              <h1 className="text-[2rem] font-semibold leading-none text-white sm:text-[2.2rem]">
                Rahmat OTP
              </h1>
              <p className="mt-2 text-sm leading-7 text-sky-50/82 sm:text-base">
                Pilih server, negara, dan layanan. Nomor aktif setelah payment
                Midtrans sukses.
              </p>
            </div>
          </div>
        </div>

        {countryError ? (
          <div className="mt-4 rounded-[24px] border border-rose-200/20 bg-rose-300/12 px-4 py-4 text-sm leading-7 text-rose-50">
            {countryError}
          </div>
        ) : null}

        {catalogError ? (
          <div className="mt-4 rounded-[24px] border border-rose-200/20 bg-rose-300/12 px-4 py-4 text-sm leading-7 text-rose-50">
            {catalogError}
          </div>
        ) : null}

        {catalog?.warning && catalog.total === 0 ? (
          <div className="mt-4 rounded-[24px] border border-sky-100/20 bg-sky-100/12 px-4 py-4 text-sm leading-7 text-sky-50">
            {catalog.warning}
          </div>
        ) : null}

        <section className="mt-4 rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(24,63,116,0.95),rgba(22,54,100,0.94))] p-4 sm:p-5">
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
                  onClick={() => setSelectedServer(server.id)}
                  type="button"
                >
                  <div className="flex items-center gap-4">
                    <ShellIcon className="h-14 w-14 rounded-[20px] bg-[linear-gradient(145deg,#edfaff,#9de0ff_48%,#4e8dff)] text-white">
                      {getServerGlyph(server.iconKey)}
                    </ShellIcon>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[1.08rem] font-semibold text-white">
                          {server.name}
                        </p>
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
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

        <section className="mt-4 rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(24,63,116,0.95),rgba(22,54,100,0.94))] p-4 sm:p-5">
          <SectionTitle
            icon={<GlobeIcon className="h-5 w-5" />}
            title="Select Country"
          />
          <button
            className="mt-4 flex min-h-14 w-full items-center justify-between rounded-[22px] border border-sky-100/20 bg-[#102846] px-4 py-3 text-left"
            disabled={isLoadingCountries || countries.length === 0}
            onClick={() => setCountryPanelOpen((current) => !current)}
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

        <section className="mt-4 rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(24,63,116,0.95),rgba(22,54,100,0.94))] p-4 sm:p-5">
          <SectionTitle
            icon={<ServiceIcon className="h-5 w-5" />}
            title="Select Service"
          />
          <button
            className="mt-4 flex min-h-14 w-full items-center justify-between rounded-[22px] border border-sky-100/20 bg-[#102846] px-4 py-3 text-left"
            onClick={() => setServicePanelOpen((current) => !current)}
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
            <div className="mt-4 rounded-[24px] border border-white/10 bg-[#214571]/92 p-4">
              <input
                className="h-13 w-full rounded-[18px] border border-sky-100/20 bg-[#102846] px-4 text-base text-white outline-none placeholder:text-white/35"
                onChange={(event) => setServiceSearch(event.target.value)}
                placeholder="Cari layanan..."
                value={serviceSearch}
              />

              <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {filteredServices.map((service) => (
                  <button
                    key={service.id}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left transition-colors",
                      selectedServiceId === service.id ? "bg-sky-100/12" : "bg-transparent",
                    )}
                    onClick={() => {
                      setSelectedServiceId(service.id);
                      setServicePanelOpen(false);
                    }}
                    type="button"
                  >
                    <div className="flex min-w-0 items-center gap-3 pr-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[16px] bg-[linear-gradient(145deg,rgba(229,248,255,0.28),rgba(116,190,255,0.28))] text-sm font-semibold text-sky-50">
                        {getServiceBadge(service.service)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[1rem] font-medium text-white">
                          {service.service}
                        </p>
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-sky-50/50">
                          {service.serviceCode} - stok {service.stock}
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
                  <div className="rounded-[18px] bg-[#102846] px-4 py-6 text-center text-sm text-white/60">
                    Layanan real dari KirimKode belum masuk untuk pilihan ini.
                  </div>
                ) : null}
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
            onClick={() => void handleCreateCheckout()}
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

        {payment ? (
          <section className="mt-4 rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(24,63,116,0.95),rgba(22,54,100,0.94))] p-4 sm:p-5">
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
                onClick={() => void syncPayment(payment.id)}
                type="button"
              >
                {isRefreshingPayment ? "Mengecek..." : "Cek Pembayaran"}
              </button>
              <button
                className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/10 bg-[#102846] px-4 text-sm font-semibold text-white disabled:opacity-60"
                disabled={!payment.snapToken || !isSnapReady}
                onClick={() => openSnap(payment)}
                type="button"
              >
                Buka Midtrans
              </button>
            </div>
          </section>
        ) : null}

        <section className="mt-4 rounded-[28px] border border-white/14 bg-[linear-gradient(180deg,rgba(24,63,116,0.95),rgba(22,54,100,0.94))] p-4 sm:p-5">
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
                  onClick={() => void handleCancelOrder()}
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
    </div>
  );
}
