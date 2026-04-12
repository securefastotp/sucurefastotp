"use client";

import Script from "next/script";
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useState,
} from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type {
  Balance,
  CatalogResponse,
  Order,
  PaymentRecord,
  RuntimeStatus,
  Service,
} from "@/lib/types";

type CatalogConsoleProps = {
  initialBalance: Balance | null;
  initialRuntime: RuntimeStatus;
};

type ServerId = "bimasakti" | "mars";

type CountryOption = {
  id: number;
  code: string;
  name: string;
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
    iconLabel: "BM",
    name: "Bimasakti",
    description: "Server utama, ambil data dari api1",
    gradient: "from-[#55a7ff] to-[#8bd4ff]",
  },
  {
    id: "mars" as const,
    iconLabel: "MR",
    name: "Mars",
    description: "Server cadangan, ambil data dari api2",
    gradient: "from-[#6ec8ff] to-[#3e86ff]",
  },
];

const countryOptions: CountryOption[] = [
  {
    id: 6,
    code: "ID",
    name: "Indonesia",
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
      return "border-emerald-300/20 bg-emerald-400/14 text-emerald-100";
    case "pending":
      return "border-sky-300/20 bg-sky-400/14 text-sky-100";
    case "expired":
      return "border-amber-300/20 bg-amber-400/14 text-amber-100";
    default:
      return "border-rose-300/20 bg-rose-400/14 text-rose-100";
  }
}

function getOrderStatusClass(status: Order["status"]) {
  switch (status) {
    case "otp_received":
      return "border-emerald-300/20 bg-emerald-400/14 text-emerald-100";
    case "expired":
      return "border-amber-300/20 bg-amber-400/14 text-amber-100";
    case "cancelled":
      return "border-rose-300/20 bg-rose-400/14 text-rose-100";
    default:
      return "border-sky-300/20 bg-sky-400/14 text-sky-100";
  }
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
      customerName: "OTP Customer",
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

function SectionBadge({
  label,
}: {
  label: string;
}) {
  return (
    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-sky-300/20 bg-sky-400/12 px-3 text-xs font-semibold uppercase tracking-[0.2em] text-sky-100">
      {label}
    </span>
  );
}

export function CatalogConsole({
  initialBalance,
  initialRuntime,
}: CatalogConsoleProps) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [selectedServer, setSelectedServer] = useState<ServerId>("bimasakti");
  const [selectedCountryId, setSelectedCountryId] = useState<number>(
    countryOptions[0]?.id ?? 6,
  );
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [servicePanelOpen, setServicePanelOpen] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
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

  const selectedCountry =
    countryOptions.find((country) => country.id === selectedCountryId) ??
    countryOptions[0];

  async function loadCatalog(serverId: ServerId, countryId: number) {
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
      setCatalogError(
        error instanceof Error ? error.message : "Gagal memuat katalog.",
      );
      setCatalog(null);
      setSelectedServiceId("");
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

        return activated.payment;
      }

      setPayment(nextPayment);

      if (nextPayment.order) {
        setOrder(nextPayment.order);
        rememberPaymentId(null);
      } else {
        rememberPaymentId(nextPayment.id);
      }

      return nextPayment;
    } catch (error) {
      setPaymentError(
        error instanceof Error ? error.message : "Gagal membaca payment.",
      );
      return null;
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
      onClose: () => {
        void syncPayment(currentPayment.id);
      },
      onError: () => {
        void syncPayment(currentPayment.id);
      },
      onPending: () => {
        void syncPayment(currentPayment.id);
      },
      onSuccess: () => {
        void syncPayment(currentPayment.id);
      },
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
    catalog?.services.filter((service) => {
      if (!deferredServiceSearch) {
        return true;
      }

      return `${service.service} ${service.serviceCode}`
        .toLowerCase()
        .includes(deferredServiceSearch.toLowerCase());
    }) ?? [];

  const selectedService =
    catalog?.services.find((service) => service.id === selectedServiceId) ?? null;
  const selectedServerMeta = serverOptions.find(
    (server) => server.id === selectedServer,
  );
  const balanceLabel = initialBalance
    ? formatCurrency(initialBalance.amount, initialBalance.currency)
    : "Saldo tidak terbaca";

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,#2f7dff_0%,#13233b_28%,#0d1728_100%)] text-white">
      {isPaymentReady ? (
        <Script
          data-client-key={midtransClientKey}
          onReady={() => setIsSnapReady(true)}
          src={snapScriptUrl}
          strategy="afterInteractive"
        />
      ) : null}

      <main className="mx-auto w-full max-w-[460px] px-3 py-4 sm:px-4">
        <div className="rounded-[28px] border border-white/10 bg-[#111c31]/95 px-4 py-4 shadow-[0_24px_60px_-40px_rgba(0,0,0,0.85)] sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-[1.95rem] font-semibold leading-none text-white sm:text-[2.2rem]">
                Buy OTP Number
              </h1>
              <p className="mt-2 max-w-[18rem] text-sm leading-6 text-white/65 sm:text-base sm:leading-7">
                Pilih server, negara, dan layanan. Nomor aktif setelah pembayaran
                Midtrans sukses.
              </p>
            </div>
            <div className="rounded-full border border-sky-300/20 bg-sky-400/12 px-3 py-2 text-sm font-semibold text-sky-100">
              {balanceLabel}
            </div>
          </div>
        </div>

        {catalogError ? (
          <div className="mt-4 rounded-[22px] border border-rose-300/18 bg-rose-400/12 px-4 py-4 text-sm leading-7 text-rose-100">
            {catalogError}
          </div>
        ) : null}

        {catalog?.warning ? (
          <div className="mt-4 rounded-[22px] border border-amber-300/18 bg-amber-400/10 px-4 py-4 text-sm leading-7 text-amber-50">
            {catalog.warning}
          </div>
        ) : null}

        {isLoadingCatalog ? (
          <div className="mt-4 rounded-[22px] border border-white/10 bg-[#111c31] px-4 py-4 text-sm leading-7 text-white/55">
            Memuat katalog layanan...
          </div>
        ) : null}

        <section className="mt-4 rounded-[28px] border border-white/10 bg-[#1a2438]/95 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <SectionBadge label="SV" />
            <p className="text-[1.1rem] font-semibold text-white sm:text-[1.2rem]">
              Select Server
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            {serverOptions.map((server) => {
              const active = selectedServer === server.id;

              return (
                <button
                  key={server.id}
                  className={cn(
                    "flex w-full items-center justify-between rounded-[24px] border px-4 py-4 text-left transition-colors",
                    active
                      ? "border-sky-300 bg-[linear-gradient(135deg,rgba(71,150,255,0.18),rgba(113,223,255,0.12))]"
                      : "border-white/10 bg-[#121d31]",
                  )}
                  onClick={() => setSelectedServer(server.id)}
                  type="button"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div
                      className={cn(
                        "flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[linear-gradient(135deg,var(--tw-gradient-stops))] text-base font-black text-white",
                        server.gradient,
                      )}
                    >
                      {server.iconLabel}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[1.05rem] font-semibold text-white sm:text-[1.15rem]">
                          {server.name}
                        </p>
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-300" />
                      </div>
                      <p className="mt-1 text-sm leading-6 text-white/50">
                        {server.description}
                      </p>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold",
                      active
                        ? "border-sky-300 bg-sky-400/10 text-sky-100"
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

        <section className="mt-4 rounded-[28px] border border-white/10 bg-[#1a2438]/95 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <SectionBadge label="CT" />
            <p className="text-[1.1rem] font-semibold text-white sm:text-[1.2rem]">
              Select Country
            </p>
          </div>

          <select
            className="mt-4 h-14 w-full rounded-[22px] border border-white/10 bg-[#121d31] px-4 text-base text-white outline-none sm:text-lg"
            onChange={(event) => setSelectedCountryId(Number(event.target.value))}
            value={selectedCountryId}
          >
            {countryOptions.map((country) => (
              <option key={country.id} value={country.id}>
                {country.code} - {country.name}
              </option>
            ))}
          </select>
        </section>

        <section className="mt-4 rounded-[28px] border border-white/10 bg-[#1a2438]/95 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <SectionBadge label="SC" />
            <p className="text-[1.1rem] font-semibold text-white sm:text-[1.2rem]">
              Select Service
            </p>
          </div>

          <button
            className="mt-4 flex h-14 w-full items-center justify-between rounded-[22px] border border-sky-300/55 bg-[#121d31] px-4 text-left text-base text-white sm:text-lg"
            onClick={() => setServicePanelOpen((current) => !current)}
            type="button"
          >
            <span className="truncate">
              {selectedService?.service ?? "Select Service"}
            </span>
            <span className="text-white/45">{servicePanelOpen ? "UP" : "DOWN"}</span>
          </button>

          {servicePanelOpen ? (
            <div className="mt-4 rounded-[24px] border border-white/10 bg-[#222f46] p-4">
              <input
                className="h-13 w-full rounded-[18px] border border-sky-300/55 bg-[#121d31] px-4 text-base text-white outline-none placeholder:text-white/35"
                onChange={(event) => setServiceSearch(event.target.value)}
                placeholder="Search service..."
                value={serviceSearch}
              />

              <div className="mt-4 max-h-[280px] space-y-2 overflow-y-auto pr-1">
                {filteredServices.map((service) => (
                  <button
                    key={service.id}
                    className={cn(
                      "flex w-full items-center justify-between rounded-[18px] px-3 py-3 text-left transition-colors",
                      selectedServiceId === service.id ? "bg-white/8" : "bg-transparent",
                    )}
                    onClick={() => {
                      setSelectedServiceId(service.id);
                      setServicePanelOpen(false);
                    }}
                    type="button"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="truncate text-[1rem] font-medium text-white sm:text-[1.05rem]">
                        {service.service}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/38">
                        {service.serviceCode} / {service.countryCode}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-white/45">stok {service.stock}</p>
                      <p className="mt-1 text-[1rem] font-semibold text-sky-200 sm:text-[1.05rem]">
                        {formatCurrency(service.price, service.currency)}
                      </p>
                    </div>
                  </button>
                ))}

                {!filteredServices.length ? (
                  <div className="rounded-[18px] bg-[#121d31] px-4 py-6 text-center text-sm text-white/50">
                    Tidak ada layanan yang cocok.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          {selectedService && selectedServerMeta ? (
            <div className="mt-4 rounded-[24px] bg-[#152034] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-white/55">Service</p>
                  <p className="mt-1 text-[1.2rem] font-semibold text-white sm:text-[1.3rem]">
                    {selectedService.service}
                  </p>
                </div>
                <p className="text-[1.1rem] font-semibold text-white sm:text-[1.25rem]">
                  {selectedServerMeta.name}
                </p>
              </div>

              <div className="mt-4 rounded-[22px] border border-white/10 bg-[#121d31] px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-white/48">Negara</p>
                    <p className="mt-1 text-base font-semibold text-white">
                      {selectedCountry?.name ?? selectedService.country}
                    </p>
                    <p className="mt-3 text-sm text-white/48">Kode Layanan</p>
                    <p className="mt-1 text-sm font-semibold uppercase tracking-[0.16em] text-sky-200">
                      {selectedService.serviceCode}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[1.05rem] font-semibold text-sky-200 sm:text-[1.1rem]">
                      {formatCurrency(selectedService.price, selectedService.currency)}
                    </p>
                    <p className="mt-1 text-sm text-white/45">
                      stok: {selectedService.stock}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="mt-4 rounded-[22px] border border-white/10 bg-[#121d31] px-4 py-4 text-sm leading-7 text-white/60">
            Base URL
            <div className="mt-2 text-sky-200">https://api.kirimkode.com/v1</div>
            <div className="mt-4">Payload Order</div>
            <div className="mt-2 text-white/75">
              server: {selectedServer === "bimasakti" ? "api1" : "api2"}, country:{" "}
              {selectedCountryId}, operator: any
            </div>
            <div className="mt-4">
              {isPaymentReady
                ? `Midtrans ${initialRuntime.midtransEnvironment} siap dipakai.`
                : "Midtrans belum dikonfigurasi di Vercel."}
            </div>
          </div>

          <button
            className="mt-5 inline-flex h-14 w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#8bd4ff,#52a8ff)] px-5 text-base font-semibold text-[#071422] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={!selectedService || !isPaymentReady || isCreatingPayment || !isSnapReady}
            onClick={() => void handleCreateCheckout()}
            type="button"
          >
            {isCreatingPayment ? "Membuat Checkout..." : "Beli Nomor"}
          </button>
        </section>

        {paymentError ? (
          <div className="mt-4 rounded-[22px] border border-rose-300/18 bg-rose-400/12 px-4 py-4 text-sm leading-7 text-rose-100">
            {paymentError}
          </div>
        ) : null}

        {payment ? (
          <section className="mt-4 rounded-[28px] border border-white/10 bg-[#1a2438]/95 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-white/45">Payment Status</p>
                <p className="mt-1 text-[1.15rem] font-semibold text-white sm:text-[1.25rem]">
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

            <p className="mt-4 break-all text-sm leading-7 text-white/58">
              {payment.statusMessage ?? payment.id}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button
                className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/10 bg-[#121d31] px-4 text-sm font-semibold text-white disabled:opacity-60"
                disabled={isRefreshingPayment}
                onClick={() => void syncPayment(payment.id)}
                type="button"
              >
                {isRefreshingPayment ? "Mengecek..." : "Cek Pembayaran"}
              </button>
              <button
                className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/10 bg-[#121d31] px-4 text-sm font-semibold text-white disabled:opacity-60"
                disabled={!payment.snapToken || !isSnapReady}
                onClick={() => openSnap(payment)}
                type="button"
              >
                Buka Midtrans
              </button>
            </div>
          </section>
        ) : null}

        <section className="mt-4 rounded-[28px] border border-white/10 bg-[#1a2438]/95 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-white/45">OTP Result</p>
              <p className="mt-1 text-[1.15rem] font-semibold text-white sm:text-[1.25rem]">
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
            <div className="mt-4 rounded-[22px] border border-rose-300/18 bg-rose-400/12 px-4 py-4 text-sm leading-7 text-rose-100">
              {orderError}
            </div>
          ) : null}

          {order ? (
            <div className="mt-4">
              <div className="rounded-[24px] bg-[#121d31] p-4">
                <p className="text-sm text-white/48">Nomor</p>
                <p className="mt-1 break-all text-xl font-semibold text-white">
                  {order.phoneNumber}
                </p>

                <p className="mt-5 text-sm text-white/48">OTP Code</p>
                <p className="mt-2 break-all text-[1.85rem] font-semibold tracking-[0.08em] text-sky-200 sm:text-[2rem]">
                  {order.otpCode ?? "MENUNGGU SMS MASUK"}
                </p>

                <div className="mt-5 grid gap-3 text-sm text-white/58">
                  <p>Dibuat: {formatDateTime(order.createdAt)}</p>
                  <p>Kedaluwarsa: {formatDateTime(order.expiresAt)}</p>
                  <p>Harga: {formatCurrency(order.price, order.currency)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <button
                  className="inline-flex h-13 w-full items-center justify-center rounded-full border border-white/10 bg-[#121d31] px-4 text-sm font-semibold text-white disabled:opacity-60"
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
                  className="inline-flex h-13 w-full items-center justify-center rounded-full border border-rose-300/14 bg-rose-400/10 px-4 text-sm font-semibold text-rose-100 disabled:opacity-60"
                  disabled={isRefreshingOrder || order.status !== "pending"}
                  onClick={() => void handleCancelOrder()}
                  type="button"
                >
                  Cancel Order
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[24px] bg-[#121d31] px-4 py-8 text-center text-sm leading-7 text-white/50">
              Setelah checkout Midtrans berhasil, website akan membuat order ke
              KirimKode lalu menampilkan nomor dan OTP di sini.
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
