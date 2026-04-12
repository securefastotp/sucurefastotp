import "server-only";
import {
  cancelMockOrder,
  createMockOrder,
  getMockBalance,
  getMockOrder,
  listMockOrders,
  listMockServices,
} from "@/lib/mock-data";
import { getPaymentGatewayStatus } from "@/lib/payments";
import { computeRetailPrice, getPricingConfig } from "@/lib/pricing";
import type {
  Balance,
  CatalogResponse,
  Order,
  OrderHistoryResponse,
  RuntimeStatus,
  Service,
} from "@/lib/types";

type CatalogFilters = {
  q?: string;
  country?: string;
  category?: string;
};

type CreateOrderInput = {
  serviceId: string;
  service: string;
  country: string;
  price?: number;
  currency?: string;
};

type OrderContext = {
  serviceId: string;
  service: string;
  country: string;
  price: number;
  currency: string;
};

const orderContextGlobal = globalThis as typeof globalThis & {
  __upstreamOrderContext?: Map<string, OrderContext>;
};

const orderContextStore =
  orderContextGlobal.__upstreamOrderContext ?? new Map<string, OrderContext>();
orderContextGlobal.__upstreamOrderContext = orderContextStore;

function getProviderConfig() {
  const apiKey = process.env.UPSTREAM_API_KEY;
  const requestedMode = process.env.UPSTREAM_PROVIDER_MODE;
  const mode =
    requestedMode === "rest" || (!requestedMode && apiKey) ? "rest" : "mock";
  const baseUrl = process.env.UPSTREAM_BASE_URL ?? "https://api.kirimkode.com/v1";

  return {
    mode: mode === "rest" && baseUrl && apiKey ? "rest" : "mock",
    baseUrl,
    apiKey,
    apiKeyHeader: process.env.UPSTREAM_API_KEY_HEADER ?? "x-api-key",
    balancePath: process.env.UPSTREAM_BALANCE_PATH ?? "/balance",
    servicesPath:
      process.env.UPSTREAM_SERVICES_PATH ?? "/services?page=1&limit=200",
    historyPath: process.env.UPSTREAM_HISTORY_PATH ?? "/orders",
    orderPath: process.env.UPSTREAM_ORDER_PATH ?? "/order",
    orderStatusPath:
      process.env.UPSTREAM_ORDER_STATUS_PATH ?? "/order/{id}/status",
    cancelPath: process.env.UPSTREAM_CANCEL_PATH ?? "/order/{id}/cancel",
    orderMethod:
      process.env.UPSTREAM_ORDER_METHOD === "GET" ? "GET" : "POST",
    cancelMethod:
      process.env.UPSTREAM_CANCEL_METHOD === "DELETE" ? "DELETE" : "POST",
    timeoutMs: Number(process.env.UPSTREAM_TIMEOUT_MS ?? 15000),
  } as const;
}

function getBaseHost(baseUrl?: string) {
  if (!baseUrl) {
    return null;
  }

  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

function applyFilters(services: Service[], filters: CatalogFilters) {
  const q = filters.q?.trim().toLowerCase();

  return services.filter((service) => {
    const matchesQuery =
      !q ||
      `${service.service} ${service.country} ${service.category} ${service.tags.join(" ")}`
        .toLowerCase()
        .includes(q);

    const matchesCountry =
      !filters.country || service.country === filters.country;
    const matchesCategory =
      !filters.category || service.category === filters.category;

    return matchesQuery && matchesCountry && matchesCategory;
  });
}

function uniqueSorted(values: string[]) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function buildCatalogResponse(
  services: Service[],
  mode: RuntimeStatus["providerMode"],
  extras?: {
    source?: "upstream" | "fallback";
    warning?: string;
  },
): CatalogResponse {
  return {
    updatedAt: new Date().toISOString(),
    mode,
    total: services.length,
    countries: uniqueSorted(services.map((service) => service.country)),
    categories: uniqueSorted(services.map((service) => service.category)),
    services,
    source: extras?.source,
    warning: extras?.warning,
  };
}

async function fetchUpstream(
  path: string,
  options?: {
    method?: "GET" | "POST" | "DELETE";
    body?: Record<string, unknown>;
  },
) {
  const config = getProviderConfig();

  if (config.mode !== "rest" || !config.baseUrl || !config.apiKey) {
    throw new Error("Provider upstream belum dikonfigurasi.");
  }

  const url = new URL(path, config.baseUrl);
  const headers = new Headers({
    Accept: "application/json",
  });

  if (options?.body) {
    headers.set("Content-Type", "application/json");
  }

  if (config.apiKeyHeader.toLowerCase() === "authorization") {
    headers.set("Authorization", `Bearer ${config.apiKey}`);
  } else {
    headers.set(config.apiKeyHeader, config.apiKey);
  }

  const response = await fetch(url, {
    method: options?.method ?? "GET",
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(
      Number.isFinite(config.timeoutMs) ? config.timeoutMs : 15000,
    ),
  });

  const payload = (await response.json().catch(() => null)) as
    | Record<string, unknown>
    | Record<string, unknown>[]
    | null;

  if (
    payload &&
    !Array.isArray(payload) &&
    "success" in payload &&
    payload.success === false
  ) {
    const nestedError =
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : null;

    throw new Error(nestedError ?? "Provider upstream mengembalikan status gagal.");
  }

  if (!response.ok) {
    const nestedError =
      payload &&
      !Array.isArray(payload) &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : null;
    const message =
      nestedError ||
      (payload &&
        typeof payload === "object" &&
        "message" in payload &&
        typeof payload.message === "string" &&
        payload.message) ||
      `Provider upstream merespons HTTP ${response.status}.`;

    throw new Error(message);
  }

  return payload;
}

function replaceOrderId(pathTemplate: string, orderId: string) {
  return pathTemplate
    .replace("{id}", encodeURIComponent(orderId))
    .replace(":id", encodeURIComponent(orderId));
}

function extractArray(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;

  for (const key of ["data", "items", "services", "result"]) {
    if (Array.isArray(record[key])) {
      return record[key];
    }
  }

  return [];
}

function extractRecord(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {};
  }

  const record = payload as Record<string, unknown>;

  for (const key of ["data", "item", "order", "result"]) {
    const value = record[key];

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
  }

  return record;
}

function pickString(record: Record<string, unknown>, keys: string[], fallback = "") {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string" && value.trim()) {
      return value;
    }

    if (typeof value === "number") {
      return String(value);
    }
  }

  return fallback;
}

function pickNumber(record: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);

      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return fallback;
}

function pickTags(record: Record<string, unknown>) {
  const tagValue = record.tags;

  if (Array.isArray(tagValue)) {
    return tagValue
      .filter((item): item is string => typeof item === "string")
      .slice(0, 4);
  }

  return ["API Relay", "Ready"];
}

function normalizeStatus(input: string) {
  const value = input.toLowerCase();

  if (["otp_received", "received", "success", "done", "completed"].includes(value)) {
    return "otp_received" as const;
  }

  if (["expired", "timeout"].includes(value)) {
    return "expired" as const;
  }

  if (["cancelled", "canceled", "cancel"].includes(value)) {
    return "cancelled" as const;
  }

  return "pending" as const;
}

function normalizeService(item: unknown): Service | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }

  const record = item as Record<string, unknown>;
  const upstreamPrice = pickNumber(record, [
    "upstreamPrice",
    "price",
    "cost",
    "rate",
    "amount",
  ]);
  const service = pickString(record, [
    "service",
    "name",
    "serviceName",
    "service_name",
    "title",
    "slug",
    "code",
  ]);
  const country = pickString(record, ["country", "countryName", "region"], "Indonesia");

  if (!service || upstreamPrice <= 0) {
    return null;
  }

  return {
    id: pickString(
      record,
      ["id", "serviceId", "service_id", "code", "sku", "slug"],
      `${service}-${country}`,
    ),
    slug: `${service}-${country}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    service,
    country,
    countryCode: pickString(record, ["countryCode", "country_code"], "ID"),
    category: pickString(record, ["category", "group"], "General"),
    upstreamPrice,
    price: computeRetailPrice(upstreamPrice),
    stock: pickNumber(record, ["stock", "available", "availability"], 0),
    currency: pickString(record, ["currency"], getPricingConfig().currency),
    deliveryEtaSeconds: pickNumber(record, ["deliveryEtaSeconds", "eta", "speed"], 20),
    tags: pickTags(record),
  };
}

function normalizeOrder(
  payload: unknown,
  fallback: {
    id?: string;
    serviceId: string;
    service: string;
    country: string;
    price: number;
    currency: string;
  },
) {
  const record = extractRecord(payload);
  const status = normalizeStatus(
    pickString(record, ["status", "state", "orderStatus"], "pending"),
  );

  return {
    id: pickString(record, ["id", "orderId", "requestId"], fallback.id ?? ""),
    serviceId: fallback.serviceId,
    service: fallback.service,
    country: fallback.country,
    phoneNumber: pickString(
      record,
      ["phoneNumber", "number", "phone", "msisdn"],
      "-",
    ),
    price: fallback.price,
    currency: fallback.currency,
    status,
    otpCode: pickString(record, ["otpCode", "otp", "code", "smsCode"]) || undefined,
    createdAt: pickString(record, ["createdAt", "created_at"], new Date().toISOString()),
    expiresAt: pickString(
      record,
      ["expiresAt", "expiredAt", "validUntil", "expires_at"],
      new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    ),
    providerRef:
      pickString(record, ["providerRef", "reference", "refId"]) || undefined,
  } satisfies Order;
}

function normalizeBalance(payload: unknown): Balance {
  const record = extractRecord(payload);

  return {
    amount: pickNumber(record, ["balance", "amount", "saldo"], 0),
    currency: pickString(record, ["currency"], getPricingConfig().currency),
    updatedAt: new Date().toISOString(),
    mode: getProviderConfig().mode,
  };
}

function normalizeHistory(payload: unknown): OrderHistoryResponse {
  const orders: Order[] = extractArray(payload)
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const serviceId = pickString(record, ["serviceId", "service_id", "service"], "unknown");
      const service = pickString(record, ["service", "name"], serviceId);
      const country = pickString(record, ["country", "countryName"], "Unknown");
      const price = pickNumber(record, ["price", "amount"], 0);
      const currency = pickString(record, ["currency"], getPricingConfig().currency);

      return normalizeOrder(record, {
        id: pickString(record, ["id", "orderId", "requestId"]),
        serviceId,
        service,
        country,
        price,
        currency,
      });
    })
    .filter((order): order is NonNullable<typeof order> => order !== null);

  return {
    updatedAt: new Date().toISOString(),
    mode: getProviderConfig().mode,
    total: orders.length,
    orders,
  };
}

export async function getRuntimeStatus(): Promise<RuntimeStatus> {
  const config = getProviderConfig();
  const pricing = getPricingConfig();
  const paymentGateway = getPaymentGatewayStatus();

  return {
    providerMode: config.mode,
    upstreamConfigured: Boolean(config.baseUrl && config.apiKey),
    baseUrlHost: getBaseHost(config.baseUrl),
    markupPercent: pricing.markupPercent,
    minMargin: pricing.minMargin,
    currency: pricing.currency,
    midtransConfigured: paymentGateway.midtransConfigured,
    midtransEnvironment: paymentGateway.midtransEnvironment,
    midtransClientKeyAvailable: paymentGateway.midtransClientKeyAvailable,
  };
}

export async function getCatalog(filters: CatalogFilters = {}) {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    const services = applyFilters(listMockServices(), filters);
    return buildCatalogResponse(services, "mock", { source: "fallback" });
  }

  try {
    const payload = await fetchUpstream(config.servicesPath);
    const services = extractArray(payload)
      .map(normalizeService)
      .filter((service): service is Service => Boolean(service));
    const filteredServices = applyFilters(services, filters);

    if (filteredServices.length > 0) {
      return buildCatalogResponse(filteredServices, "rest", {
        source: "upstream",
      });
    }
  } catch {
    // Fall back to a curated local catalog when the upstream service
    // directory is unavailable, while keeping the rest of the runtime live.
  }

  return buildCatalogResponse(applyFilters(listMockServices(), filters), "rest", {
    source: "fallback",
    warning:
      "Katalog KirimKode sedang kosong atau gagal dimuat. Menampilkan katalog cadangan agar website tetap bisa dipakai.",
  });
}

export async function getBalance(): Promise<Balance> {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    return getMockBalance();
  }

  const payload = await fetchUpstream(config.balancePath);
  return normalizeBalance(payload);
}

export async function getHistory(): Promise<OrderHistoryResponse> {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    return listMockOrders();
  }

  const payload = await fetchUpstream(config.historyPath);
  return normalizeHistory(payload);
}

export async function createOrder(input: CreateOrderInput) {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    return createMockOrder(input.serviceId);
  }

  const fallbackPrice = input.price ?? 0;
  const fallbackCurrency = input.currency ?? getPricingConfig().currency;
  const payload = await fetchUpstream(config.orderPath, {
    method: config.orderMethod,
    body: {
      service: input.serviceId || input.service,
      serviceId: input.serviceId,
      country: input.country,
      countryName: input.country,
    },
  });

  const order = normalizeOrder(payload, {
    serviceId: input.serviceId,
    service: input.service,
    country: input.country,
    price: fallbackPrice,
    currency: fallbackCurrency,
  });

  orderContextStore.set(order.id, {
    serviceId: order.serviceId,
    service: order.service,
    country: order.country,
    price: order.price,
    currency: order.currency,
  });

  return order;
}

export async function getOrder(orderId: string) {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    return getMockOrder(orderId);
  }

  const payload = await fetchUpstream(replaceOrderId(config.orderStatusPath, orderId));
  const fallback = orderContextStore.get(orderId);

  if (!fallback) {
    throw new Error(
      "Context order tidak ditemukan. Untuk provider production, simpan order ke database atau Redis agar status lebih stabil.",
    );
  }

  return normalizeOrder(payload, { id: orderId, ...fallback });
}

export async function cancelOrder(orderId: string) {
  const config = getProviderConfig();

  if (config.mode === "mock") {
    return cancelMockOrder(orderId);
  }

  const fallback = orderContextStore.get(orderId);

  if (!fallback) {
    return null;
  }

  const payload = await fetchUpstream(replaceOrderId(config.cancelPath, orderId), {
    method: config.cancelMethod,
    body: {
      orderId,
    },
  });

  const order = normalizeOrder(payload, { id: orderId, ...fallback });
  order.status = "cancelled";
  orderContextStore.set(orderId, {
    serviceId: order.serviceId,
    service: order.service,
    country: order.country,
    price: order.price,
    currency: order.currency,
  });

  return order;
}
