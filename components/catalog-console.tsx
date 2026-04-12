"use client";

import Link from "next/link";
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
  OrderHistoryResponse,
  RuntimeStatus,
  Service,
} from "@/lib/types";

type CatalogConsoleProps = {
  initialRuntime: RuntimeStatus;
  initialBalance: Balance | null;
  initialHistory: OrderHistoryResponse;
};

type HistoryFilter = "all" | Order["status"];

const shellCard =
  "rounded-[32px] border border-white/8 bg-white/6 p-5 shadow-[0_24px_70px_-42px_rgba(0,0,0,0.85)] backdrop-blur";
const innerCard = "rounded-[26px] border border-white/10 bg-[#101b2f]/82 p-4";
const inputClass =
  "h-14 w-full rounded-[22px] border border-white/10 bg-[#101b2f]/82 px-4 text-base text-white outline-none placeholder:text-white/35";

function hasError(payload: unknown): payload is { error?: string } {
  return Boolean(payload && typeof payload === "object" && "error" in payload);
}

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function Glyph({
  label,
  tone = "blue",
  className,
}: {
  label: string;
  tone?: "blue" | "cyan" | "soft";
  className?: string;
}) {
  const toneClass =
    tone === "cyan"
      ? "bg-[linear-gradient(135deg,#67f0ff,#2cb6ff)] text-[#071422]"
      : tone === "soft"
        ? "bg-white/8 text-white/72"
        : "bg-[linear-gradient(135deg,#4a7cff,#67dfff)] text-[#071422]";

  return (
    <div
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-2xl text-xs font-black tracking-[0.18em]",
        toneClass,
        className,
      )}
    >
      {label}
    </div>
  );
}

function getStatusLabel(status: Order["status"]) {
  switch (status) {
    case "otp_received":
      return "Success";
    case "expired":
      return "Expired";
    case "cancelled":
      return "Cancelled";
    default:
      return "Waiting";
  }
}

function getStatusClass(status: Order["status"]) {
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

function getProfileInitials() {
  const label = process.env.NEXT_PUBLIC_SITE_NAME ?? "Secure Fast";

  return (
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase())
      .join("") || "SF"
  );
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

async function requestHistory() {
  const response = await fetch("/api/history", { cache: "no-store" });
  const payload = (await response.json()) as
    | OrderHistoryResponse
    | { error?: string };

  if (!response.ok || hasError(payload)) {
    const message = hasError(payload) ? payload.error : undefined;
    throw new Error(message ?? "Gagal membaca history order.");
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

  const payload = (await response.json()) as
    | { order: Order }
    | { error?: string };

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

  const payload = (await response.json()) as
    | { order: Order }
    | { error?: string };

  if (!response.ok || !("order" in payload)) {
    const message = hasError(payload) ? payload.error : undefined;
    throw new Error(message ?? "Gagal membatalkan order.");
  }

  return payload.order;
}

export function CatalogConsole({
  initialRuntime,
  initialBalance,
  initialHistory,
}: CatalogConsoleProps) {
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [history, setHistory] = useState<OrderHistoryResponse>(initialHistory);
  const [country, setCountry] = useState("Semua");
  const [query, setQuery] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState("dashboard");
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);
  const [isRefreshingOrder, setIsRefreshingOrder] = useState(false);
  const deferredQuery = useDeferredValue(query);
  const deferredHistoryQuery = useDeferredValue(historyQuery);

  async function loadCatalog() {
    setIsLoadingCatalog(true);
    setCatalogError(null);

    try {
      const payload = await requestCatalog();
      setCatalog(payload);
      setCountry((currentCountry) => {
        if (currentCountry !== "Semua") {
          return currentCountry;
        }

        if (payload.countries.includes("Indonesia")) {
          return "Indonesia";
        }

        return payload.countries[0] ?? "Semua";
      });
    } catch (error) {
      setCatalogError(
        error instanceof Error ? error.message : "Gagal memuat katalog.",
      );
    } finally {
      setIsLoadingCatalog(false);
    }
  }

  async function loadHistory() {
    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      setHistory(await requestHistory());
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "Gagal membaca history order.",
      );
    } finally {
      setIsLoadingHistory(false);
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
    void loadHistory();
  }, []);

  const refreshOrderEvent = useEffectEvent((orderId: string) => {
    startTransition(() => {
      void refreshOrder(orderId);
    });
  });

  useEffect(() => {
    if (!order?.id || order.status !== "pending") {
      return;
    }

    const intervalId = window.setInterval(() => {
      refreshOrderEvent(order.id);
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [order?.id, order?.status]);

  useEffect(() => {
    if (!order) {
      return;
    }

    setHistory((current) => {
      const nextOrders = current.orders.some((item) => item.id === order.id)
        ? current.orders.map((item) => (item.id === order.id ? order : item))
        : [order, ...current.orders];

      return {
        ...current,
        total: nextOrders.length,
        updatedAt: new Date().toISOString(),
        orders: nextOrders,
      };
    });
  }, [order]);

  const availableServices =
    catalog?.services.filter((service) => {
      const matchesQuery =
        !deferredQuery ||
        `${service.service} ${service.country} ${service.tags.join(" ")}`
          .toLowerCase()
          .includes(deferredQuery.toLowerCase());

      const matchesCountry = country === "Semua" || service.country === country;

      return matchesQuery && matchesCountry;
    }) ?? [];

  useEffect(() => {
    const currentServices =
      catalog?.services.filter((service) => {
        const matchesQuery =
          !deferredQuery ||
          `${service.service} ${service.country} ${service.tags.join(" ")}`
            .toLowerCase()
            .includes(deferredQuery.toLowerCase());

        const matchesCountry =
          country === "Semua" || service.country === country;

        return matchesQuery && matchesCountry;
      }) ?? [];

    if (!currentServices.length) {
      if (selectedServiceId) {
        setSelectedServiceId("");
      }
      return;
    }

    const currentServiceIsVisible = currentServices.some(
      (service) => service.id === selectedServiceId,
    );

    if (!currentServiceIsVisible) {
      setSelectedServiceId(currentServices[0].id);
    }
  }, [catalog?.services, country, deferredQuery, selectedServiceId]);

  const selectedService =
    availableServices.find((service) => service.id === selectedServiceId) ?? null;

  async function handleCreateOrder() {
    if (!selectedService) {
      return;
    }

    setIsOrdering(true);
    setOrderError(null);

    try {
      setOrder(await requestCreateOrder(selectedService));
      setActiveMenu("order-state");
      window.setTimeout(() => {
        document
          .getElementById("order-state")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
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

  function scrollToSection(sectionId: string) {
    setDrawerOpen(false);
    setActiveMenu(sectionId);
    window.setTimeout(() => {
      document
        .getElementById(sectionId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  function handleExportCsv() {
    if (!history.orders.length) {
      return;
    }

    const rows = [
      [
        "order_id",
        "service",
        "country",
        "phone_number",
        "status",
        "price",
        "currency",
        "created_at",
      ],
      ...history.orders.map((item) => [
        item.id,
        item.service,
        item.country,
        item.phoneNumber,
        item.status,
        String(item.price),
        item.currency,
        item.createdAt,
      ]),
    ];

    const csv = rows
      .map((row) =>
        row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "otp-orders.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const balanceLabel = initialBalance
    ? formatCurrency(initialBalance.amount, initialBalance.currency)
    : "Tidak terbaca";
  const profileInitials = getProfileInitials();
  const activeServerId = catalog?.source === "fallback" ? "backup" : "live";
  const totalOrders = history.orders.length;
  const successfulOrders = history.orders.filter(
    (item) => item.status === "otp_received",
  ).length;
  const pendingOrders = history.orders.filter(
    (item) => item.status === "pending",
  ).length;
  const closedOrders = history.orders.filter((item) =>
    ["cancelled", "expired"].includes(item.status),
  ).length;
  const successRate = totalOrders
    ? Math.round((successfulOrders / totalOrders) * 100)
    : 0;
  const filteredHistory = history.orders.filter((item) => {
    const matchesStatus =
      historyFilter === "all" ? true : item.status === historyFilter;
    const matchesQuery =
      !deferredHistoryQuery ||
      `${item.id} ${item.service} ${item.country} ${item.phoneNumber}`
        .toLowerCase()
        .includes(deferredHistoryQuery.toLowerCase());

    return matchesStatus && matchesQuery;
  });
  const stats = [
    {
      label: "Balance",
      value: balanceLabel,
      note:
        initialBalance && initialBalance.amount > 0
          ? "Ready dipakai order live"
          : "Isi saldo provider dulu",
      glyph: "RP",
      chip: "Active balance",
    },
    {
      label: "Total Orders",
      value: String(totalOrders),
      note: pendingOrders ? `${pendingOrders} order masih menunggu` : "Belum ada order aktif",
      glyph: "OR",
      chip: "Today",
    },
    {
      label: "Successful OTP",
      value: String(successfulOrders),
      note: totalOrders ? `${successRate}% success rate` : "Belum ada OTP selesai",
      glyph: "OK",
      chip: "Success rate",
    },
    {
      label: "Failed / Cancelled",
      value: String(closedOrders),
      note: "Expired dan cancelled tercatat di sini",
      glyph: "CL",
      chip: "Auto refund",
    },
  ];

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#06101f] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-18%] top-[-8rem] h-[24rem] w-[24rem] rounded-full bg-sky-400/18 blur-3xl" />
        <div className="absolute right-[-12%] top-[10rem] h-[18rem] w-[18rem] rounded-full bg-cyan-300/16 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(164,235,255,0.12),_transparent_34%),linear-gradient(180deg,#091528_0%,#071121_48%,#050d18_100%)]" />
      </div>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-[#020814]/62 backdrop-blur-sm transition-opacity duration-300",
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setDrawerOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[84vw] max-w-sm border-r border-white/10 bg-[#1a263b]/96 p-6 shadow-[0_35px_90px_-28px_rgba(0,0,0,0.8)] backdrop-blur-xl transition-transform duration-300",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between">
          <Link className="flex items-center gap-3" href="/">
            <Glyph className="h-12 w-12" label="KK" />
            <div>
              <p className="font-display text-[1.75rem] leading-none text-white">
                Kirim<span className="text-[#8ff4ff]">Kode</span>
              </p>
              <p className="mt-1 text-xs uppercase tracking-[0.2em] text-white/42">
                Supplier Console
              </p>
            </div>
          </Link>

          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-lg font-semibold text-white/70"
            onClick={() => setDrawerOpen(false)}
            type="button"
          >
            X
          </button>
        </div>

        <div className="mt-10 space-y-3">
          {[
            { id: "dashboard", label: "Dashboard", glyph: "DB" },
            { id: "buy-number", label: "Buy Number", glyph: "BY" },
            { id: "deposit", label: "Deposit", glyph: "DP" },
          ].map((item) => (
            <button
              key={item.id}
              className={cn(
                "flex w-full items-center gap-4 rounded-[24px] px-5 py-4 text-left transition-colors",
                activeMenu === item.id
                  ? "bg-[linear-gradient(135deg,rgba(95,214,255,0.18),rgba(74,115,255,0.22))] text-[#8ff4ff]"
                  : "bg-white/4 text-white/78",
              )}
              onClick={() => scrollToSection(item.id)}
              type="button"
            >
              <Glyph label={item.glyph} tone="soft" />
              <span className="text-[1.45rem] font-semibold">{item.label}</span>
            </button>
          ))}

          <Link
            className="flex items-center gap-4 rounded-[24px] bg-white/4 px-5 py-4 text-white/72 transition-colors hover:bg-white/8"
            href="/docs"
            onClick={() => setDrawerOpen(false)}
          >
            <Glyph label="AP" tone="soft" />
            <span className="text-[1.45rem] font-semibold">API Docs</span>
          </Link>
        </div>

        <div className="mt-10 rounded-[26px] border border-white/10 bg-white/5 p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-white/45">
            Runtime
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm text-white/72">
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
              {initialRuntime.providerMode.toUpperCase()}
            </span>
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
              Markup {initialRuntime.markupPercent}%
            </span>
            <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1">
              Margin {formatCurrency(initialRuntime.minMargin, initialRuntime.currency)}
            </span>
          </div>
        </div>
      </aside>

      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-6xl flex-col">
        <header className="sticky top-0 z-30 border-b border-white/8 bg-[#081224]/84 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <button
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg font-semibold text-white/76"
              onClick={() => setDrawerOpen(true)}
              type="button"
            >
              =
            </button>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-full border border-cyan-300/24 bg-[linear-gradient(135deg,rgba(69,221,255,0.18),rgba(68,117,255,0.18))] px-3 py-2 text-sm font-semibold text-[#8ff4ff]">
                <Glyph className="h-7 w-7 rounded-full text-[0.6rem]" label="RP" tone="cyan" />
                <span>{balanceLabel}</span>
              </div>
              <button
                className="inline-flex h-11 items-center rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white/78"
                type="button"
              >
                ID / <span className="pl-1 text-[#8ff4ff]">EN</span>
              </button>
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-black tracking-[0.18em] text-white/70"
                type="button"
              >
                LY
              </button>
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs font-black tracking-[0.18em] text-white/70"
                type="button"
              >
                AL
              </button>
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#46d4ff,#2ba2ff)] font-semibold text-[#071422]">
                {profileInitials}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-6 sm:px-6">
          <section
            className="rounded-[28px] border border-cyan-300/24 bg-[linear-gradient(135deg,rgba(22,92,114,0.72),rgba(8,44,74,0.9))] p-5"
            id="deposit"
          >
            <div className="flex items-start gap-3">
              <Glyph className="mt-0.5 h-11 w-11 rounded-full" label="IN" tone="cyan" />
              <div className="min-w-0 flex-1">
                <p className="text-[1.55rem] font-semibold text-white">Deposit</p>
                <p className="mt-1 text-base leading-7 text-[#9fdfff]">
                  Saldo KirimKode Anda memang masih 0. Saya fokuskan dulu UI
                  mobile supaya tampilannya enak dipakai di HP Android.
                </p>
              </div>
              <button className="text-sm font-semibold text-[#8ff4ff]/80" type="button">
                X
              </button>
            </div>
          </section>

          <section className="pt-8" id="dashboard">
            <p className="text-[2.4rem] font-display font-semibold leading-none text-white">
              Dashboard
            </p>
            <p className="mt-3 max-w-xl text-lg leading-8 text-white/70">
              Welcome back. Console ini sekarang mobile-first dengan shell yang
              lebih mirip aplikasi supplier OTP.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                className="inline-flex items-center gap-3 rounded-full bg-[linear-gradient(135deg,#67f0ff,#2cb6ff)] px-6 py-3 text-base font-semibold text-[#071422]"
                onClick={() => scrollToSection("buy-number")}
                type="button"
              >
                <Glyph className="h-8 w-8 rounded-full text-[0.55rem]" label="BY" tone="cyan" />
                Buy Number
              </button>
              <button
                className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/6 px-6 py-3 text-base font-semibold text-white/82"
                onClick={() => {
                  startTransition(() => {
                    void loadCatalog();
                    void loadHistory();
                  });
                }}
                type="button"
              >
                <Glyph className="h-8 w-8 rounded-full text-[0.55rem]" label="RF" tone="soft" />
                Refresh Data
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {stats.map((stat) => (
                <article key={stat.label} className={shellCard}>
                  <div className="flex items-start justify-between gap-4">
                    <Glyph label={stat.glyph} />
                    <span className="rounded-full bg-cyan-300/12 px-3 py-1 text-xs font-semibold text-[#8ff4ff]">
                      {stat.chip}
                    </span>
                  </div>
                  <p className="mt-6 text-3xl font-semibold tracking-tight text-white">
                    {stat.value}
                  </p>
                  <p className="mt-2 text-lg font-medium text-white/88">
                    {stat.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    {stat.note}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="pt-8" id="buy-number">
            <div className={shellCard}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8ff4ff]">
                    Buy OTP Number
                  </p>
                  <h2 className="mt-3 text-[2.05rem] font-display font-semibold leading-tight text-white">
                    Select server, country, and service
                  </h2>
                  <p className="mt-3 max-w-2xl text-base leading-8 text-white/62">
                    Layout ini dirombak supaya lebih enak disentuh di layar HP
                    dan tetap mengikuti alur supplier OTP.
                  </p>
                </div>

                <button
                  className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-xs font-black tracking-[0.16em] text-white/70"
                  onClick={() => {
                    startTransition(() => {
                      void loadCatalog();
                    });
                  }}
                  type="button"
                >
                  RF
                </button>
              </div>

              {catalogError ? (
                <div className="mt-6 rounded-[24px] border border-rose-300/18 bg-rose-400/12 px-4 py-4 text-sm leading-7 text-rose-100">
                  {catalogError}
                </div>
              ) : null}

              {catalog?.warning ? (
                <div className="mt-6 rounded-[24px] border border-amber-300/18 bg-amber-400/10 px-4 py-4 text-sm leading-7 text-amber-50">
                  {catalog.warning}
                </div>
              ) : null}

              {initialBalance && initialBalance.amount <= 0 ? (
                <div className="mt-4 rounded-[24px] border border-sky-300/20 bg-sky-400/10 px-4 py-4 text-sm leading-7 text-[#bdeeff]">
                  Saldo upstream masih 0. UI tetap siap dipakai untuk setup,
                  katalog, dan test tampilan mobile.
                </div>
              ) : null}

              <div className="mt-7">
                <div className="flex items-center gap-3 text-[1.15rem] font-semibold text-white">
                  <Glyph className="h-9 w-9 rounded-xl text-[0.55rem]" label="SV" tone="soft" />
                  Select Server
                </div>

                <div className="mt-5 grid gap-4">
                  {[
                    {
                      id: "live",
                      title: "KirimKode Live",
                      description:
                        initialRuntime.providerMode === "rest"
                          ? `Host ${initialRuntime.baseUrlHost ?? "api.kirimkode.com"}`
                          : "Mode demo aktif di console",
                      badge:
                        initialRuntime.providerMode === "rest" ? "Connected" : "Mock",
                      glyph: "LV",
                    },
                    {
                      id: "backup",
                      title: "Catalog Backup",
                      description: catalog?.warning
                        ? "Aktif karena katalog upstream sedang kosong"
                        : "Standby untuk jaga tampilan tetap aman",
                      badge: catalog?.source === "fallback" ? "Active" : "Standby",
                      glyph: "BK",
                    },
                  ].map((server) => {
                    const isActive = activeServerId === server.id;

                    return (
                      <div
                        key={server.id}
                        className={cn(
                          "rounded-[26px] border p-5 transition-colors",
                          isActive
                            ? "border-cyan-300/30 bg-[linear-gradient(135deg,rgba(34,106,129,0.72),rgba(11,49,84,0.84))]"
                            : "border-white/10 bg-[#16233a]/78",
                        )}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4">
                            <Glyph className="h-14 w-14 text-sm" label={server.glyph} />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-[1.35rem] font-semibold text-white">
                                  {server.title}
                                </p>
                                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                              </div>
                              <p className="mt-1 text-sm leading-6 text-white/58">
                                {server.description}
                              </p>
                            </div>
                          </div>
                          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/68">
                            {server.badge}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-7 grid gap-4">
                <div>
                  <div className="mb-3 flex items-center gap-3 text-[1.15rem] font-semibold text-white">
                    <Glyph className="h-9 w-9 rounded-xl text-[0.55rem]" label="CT" tone="soft" />
                    Select Country
                  </div>
                  <select
                    className={inputClass}
                    onChange={(event) => setCountry(event.target.value)}
                    value={country}
                  >
                    <option value="Semua">All Countries</option>
                    {catalog?.countries.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-3 text-[1.15rem] font-semibold text-white">
                    <Glyph className="h-9 w-9 rounded-xl text-[0.55rem]" label="SR" tone="soft" />
                    Search Service
                  </div>
                  <input
                    className={inputClass}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="WhatsApp, Telegram, Google, Indonesia..."
                    value={query}
                  />
                </div>

                <div>
                  <div className="mb-3 flex items-center gap-3 text-[1.15rem] font-semibold text-white">
                    <Glyph className="h-9 w-9 rounded-xl text-[0.55rem]" label="SC" tone="soft" />
                    Select Service
                  </div>
                  <select
                    className={inputClass}
                    disabled={!availableServices.length}
                    onChange={(event) => setSelectedServiceId(event.target.value)}
                    value={selectedServiceId}
                  >
                    {!availableServices.length ? (
                      <option value="">Belum ada layanan</option>
                    ) : null}
                    {availableServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.service} - {service.country}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {isLoadingCatalog ? (
                <div className="mt-6 rounded-[24px] border border-white/10 bg-[#101b2f]/82 px-4 py-6 text-center text-sm text-white/58">
                  Memuat katalog supplier...
                </div>
              ) : null}

              {!isLoadingCatalog && !selectedService ? (
                <div className="mt-6 rounded-[24px] border border-white/10 bg-[#101b2f]/82 px-4 py-6 text-center text-sm text-white/58">
                  Tidak ada layanan yang cocok dengan filter saat ini.
                </div>
              ) : null}

              {selectedService ? (
                <div className="mt-6 rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,28,49,0.96),rgba(11,21,36,0.96))] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-cyan-300/12 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#8ff4ff]">
                          {selectedService.category}
                        </span>
                        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-semibold text-white/65">
                          {selectedService.country}
                        </span>
                      </div>
                      <h3 className="mt-4 text-[1.8rem] font-semibold leading-tight text-white">
                        {selectedService.service}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-white/58">
                        Modal {formatCurrency(selectedService.upstreamPrice, selectedService.currency)}{" "}
                        | ETA {selectedService.deliveryEtaSeconds}s | Stock {selectedService.stock}
                      </p>
                    </div>

                    <div className="min-w-[160px] text-left sm:text-right">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/42">
                        Harga Jual
                      </p>
                      <p className="mt-1 text-[1.85rem] font-semibold text-white">
                        {formatCurrency(selectedService.price, selectedService.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedService.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className={innerCard}>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                        Source
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {catalog?.source === "fallback" ? "Fallback Catalog" : "Upstream Live"}
                      </p>
                    </div>
                    <div className={innerCard}>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                        Margin
                      </p>
                      <p className="mt-2 text-base font-semibold text-white">
                        {initialRuntime.markupPercent}% +{" "}
                        {formatCurrency(initialRuntime.minMargin, initialRuntime.currency)}
                      </p>
                    </div>
                  </div>

                  <button
                    className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#67f0ff,#2cb6ff)] px-6 py-4 text-base font-semibold text-[#071422] disabled:cursor-not-allowed disabled:opacity-65"
                    disabled={isOrdering}
                    onClick={() => void handleCreateOrder()}
                    type="button"
                  >
                    <Glyph className="h-8 w-8 rounded-full text-[0.55rem]" label="GO" tone="cyan" />
                    {isOrdering ? "Membuat Order..." : "Buy OTP Number"}
                  </button>
                </div>
              ) : null}
            </div>
          </section>

          <section className="pt-8" id="order-state">
            <div className={shellCard}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#8ff4ff]">
                    Order State
                  </p>
                  <h2 className="mt-3 text-[2rem] font-display font-semibold text-white">
                    Live order and OTP status
                  </h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/55">
                  auto refresh 5s
                </span>
              </div>

              {orderError ? (
                <div className="mt-6 rounded-[24px] border border-rose-300/18 bg-rose-400/12 px-4 py-4 text-sm leading-7 text-rose-100">
                  {orderError}
                </div>
              ) : null}

              {order ? (
                <div className="mt-6 rounded-[28px] border border-white/10 bg-[#0e1a2d]/88 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h3 className="text-[1.75rem] font-semibold text-white">
                        {order.service}
                      </h3>
                      <p className="mt-2 text-base text-white/58">
                        {order.country} | {order.phoneNumber}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                        getStatusClass(order.status),
                      )}
                    >
                      {getStatusLabel(order.status)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className={innerCard}>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                        Dibuat
                      </p>
                      <p className="mt-2 text-sm leading-7 text-white/72">
                        {formatDateTime(order.createdAt)}
                      </p>
                    </div>
                    <div className={innerCard}>
                      <p className="text-xs uppercase tracking-[0.18em] text-white/40">
                        Kedaluwarsa
                      </p>
                      <p className="mt-2 text-sm leading-7 text-white/72">
                        {formatDateTime(order.expiresAt)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[26px] border border-cyan-300/18 bg-[linear-gradient(135deg,rgba(20,70,111,0.7),rgba(10,26,48,0.96))] p-5">
                    <p className="text-xs uppercase tracking-[0.18em] text-[#8ff4ff]">
                      OTP Code
                    </p>
                    <p className="mt-3 break-all text-[2rem] font-semibold tracking-[0.08em] text-white">
                      {order.otpCode ?? "MENUNGGU SMS MASUK"}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-white/10 bg-white/6 px-6 py-3.5 text-sm font-semibold text-white/82 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isRefreshingOrder}
                      onClick={() => {
                        if (!order.id) {
                          return;
                        }

                        startTransition(() => {
                          void refreshOrder(order.id);
                        });
                      }}
                      type="button"
                    >
                      <Glyph className="h-8 w-8 rounded-full text-[0.55rem]" label="RF" tone="soft" />
                      {isRefreshingOrder ? "Merefresh..." : "Refresh Status"}
                    </button>
                    <button
                      className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-rose-300/16 bg-rose-400/10 px-6 py-3.5 text-sm font-semibold text-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isRefreshingOrder || order.status !== "pending"}
                      onClick={() => void handleCancelOrder()}
                      type="button"
                    >
                      <Glyph className="h-8 w-8 rounded-full bg-rose-400/18 text-[0.55rem] text-rose-100" label="CX" />
                      Cancel Order
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-[28px] border border-white/10 bg-[#101b2f]/82 px-5 py-12 text-center">
                  <Glyph className="mx-auto h-12 w-12 rounded-full text-[0.65rem]" label="OT" tone="soft" />
                  <p className="mt-4 text-lg font-semibold text-white">
                    Belum ada order aktif
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/56">
                    Pilih service di atas lalu tekan tombol Buy OTP Number untuk
                    menampilkan status order di sini.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section className="pt-8" id="history">
            <div className={shellCard}>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 text-[1.35rem] font-semibold text-white">
                    <Glyph className="h-9 w-9 rounded-xl text-[0.55rem]" label="HI" tone="soft" />
                    Order History
                  </div>
                  <p className="mt-2 text-sm leading-7 text-white/55">
                    Riwayat order disusun agar tetap rapi di mobile dan bisa
                    diexport ke CSV.
                  </p>
                </div>

                <button
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-2.5 text-sm font-semibold text-white/78 disabled:cursor-not-allowed disabled:opacity-55"
                  disabled={!history.orders.length}
                  onClick={handleExportCsv}
                  type="button"
                >
                  <Glyph className="h-8 w-8 rounded-full text-[0.55rem]" label="EX" tone="soft" />
                  Export CSV
                </button>
              </div>

              {historyError ? (
                <div className="mt-6 rounded-[24px] border border-rose-300/18 bg-rose-400/12 px-4 py-4 text-sm leading-7 text-rose-100">
                  {historyError}
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <input
                  className={cn(inputClass, "flex-1")}
                  onChange={(event) => setHistoryQuery(event.target.value)}
                  placeholder="Search number, service, country, or order id..."
                  value={historyQuery}
                />
                <button
                  className="inline-flex items-center justify-center gap-3 rounded-full bg-[linear-gradient(135deg,#67f0ff,#2cb6ff)] px-6 py-3.5 text-base font-semibold text-[#071422]"
                  onClick={() => {
                    startTransition(() => {
                      void loadHistory();
                    });
                  }}
                  type="button"
                >
                  <Glyph className="h-8 w-8 rounded-full text-[0.55rem]" label="GO" tone="cyan" />
                  Search
                </button>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  { id: "all" as const, label: "All" },
                  { id: "otp_received" as const, label: "Success" },
                  { id: "pending" as const, label: "Waiting" },
                  { id: "cancelled" as const, label: "Cancelled" },
                  { id: "expired" as const, label: "Expired" },
                ].map((item) => (
                  <button
                    key={item.id}
                    className={cn(
                      "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                      historyFilter === item.id
                        ? "bg-[linear-gradient(135deg,#67f0ff,#2cb6ff)] text-[#071422]"
                        : "bg-white/8 text-white/56",
                    )}
                    onClick={() => setHistoryFilter(item.id)}
                    type="button"
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 text-sm text-white/52">
                <p>Menampilkan {filteredHistory.length} order</p>
                <p>{isLoadingHistory ? "Merefresh history..." : "Sinkron terbaru"}</p>
              </div>

              {filteredHistory.length ? (
                <div className="mt-5 space-y-3">
                  {filteredHistory.map((item) => (
                    <article key={item.id} className={innerCard}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-semibold text-white">
                            {item.service}
                          </p>
                          <p className="mt-1 text-sm text-white/52">
                            {item.country} | {item.phoneNumber}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                            getStatusClass(item.status),
                          )}
                        >
                          {getStatusLabel(item.status)}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 text-sm text-white/58 sm:grid-cols-2">
                        <div>
                          <p className="text-white/35">Order ID</p>
                          <p className="mt-1 break-all text-white/75">{item.id}</p>
                        </div>
                        <div>
                          <p className="text-white/35">Harga</p>
                          <p className="mt-1 text-white/75">
                            {formatCurrency(item.price, item.currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-white/35">Created</p>
                          <p className="mt-1 text-white/75">
                            {formatDateTime(item.createdAt)}
                          </p>
                        </div>
                        <div>
                          <p className="text-white/35">OTP</p>
                          <p className="mt-1 text-white/75">
                            {item.otpCode ?? "-"}
                          </p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-8 rounded-[28px] border border-white/10 bg-[#101b2f]/82 px-5 py-14 text-center">
                  <Glyph className="mx-auto h-12 w-12 rounded-full text-[0.65rem]" label="NO" tone="soft" />
                  <p className="mt-4 text-xl font-semibold text-white/82">
                    No orders yet
                  </p>
                  <p className="mt-2 text-sm leading-7 text-white/48">
                    Riwayat order akan tampil di sini setelah Anda mulai
                    menggunakan tombol Buy OTP Number.
                  </p>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      <Link
        className="fixed bottom-5 right-5 z-30 inline-flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,#67f0ff,#2cb6ff)] text-base font-black tracking-[0.18em] text-[#071422]"
        href="/docs"
      >
        DOC
      </Link>
    </div>
  );
}
