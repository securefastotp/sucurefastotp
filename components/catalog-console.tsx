"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type {
  CatalogResponse,
  Order,
  RuntimeStatus,
  Service,
} from "@/lib/types";

type CatalogConsoleProps = {
  initialRuntime: RuntimeStatus;
};

function hasError(payload: unknown): payload is { error?: string } {
  return Boolean(payload && typeof payload === "object" && "error" in payload);
}

async function requestCatalog() {
  const response = await fetch("/api/catalog", { cache: "no-store" });
  const payload = (await response.json()) as CatalogResponse | { error?: string };

  if (!response.ok || hasError(payload)) {
    const message = hasError(payload) ? payload.error : undefined;
    throw new Error(message ?? "Gagal memuat katalog.");
  }

  return payload;
}

async function requestOrderStatus(orderId: string) {
  const response = await fetch(`/api/orders/${orderId}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as { order: Order } | { error?: string };

  if (!response.ok || !("order" in payload)) {
    const message = hasError(payload) ? payload.error : undefined;
    throw new Error(message ?? "Gagal membaca status order.");
  }

  return payload.order;
}

async function requestCreateOrder(service: Service) {
  const response = await fetch("/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      serviceId: service.id,
      service: service.service,
      country: service.country,
      price: service.price,
      currency: service.currency,
    }),
  });

  const payload = (await response.json()) as { order: Order } | { error?: string };

  if (!response.ok || !("order" in payload)) {
    const message = hasError(payload) ? payload.error : undefined;
    throw new Error(message ?? "Gagal membuat order.");
  }

  return payload.order;
}

async function requestCancelOrder(orderId: string) {
  const response = await fetch(`/api/orders/${orderId}`, {
    method: "DELETE",
  });

  const payload = (await response.json()) as { order: Order } | { error?: string };

  if (!response.ok || !("order" in payload)) {
    const message = hasError(payload) ? payload.error : undefined;
    throw new Error(message ?? "Gagal membatalkan order.");
  }

  return payload.order;
}

export function CatalogConsole({ initialRuntime }: CatalogConsoleProps) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("Semua");
  const [category, setCategory] = useState("Semua");
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isOrdering, setIsOrdering] = useState(false);
  const [isRefreshingOrder, setIsRefreshingOrder] = useState(false);
  const deferredQuery = useDeferredValue(query);

  async function loadCatalog() {
    setIsLoadingCatalog(true);
    setCatalogError(null);

    try {
      const payload = await requestCatalog();

      setCatalog(payload);
      setSelectedService((current) => {
        if (!payload.services.length) {
          return null;
        }

        return (
          payload.services.find((service) => service.id === current?.id) ??
          payload.services[0]
        );
      });
    } catch (error) {
      setCatalogError(
        error instanceof Error ? error.message : "Gagal memuat katalog.",
      );
    } finally {
      setIsLoadingCatalog(false);
    }
  }

  async function refreshOrder(orderId: string) {
    setIsRefreshingOrder(true);
    setOrderError(null);

    try {
      setOrder(await requestOrderStatus(orderId));
    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : "Gagal membaca status order.",
      );
    } finally {
      setIsRefreshingOrder(false);
    }
  }

  useEffect(() => {
    void loadCatalog();
  }, []);

  useEffect(() => {
    if (!order?.id || order.status !== "pending") {
      return;
    }

    const intervalId = window.setInterval(() => {
      startTransition(() => {
        void refreshOrder(order.id);
      });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [order?.id, order?.status]);

  const services =
    catalog?.services.filter((service) => {
      const matchesQuery =
        !deferredQuery ||
        `${service.service} ${service.country} ${service.category} ${service.tags.join(" ")}`
          .toLowerCase()
          .includes(deferredQuery.toLowerCase());

      const matchesCountry = country === "Semua" || service.country === country;
      const matchesCategory =
        category === "Semua" || service.category === category;

      return matchesQuery && matchesCountry && matchesCategory;
    }) ?? [];

  async function handleCreateOrder(service: Service) {
    setSelectedService(service);
    setIsOrdering(true);
    setOrderError(null);

    try {
      setOrder(await requestCreateOrder(service));
    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : "Gagal membuat order.",
      );
    } finally {
      setIsOrdering(false);
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

  const runtimePills = [
    `Mode: ${initialRuntime.providerMode.toUpperCase()}`,
    `Markup: ${initialRuntime.markupPercent}%`,
    `Min Margin: ${formatCurrency(initialRuntime.minMargin, initialRuntime.currency)}`,
    initialRuntime.baseUrlHost
      ? `Host: ${initialRuntime.baseUrlHost}`
      : "Host: mock-runtime",
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="space-y-6">
        <div className="panel p-6">
          <div className="flex flex-wrap gap-3">
            {runtimePills.map((pill) => (
              <span
                key={pill}
                className="rounded-full border border-ink/10 bg-paper px-4 py-2 text-sm font-medium text-ink/72"
              >
                {pill}
              </span>
            ))}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm text-ink/72">
              <span className="block font-semibold text-ink">Cari layanan</span>
              <input
                className="w-full rounded-[18px] border border-ink/10 bg-white px-4 py-3 outline-none transition-colors focus:border-brand"
                placeholder="WhatsApp, Telegram, Indonesia..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>

            <label className="space-y-2 text-sm text-ink/72">
              <span className="block font-semibold text-ink">Negara</span>
              <select
                className="w-full rounded-[18px] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-brand"
                value={country}
                onChange={(event) => setCountry(event.target.value)}
              >
                <option value="Semua">Semua</option>
                {catalog?.countries.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm text-ink/72">
              <span className="block font-semibold text-ink">Kategori</span>
              <select
                className="w-full rounded-[18px] border border-ink/10 bg-white px-4 py-3 outline-none focus:border-brand"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="Semua">Semua</option>
                {catalog?.categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="panel p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
                Katalog supply
              </p>
              <h2 className="mt-2 font-display text-3xl text-ink">
                Pilih layanan yang mau dijual
              </h2>
            </div>
            <button
              className="hero-button-muted"
              onClick={() => {
                startTransition(() => {
                  void loadCatalog();
                });
              }}
              type="button"
            >
              Refresh Katalog
            </button>
          </div>

          {catalogError ? (
            <div className="mt-6 rounded-[22px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {catalogError}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4">
            {isLoadingCatalog ? (
              <div className="rounded-[24px] border border-ink/8 bg-paper px-5 py-10 text-center text-sm text-ink/60">
                Memuat katalog supplier...
              </div>
            ) : null}

            {!isLoadingCatalog && services.length === 0 ? (
              <div className="rounded-[24px] border border-ink/8 bg-paper px-5 py-10 text-center text-sm text-ink/60">
                Tidak ada layanan yang cocok dengan filter saat ini.
              </div>
            ) : null}

            {services.map((service) => {
              const isSelected = selectedService?.id === service.id;

              return (
                <button
                  key={service.id}
                  className={`rounded-[24px] border px-5 py-5 text-left transition-transform duration-200 hover:-translate-y-0.5 ${
                    isSelected
                      ? "border-brand bg-white shadow-[0_18px_50px_-34px_rgba(255,107,61,0.9)]"
                      : "border-ink/8 bg-white/78"
                  }`}
                  onClick={() => setSelectedService(service)}
                  type="button"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                          {service.category}
                        </span>
                        <span className="rounded-full border border-ink/10 px-3 py-1 text-xs font-medium text-ink/60">
                          {service.country}
                        </span>
                      </div>
                      <h3 className="mt-3 font-display text-2xl text-ink">
                        {service.service}
                      </h3>
                      <p className="mt-2 text-sm text-ink/65">
                        Modal {formatCurrency(service.upstreamPrice, service.currency)}{" "}
                        • ETA {service.deliveryEtaSeconds}s • {service.stock} stok
                      </p>
                    </div>

                    <div className="min-w-[210px] lg:text-right">
                      <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
                        Harga jual
                      </p>
                      <p className="mt-1 font-display text-3xl text-ink">
                        {formatCurrency(service.price, service.currency)}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-ink/55">
                        {service.tags.join(" • ")}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <aside className="space-y-6">
        <div className="panel p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-2">
            Service Inspector
          </p>
          {selectedService ? (
            <div className="mt-4">
              <h2 className="font-display text-3xl text-ink">
                {selectedService.service}
              </h2>
              <p className="mt-2 text-sm leading-7 text-ink/68">
                {selectedService.country} • {selectedService.category} • stok{" "}
                {selectedService.stock}
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-ink/8 bg-paper p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
                    Harga modal
                  </p>
                  <p className="mt-2 font-display text-2xl text-ink">
                    {formatCurrency(
                      selectedService.upstreamPrice,
                      selectedService.currency,
                    )}
                  </p>
                </div>
                <div className="rounded-[22px] border border-ink/8 bg-paper p-4">
                  <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
                    Harga jual
                  </p>
                  <p className="mt-2 font-display text-2xl text-ink">
                    {formatCurrency(selectedService.price, selectedService.currency)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-[22px] border border-ink/8 bg-paper p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-ink/45">
                  Tags
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedService.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-ink/10 bg-white px-3 py-1 text-xs font-medium text-ink/65"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <button
                className="hero-button mt-6 w-full"
                disabled={isOrdering}
                onClick={() => void handleCreateOrder(selectedService)}
                type="button"
              >
                {isOrdering ? "Membuat Order..." : "Ambil Nomor Sekarang"}
              </button>
            </div>
          ) : (
            <div className="mt-5 rounded-[22px] border border-ink/8 bg-paper px-4 py-8 text-center text-sm text-ink/60">
              Pilih layanan di kiri untuk melihat detail dan membuat order.
            </div>
          )}
        </div>

        <div className="panel p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand">
            Order Status
          </p>

          {orderError ? (
            <div className="mt-4 rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {orderError}
            </div>
          ) : null}

          {order ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-[24px] border border-ink/8 bg-paper p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-display text-2xl text-ink">
                      {order.service}
                    </h3>
                    <p className="mt-1 text-sm text-ink/62">{order.country}</p>
                  </div>
                  <span className="rounded-full bg-ink px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white">
                    {order.status.replace("_", " ")}
                  </span>
                </div>

                <div className="mt-5 space-y-3 text-sm text-ink/70">
                  <p>Nomor: {order.phoneNumber}</p>
                  <p>Harga: {formatCurrency(order.price, order.currency)}</p>
                  <p>Dibuat: {formatDateTime(order.createdAt)}</p>
                  <p>Kedaluwarsa: {formatDateTime(order.expiresAt)}</p>
                  <p>Ref Provider: {order.providerRef ?? "-"}</p>
                </div>
              </div>

              <div className="rounded-[24px] border border-ink/8 bg-[#101a26] p-5 text-white">
                <p className="text-xs uppercase tracking-[0.16em] text-white/50">
                  OTP Code
                </p>
                <p className="mt-3 font-display text-4xl">
                  {order.otpCode ?? "Menunggu SMS masuk..."}
                </p>
                <p className="mt-3 text-sm leading-7 text-white/65">
                  Status akan otomatis direfresh tiap 5 detik selama order masih
                  `pending`.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  className="hero-button-muted w-full"
                  disabled={isRefreshingOrder}
                  onClick={() => {
                    startTransition(() => {
                      void refreshOrder(order.id);
                    });
                  }}
                  type="button"
                >
                  {isRefreshingOrder ? "Merefresh..." : "Refresh Status"}
                </button>
                <button
                  className="hero-button-muted w-full"
                  disabled={isRefreshingOrder || order.status !== "pending"}
                  onClick={() => void handleCancelOrder()}
                  type="button"
                >
                  Cancel Order
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 rounded-[22px] border border-ink/8 bg-paper px-4 py-8 text-center text-sm text-ink/60">
              Belum ada order. Pilih service lalu tekan tombol ambil nomor.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
