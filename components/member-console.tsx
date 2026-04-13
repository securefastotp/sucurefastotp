"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type {
  AuthViewer,
  CatalogResponse,
  CountryOption,
  DashboardSummary,
  DepositRecord,
  Order,
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

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function hasError(payload: unknown): payload is { error?: string } {
  return Boolean(payload && typeof payload === "object" && "error" in payload);
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

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4l2.8 1.7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
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

export function MemberConsole({
  initialViewer,
  initialSummary,
  initialCatalog,
  initialCountries,
  initialCountryId,
}: MemberConsoleProps) {
  const router = useRouter();
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
  const [serviceSearch, setServiceSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "buy" | "history" | "about">(
    "dashboard",
  );
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [depositAmount, setDepositAmount] = useState("10000");
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

  const deferredSearch = useDeferredValue(serviceSearch);
  const selectedService = useMemo(
    () => catalog?.services.find((service) => service.id === selectedServiceId) ?? null,
    [catalog, selectedServiceId],
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

  async function refreshSummary() {
    if (!viewer) {
      return;
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
        nextSummary.orders.find((order) => order.status === "pending") ?? activeOrder,
      );
    } catch (error) {
      setDashboardError(
        error instanceof Error ? error.message : "Gagal memuat dashboard akun.",
      );
    } finally {
      setIsSummaryLoading(false);
    }
  }

  const syncDeposit = useEffectEvent(async (depositId: string) => {
    try {
      const deposit = await requestDepositStatus(depositId);
      setActiveDeposit(deposit);

      if (deposit.status === "paid" && deposit.creditedAt) {
        await refreshSummary();
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
      }
    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : "Gagal sinkron status order.",
      );
    }
  });

  useEffect(() => {
    if (!viewer || countries.length) {
      return;
    }

    setIsCountriesLoading(true);
    void requestCountries(selectedServer)
      .then((result) => {
        setCountries(result);
        setSelectedCountryId(result.find((country) => country.id === 6)?.id ?? result[0]?.id ?? null);
      })
      .catch((error) => {
        setDashboardError(error instanceof Error ? error.message : "Gagal memuat negara.");
      })
      .finally(() => {
        setIsCountriesLoading(false);
      });
  }, [viewer, countries.length, selectedServer]);

  useEffect(() => {
    if (!viewer || !selectedCountryId) {
      return;
    }

    setIsCatalogLoading(true);
    void requestCatalog(selectedServer, selectedCountryId)
      .then((result) => {
        setCatalog(result);
        setSelectedServiceId((current) => {
          if (current && result.services.some((service) => service.id === current)) {
            return current;
          }

          return result.services[0]?.id ?? "";
        });
      })
      .catch((error) => {
        setOrderError(
          error instanceof Error ? error.message : "Gagal memuat katalog layanan.",
        );
      })
      .finally(() => {
        setIsCatalogLoading(false);
      });
  }, [viewer, selectedServer, selectedCountryId]);

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
      if (authMode === "register") {
        await requestRegister({
          name: authName,
          email: authEmail,
          password: authPassword,
        });
      } else {
        await requestLogin({
          email: authEmail,
          password: authPassword,
        });
      }

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Gagal autentikasi akun.");
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await requestLogout();
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "Gagal logout akun.");
    }
  }

  async function handleDepositSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDepositLoading(true);
    setDepositError(null);

    try {
      const deposit = await requestCreateDeposit(Number(depositAmount));
      setActiveDeposit(deposit);
      await refreshSummary();
    } catch (error) {
      setDepositError(error instanceof Error ? error.message : "Gagal membuat deposit.");
    } finally {
      setIsDepositLoading(false);
    }
  }

  async function handleOrderSubmit() {
    if (!selectedService || !selectedCountryId) {
      setOrderError("Pilih negara dan layanan dulu sebelum membeli nomor.");
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
      });
      setActiveOrder(order);
      await refreshSummary();
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "Gagal membuat order OTP.");
    } finally {
      setIsOrderLoading(false);
    }
  }

  if (!viewer || !summary) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center px-4 py-8">
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
            {authError ? (
              <div className="rounded-[16px] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
                {authError}
              </div>
            ) : null}
            <button
              className="w-full rounded-[18px] bg-[linear-gradient(135deg,#80f0ff,#348cff)] px-4 py-3 text-[14px] font-semibold text-[#06101d]"
              disabled={isAuthLoading}
              type="submit"
            >
              {isAuthLoading
                ? "Memproses..."
                : authMode === "register"
                  ? "Buat Akun"
                  : "Masuk ke Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] px-4 py-4 text-white sm:px-6">
      <div className="mx-auto flex w-full max-w-[460px] flex-col gap-4 rounded-[32px] border border-white/12 bg-[#0d1a2d]/82 p-4 shadow-[0_32px_120px_-48px_rgba(3,8,20,0.92)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02))] px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandMark />
            <div>
              <p className="text-[15px] font-semibold text-white">Rahmat OTP</p>
              <p className="text-[11px] text-sky-100/65">{viewer.name}</p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-[11px] text-sky-100/65">Saldo</p>
            <p className="text-[14px] font-semibold text-cyan-100">
              {formatCurrency(summary.viewer.walletBalance, "IDR")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 rounded-[20px] border border-white/10 bg-white/5 p-1">
          {[
            { id: "dashboard", label: "Dashboard" },
            { id: "buy", label: "Buy Number" },
            { id: "history", label: "Riwayat" },
            { id: "about", label: "Tentang" },
          ].map((item) => (
            <button
              key={item.id}
              className={cn(
                "rounded-[14px] px-2 py-2 text-[11px] transition",
                activeTab === item.id
                  ? "bg-[linear-gradient(135deg,#74ecff,#378cff)] font-semibold text-[#08111f]"
                  : "text-sky-100/72",
              )}
              onClick={() => setActiveTab(item.id as typeof activeTab)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        {dashboardError ? (
          <div className="rounded-[16px] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-[12px] text-rose-100">
            {dashboardError}
          </div>
        ) : null}

        {activeTab === "dashboard" ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(67,147,255,0.16),rgba(10,20,38,0.36))] p-4">
              <p className="text-[12px] text-sky-100/70">Sistem wallet internal</p>
              <h1 className="mt-1 text-[22px] font-semibold text-white">
                Deposit saldo, lalu beli OTP dari dashboard.
              </h1>
              <p className="mt-2 text-[13px] leading-6 text-sky-50/72">
                Deposit user masuk ke saldo akun website Anda. Saat user order OTP, saldo internal user berkurang dan backend tetap memakai supply akun KirimKode Anda.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ["Saldo Aktif", formatCurrency(summary.viewer.walletBalance, "IDR")],
                ["Total Order", String(summary.metrics.totalOrders)],
                ["OTP Sukses", String(summary.metrics.successfulOtps)],
                ["Deposit Masuk", formatCurrency(summary.metrics.totalDeposits, "IDR")],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-sky-100/55">{label}</p>
                  <p className="mt-3 text-[18px] font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle icon={<WalletIcon className="h-4.5 w-4.5" />} title="Deposit Saldo" />
              <form className="mt-4 space-y-3" onSubmit={handleDepositSubmit}>
                <input
                  className="w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                  inputMode="numeric"
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
                  className="w-full rounded-[18px] bg-[linear-gradient(135deg,#7af1ff,#358cff)] px-4 py-3 text-[14px] font-semibold text-[#08101c]"
                  disabled={isDepositLoading}
                  type="submit"
                >
                  {isDepositLoading ? "Membuat QRIS..." : "Buat QRIS Deposit"}
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
                      <span>Fee Midtrans</span>
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
              <SectionTitle icon={<ServerIcon className="h-4.5 w-4.5" />} title="Select Server" />
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
                title="Select Country"
                action={isCountriesLoading ? <span className="text-[11px] text-sky-100/60">Loading...</span> : null}
              />
              <select
                className="mt-4 w-full rounded-[16px] border border-white/10 bg-[#07111f] px-4 py-3 text-[14px] text-white outline-none transition focus:border-sky-300/60"
                onChange={(event) => setSelectedCountryId(Number(event.target.value))}
                value={selectedCountryId ?? ""}
              >
                <option value="" disabled>
                  Pilih negara
                </option>
                {countries.map((country) => (
                  <option key={`${country.serverId}-${country.id}`} value={country.id}>
                    {country.flagEmoji ? `${country.flagEmoji} ` : ""}{country.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle
                icon={<CartIcon className="h-4.5 w-4.5" />}
                title="Select Service"
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
                    className={cn(
                      "flex w-full items-center justify-between gap-3 border-b border-white/6 px-4 py-3 text-left last:border-b-0",
                      selectedServiceId === service.id ? "bg-sky-300/10" : "",
                    )}
                    onClick={() => setSelectedServiceId(service.id)}
                    type="button"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium text-white">{service.service}</p>
                      <p className="mt-1 text-[11px] text-sky-100/60">
                        {service.serviceCode.toUpperCase()} | stok {service.stock}
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
                    "mt-4 w-full rounded-[18px] px-4 py-3 text-[14px] font-semibold transition",
                    summary.viewer.walletBalance >= selectedService.price
                      ? "bg-[linear-gradient(135deg,#7af1ff,#358cff)] text-[#08101c]"
                      : "bg-white/8 text-sky-100/55",
                  )}
                  disabled={isOrderLoading || summary.viewer.walletBalance < selectedService.price}
                  onClick={() => {
                    void handleOrderSubmit();
                  }}
                  type="button"
                >
                  {isOrderLoading
                    ? "Memproses order..."
                    : summary.viewer.walletBalance < selectedService.price
                      ? "Saldo tidak cukup"
                      : "Beli Nomor"}
                </button>
              </div>
            ) : null}

            {activeOrder ? (
              <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
                <SectionTitle icon={<ClockIcon className="h-4.5 w-4.5" />} title="Status OTP" />
                <div className="mt-4 space-y-2 text-[12px] text-sky-100/72">
                  <div className="flex items-center justify-between gap-3">
                    <span>Status</span>
                    <span className="text-white">{activeOrder.status}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Nomor</span>
                    <span className="text-white">{activeOrder.phoneNumber}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>OTP</span>
                    <span className="text-[16px] font-semibold text-cyan-100">
                      {activeOrder.otpCode ?? "Menunggu OTP..."}
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeTab === "history" ? (
          <div className="space-y-4">
            <div className="rounded-[24px] border border-white/10 bg-[#0a1525] p-4">
              <SectionTitle icon={<ClockIcon className="h-4.5 w-4.5" />} title="Riwayat Transaksi" />
              <div className="mt-4 space-y-2">
                {summary.ledger.map((entry: WalletLedgerEntry) => (
                  <div key={entry.id} className="rounded-[18px] border border-white/8 bg-white/4 px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[13px] font-medium text-white">{entry.description}</p>
                        <p className="mt-1 text-[11px] text-sky-100/56">{formatDateTime(entry.createdAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className={cn("text-[13px] font-semibold", entry.amount >= 0 ? "text-emerald-200" : "text-amber-100")}>
                          {entry.amount >= 0 ? "+" : "-"}{formatCurrency(Math.abs(entry.amount), "IDR")}
                        </p>
                        <p className="mt-1 text-[11px] text-sky-100/56">
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
          </div>
        ) : null}

        {activeTab === "about" ? (
          <div className="space-y-4 rounded-[24px] border border-white/10 bg-[#0a1525] p-4 text-[13px] leading-6 text-sky-100/72">
            <SectionTitle icon={<BrandMark className="h-9 w-9" />} title="Tentang Rahmat OTP" />
            <p>
              Dashboard ini memakai model mirip KirimKode: user login, deposit saldo via Midtrans, lalu order OTP memotong saldo wallet internal.
            </p>
            <p>
              Supply OTP tetap diambil dari akun KirimKode Anda lewat API key yang sudah terpasang di server.
            </p>
            <button
              className="mt-2 w-full rounded-[18px] border border-white/10 bg-white/4 px-4 py-3 text-[13px] font-medium text-sky-100/80"
              onClick={() => {
                void handleLogout();
              }}
              type="button"
            >
              Logout Akun
            </button>
          </div>
        ) : null}

        {isSummaryLoading ? (
          <div className="rounded-[16px] border border-white/8 bg-white/4 px-4 py-3 text-center text-[12px] text-sky-100/56">
            Memuat ulang dashboard...
          </div>
        ) : null}
      </div>
    </div>
  );
}
