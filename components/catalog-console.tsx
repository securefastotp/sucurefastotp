"use client";

import Script from "next/script";
import {
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
    icon: "\u2726",
    description: "Server utama KirimKode",
  },
  {
    id: "mars" as const,
    name: "Mars",
    code: "api2",
    icon: "\u25CE",
    description: "Server cadangan KirimKode",
  },
];

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

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-[16px] border border-white/14 bg-sky-100/12 text-lg">
        {icon}
      </div>
      <p className="text-[1.12rem] font-semibold text-white sm:text-[1.2rem]">
        {title}
      </p>
    </div>
  );
}

export function CatalogConsole({ initialRuntime }: CatalogConsoleProps) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [selectedServer, setSelectedServer] = useState<ServerId>("bimasakti");
  const [selectedCountryId, setSelectedCountryId] = useState<number | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePanelOpen, setServicePanelOpen] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [countryError, setCountryError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isCreatingPayment, setIsCreatingPayment] = useState(false);
  const [isRefreshingPayment, setIsRefreshingPayment] = useState(false);
  const [isRefreshingOrder, setIsRefreshingOrder] = useState(false);
  const [isSnapReady, setIsSnapReady] = useState(false);
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
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top_left,#d8f4ff_0%,#9bdcff_18%,#5fafff_45%,#377aff_72%,#2250cf_100%)] text-white">
      {isPaymentReady ? (
        <Script
          data-client-key={midtransClientKey}
          onReady={() => setIsSnapReady(true)}
          src={snapScriptUrl}
          strategy="afterInteractive"
        />
      ) : null}

      <main className="mx-auto w-full max-w-[470px] px-3 py-4 sm:px-4 sm:py-5">
        <div className="rounded-[30px] border border-white/14 bg-[#12305b]/92 px-4 py-5 shadow-[0_24px_80px_-40px_rgba(7,18,52,0.95)] sm:px-5">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-[linear-gradient(145deg,#dbf4ff,#8fd8ff_45%,#4a8cff)] text-[1.6rem] shadow-[0_18px_30px_-18px_rgba(33,93,255,0.9)]">
              {"\u26A1"}
            </div>
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

        {catalog?.warning ? (
          <div className="mt-4 rounded-[24px] border border-sky-100/20 bg-sky-100/12 px-4 py-4 text-sm leading-7 text-sky-50">
            {catalog.warning}
          </div>
        ) : null}

        <section className="mt-4 rounded-[28px] border border-white/14 bg-[#173764]/92 p-4 sm:p-5">
          <SectionTitle icon={"\u2699"} title="Select Server" />
          <div className="mt-4 grid gap-3">
            {serverOptions.map((server) => {
              const active = selectedServer === server.id;

              return (
                <button
                  key={server.id}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[24px] border px-4 py-4 text-left transition-colors",
                    active
                      ? "border-sky-100/85 bg-[linear-gradient(135deg,rgba(176,233,255,0.22),rgba(71,145,255,0.28))]"
                      : "border-white/10 bg-[#102846]",
                  )}
                  onClick={() => setSelectedServer(server.id)}
                  type="button"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-[20px] bg-[linear-gradient(145deg,#dff5ff,#8fd8ff_45%,#3e7fff)] text-[1.55rem] shadow-[0_16px_30px_-20px_rgba(38,101,255,0.95)]">
                      {server.icon}
                    </div>
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

        <section className="mt-4 rounded-[28px] border border-white/14 bg-[#173764]/92 p-4 sm:p-5">
          <SectionTitle icon={"\u25CE"} title="Select Country" />
          <select
            className="mt-4 h-14 w-full rounded-[22px] border border-sky-100/20 bg-[#102846] px-4 text-base text-white outline-none"
            disabled={isLoadingCountries || countries.length === 0}
            onChange={(event) => setSelectedCountryId(Number(event.target.value))}
            value={selectedCountryId ?? ""}
          >
            {isLoadingCountries ? <option value="">Memuat negara...</option> : null}
            {!isLoadingCountries && countries.length === 0 ? (
              <option value="">Negara belum tersedia</option>
            ) : null}
            {countries.map((country) => (
              <option key={`${country.serverId}-${country.id}`} value={country.id}>
                {(country.flagEmoji ?? "\u2691")} {country.name} - ID {country.id}
              </option>
            ))}
          </select>

          {selectedCountry ? (
            <div className="mt-4 rounded-[22px] border border-white/10 bg-[#102846] px-4 py-4 text-sm leading-7 text-sky-50/76">
              <div className="flex items-center gap-3">
                <div className="text-2xl">{selectedCountry.flagEmoji ?? "\u2691"}</div>
                <div>
                  <p className="font-semibold text-white">{selectedCountry.name}</p>
                  <p className="text-sky-50/58">
                    code {selectedCountry.code} • {selectedCountry.availableServices} layanan
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="mt-4 rounded-[28px] border border-white/14 bg-[#173764]/92 p-4 sm:p-5">
          <SectionTitle icon={"\u25A3"} title="Select Service" />
          <button
            className="mt-4 flex min-h-14 w-full items-center justify-between rounded-[22px] border border-sky-100/20 bg-[#102846] px-4 py-3 text-left"
            onClick={() => setServicePanelOpen((current) => !current)}
            type="button"
          >
            <span className="truncate text-base font-medium text-white">
              {selectedService?.service ?? "Select Service"}
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-100/80">
              {servicePanelOpen ? "Tutup" : "Buka"}
            </span>
          </button>

          {servicePanelOpen ? (
            <div className="mt-4 rounded-[24px] border border-white/10 bg-[#214571]/92 p-4">
              <input
                className="h-13 w-full rounded-[18px] border border-sky-100/20 bg-[#102846] px-4 text-base text-white outline-none placeholder:text-white/35"
                onChange={(event) => setServiceSearch(event.target.value)}
                placeholder="Cari layanan..."
                value={serviceSearch}
              />

              <div className="mt-4 max-h-[300px] space-y-2 overflow-y-auto pr-1">
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
                    <div className="min-w-0 pr-3">
                      <p className="truncate text-[1rem] font-medium text-white">
                        {service.service}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-sky-50/50">
                        {service.serviceCode} • stok {service.stock}
                      </p>
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
                <p className="text-[1.02rem] font-semibold text-white">
                  {selectedServerMeta.icon} {selectedServerMeta.name}
                </p>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-[#0d2240] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-sky-50/55">Negara</p>
                    <p className="mt-1 text-base font-semibold text-white">
                      {(selectedCountry.flagEmoji ?? "\u2691")} {selectedCountry.name}
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
          <section className="mt-4 rounded-[28px] border border-white/14 bg-[#173764]/92 p-4 sm:p-5">
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

        <section className="mt-4 rounded-[28px] border border-white/14 bg-[#173764]/92 p-4 sm:p-5">
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
